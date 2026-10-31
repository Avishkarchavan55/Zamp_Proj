import "server-only";
import fs from "node:fs";
import path from "node:path";
import { chainSummary, readDocument, type Attempt } from "./ai/chain";
import { inspectPdf, type PdfInfo } from "./ai/pdf";
import type { DocSlot, Extraction } from "./types";

/**
 * Document intelligence entry point. Two modes:
 *  - "chain"   (default when any AI key is configured): the provider fallback chain in ./ai/chain.ts
 *  - "fixture" (offline test mode): returns the generator's ground truth for known demo files.
 *              Never used silently - runs and the UI are labelled when it is on.
 * Never throws: if nothing can read a document it comes back as "illegible" and a human takes over.
 */

export interface ReadResult {
  extraction: Extraction;
  provider: string;
  attempts: Attempt[];
  pdf: Omit<PdfInfo, "text"> | null;
  failed: boolean;
}

const anyAiKey = () => !!(process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || (process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN));

export function extractorMode(): "chain" | "fixture" {
  if (process.env.EXTRACTOR === "fixture") return "fixture";
  if (process.env.EXTRACTOR === "chain") return "chain";
  return anyAiKey() ? "chain" : "fixture";
}

export function extractorLabel() {
  if (extractorMode() === "fixture") return "Fixture extractor (test mode)";
  const first = chainSummary().find((p) => p.configured);
  return first ? `${first.label} + fallbacks` : "No AI configured";
}

export async function extractDocument(
  slot: DocSlot | null,
  file: { mime: string; data_b64: string; sha256: string },
): Promise<ReadResult> {
  const bytes = new Uint8Array(Buffer.from(file.data_b64, "base64"));
  if (extractorMode() === "fixture") {
    const t0 = Date.now();
    const extraction = await extractWithFixture(file.sha256);
    const pdf = file.mime === "application/pdf" ? await inspectPdf(bytes).then((p) => ({ ...p, text: undefined })).catch(() => null) : null;
    return { extraction, provider: "fixture", attempts: [{ provider: "fixture", ok: true, ms: Date.now() - t0 }], pdf, failed: false };
  }
  try {
    const r = await readDocument(slot, { mime: file.mime, b64: file.data_b64, bytes });
    return { ...r, failed: false };
  } catch (err) {
    const e = err as Error & { attempts?: Attempt[]; pdf?: ReadResult["pdf"] };
    return {
      extraction: {
        detected_type: "other",
        type_confidence: 0,
        legibility: "illegible",
        fields: [],
        notes: "No AI provider or fallback could read this document automatically - a reviewer must read it.",
      },
      provider: "none",
      attempts: e.attempts ?? [],
      pdf: e.pdf ?? null,
      failed: true,
    };
  }
}

let truthCache: Record<string, Extraction> | null = null;

async function extractWithFixture(sha256: string): Promise<Extraction> {
  if (!truthCache) {
    const file = path.join(process.cwd(), "fixtures", "truth.json");
    truthCache = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  }
  await new Promise((r) => setTimeout(r, 500 + Math.random() * 600));
  return (
    truthCache![sha256] ?? {
      detected_type: "other",
      type_confidence: 0,
      legibility: "illegible",
      fields: [],
      notes: "Fixture extractor has no ground truth for this file. Configure an AI key to read real uploads.",
    }
  );
}
