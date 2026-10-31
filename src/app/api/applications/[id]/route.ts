import { bad } from "@/lib/http";
import { tidyJson } from "@/lib/tidy";
import { getApplicationDetail } from "@/lib/repo";

export async function GET(_req: Request, ctx: RouteContext<"/api/applications/[id]">) {
  const { id } = await ctx.params;
  const detail = await getApplicationDetail(id);
  if (!detail) return bad("Not found", 404);
  return Response.json(tidyJson(detail));
}
