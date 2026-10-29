import { renderPdfPages } from "@/lib/ai/pdf";
import { one } from "@/lib/db";
import { bad } from "@/lib/http";
import { getDocumentBytes } from "@/lib/storage";

/**
 * Page-1 image of a document for the evidence viewer. Images are returned as-is; PDFs are rendered,
 * so field locations (box_2d from the document AI) can be drawn over both.
 */
const cache = new Map<string, Buffer>();

export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[id]/preview">) {
  const { id } = await ctx.params;
  const doc = await one<{ mime: string; data_b64: string | null; storage_path: string | null }>(
    "select mime, data_b64, storage_path from documents where id=$1", [id],
  );
  if (!doc) return bad("Not found", 404);
  let png = cache.get(id);
  let mime = "image/png";
  if (!png) {
    const bytes = await getDocumentBytes(doc);
    if (doc.mime === "application/pdf") {
      png = Buffer.from((await renderPdfPages(new Uint8Array(bytes), 1, 1.5))[0], "base64");
    } else {
      png = bytes;
      mime = doc.mime;
    }
    if (cache.size > 200) cache.clear();
    cache.set(id, png);
  } else if (doc.mime !== "application/pdf") mime = doc.mime;
  return new Response(new Uint8Array(png), { headers: { "content-type": mime, "cache-control": "private, max-age=3600" } });
}
