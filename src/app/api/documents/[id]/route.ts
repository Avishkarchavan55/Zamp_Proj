import { one } from "@/lib/db";
import { bad } from "@/lib/http";
import { getDocumentBytes } from "@/lib/storage";

export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  const doc = await one<{ filename: string; mime: string; data_b64: string | null; storage_path: string | null }>(
    "select filename, mime, data_b64, storage_path from documents where id=$1", [id],
  );
  if (!doc) return bad("Not found", 404);
  const bytes = await getDocumentBytes(doc);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": doc.mime,
      "content-disposition": `inline; filename="${doc.filename.replace(/"/g, "")}"`,
      "cache-control": "private, max-age=3600",
    },
  });
}
