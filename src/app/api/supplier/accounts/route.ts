import { query } from "@/lib/db";
import { publicStatus } from "@/lib/supplier";

/** Suppliers shown on the sign-in page for one-click entry: one row per contact, newest application first. */
export async function GET() {
  const rows = await query<{ id: string; legal_name: string; status: string; notes: number }>(
    `select distinct on (lower(a.contact_email)) a.id, a.legal_name, a.status,
            (select count(*)::int from notifications n where n.application_id = a.id) as notes
       from applications a
      where a.contact_email is not null and a.contact_email <> ''
      order by lower(a.contact_email), a.created_at desc`,
  );
  const list = rows
    .sort((x, y) => y.notes - x.notes || y.id.localeCompare(x.id))
    .slice(0, 12)
    .map((r) => ({ id: r.id, legal_name: r.legal_name, status: publicStatus(r.status).label }));
  return Response.json(list);
}
