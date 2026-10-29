import "server-only";
import { extractText, getDocumentProxy, getMeta, renderPageAsImage } from "unpdf";

/**
 * PDF helpers (pdf.js via unpdf). Used for:
 *  - telling digital PDFs from scans (text layer present or not)
 *  - the no-AI regex fallback and the "confirmed against document text" check
 *  - rendering pages to PNG for image-only vision models
 *  - a metadata hint when a document was produced by editing software
 */

export interface PdfInfo {
  pages: number;
  text: string;
  hasTextLayer: boolean;
  producer: string | null;
  creator: string | null;
  created: string | null;
  modified: string | null;
}

const MIN_TEXT_CHARS = 40;

export async function inspectPdf(bytes: Uint8Array): Promise<PdfInfo> {
  const doc = await getDocumentProxy(new Uint8Array(bytes));
  const [{ text, totalPages }, meta] = await Promise.all([
    extractText(doc, { mergePages: true }),
    getMeta(doc).catch(() => ({ info: {} as Record<string, unknown> })),
  ]);
  const info = (meta.info ?? {}) as Record<string, string | undefined>;
  const clean = text.replace(/\s+/g, " ").trim();
  return {
    pages: totalPages,
    text: clean,
    hasTextLayer: clean.length >= MIN_TEXT_CHARS,
    producer: info.Producer ?? null,
    creator: info.Creator ?? null,
    created: parsePdfDate(info.CreationDate),
    modified: parsePdfDate(info.ModDate),
  };
}

/** Renders the first `maxPages` pages to PNG (base64) for vision models that only accept images. */
export async function renderPdfPages(bytes: Uint8Array, maxPages = 2, scale = 1.6): Promise<string[]> {
  const doc = await getDocumentProxy(new Uint8Array(bytes));
  const out: string[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
    const png = await renderPageAsImage(doc, p, { canvasImport: () => import("@napi-rs/canvas"), scale });
    out.push(Buffer.from(png).toString("base64"));
  }
  return out;
}

function parsePdfDate(raw?: string): string | null {
  const m = raw?.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? "00"}:${m[5] ?? "00"}:00Z`;
}

/** Image-editing tools that should never be the producer of a bank or government document. */
export const EDITING_TOOLS = /photoshop|gimp|canva|paint|pixlr|illustrator|ilovepdf edit|pdf ?escape|sejda|smallpdf edit|inkscape|affinity/i;
