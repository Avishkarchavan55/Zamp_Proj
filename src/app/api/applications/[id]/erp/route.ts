import { requireStaff } from "@/lib/auth";
import { buildVendorMaster, toCsv } from "@/lib/erp";
import { bad } from "@/lib/http";
import { audit, getApplication } from "@/lib/repo";

/** ERP vendor master record for an approved vendor (?format=csv for a file download). */
export async function GET(req: Request, ctx: RouteContext<"/api/applications/[id]/erp">) {
  const staff = await requireStaff();
  if (staff instanceof Response) return staff;
  const { id } = await ctx.params;
  const app = await getApplication(id);
  if (!app) return bad("Not found", 404);
  if (app.status !== "approved" || !app.decision) return bad("Only approved vendors can be exported to the ERP", 409);
  const rec = await buildVendorMaster(app);
  if (new URL(req.url).searchParams.get("format") === "csv") {
    await audit(id, staff.name, "erp_exported", { vendor_code: rec.vendor_code, format: "csv" });
    return new Response(toCsv(rec), {
      headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="${rec.vendor_code}-${id}.csv"` },
    });
  }
  return Response.json(rec);
}
