import { after } from "next/server";
import { requireStaff } from "@/lib/auth";
import { appUrl, bad } from "@/lib/http";
import { createRun, runPipeline } from "@/lib/pipeline";
import { audit, getApplication } from "@/lib/repo";

export const maxDuration = 300;

export async function POST(req: Request, ctx: RouteContext<"/api/applications/[id]/rerun">) {
  const staff = await requireStaff();
  if (staff instanceof Response) return staff;
  const { id } = await ctx.params;
  const app = await getApplication(id);
  if (!app) return bad("Not found", 404);
  if (app.status === "processing") return bad("A run is already in progress", 409);
  await audit(id, staff.name, "manual_rerun", {});
  const runId = await createRun(id, "manual_rerun");
  const base = appUrl(req);
  after(() => runPipeline(runId, base));
  return Response.json({ runId });
}
