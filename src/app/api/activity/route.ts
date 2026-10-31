import { query } from "@/lib/db";
import { tidyJson } from "@/lib/tidy";

/** The audit trail across all vendors, newest first (staff only: the proxy guards every non-public /api route). */
export async function GET(req: Request) {
  const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit") ?? 150) || 150, 1), 500);
  const rows = await query(
    `select l.id, l.ts, l.actor, l.action, l.detail, l.application_id, a.legal_name
       from audit_log l left join applications a on a.id = l.application_id
      order by l.ts desc, l.id desc limit $1`,
    [limit],
  );
  return Response.json(tidyJson(rows));
}
