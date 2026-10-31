import { query } from "@/lib/db";
import { requireSupplier } from "@/lib/supplier";

/** Newest first, across every application registered under the supplier's email. */
export async function GET() {
  const s = await requireSupplier();
  if (s instanceof Response) return s;
  return Response.json(
    await query(
      `select n.id, n.kind, n.title, n.body, n.link, n.created_at, n.read_at, a.id as application_id, a.legal_name
         from notifications n join applications a on a.id = n.application_id
        where lower(a.contact_email) = $1 order by n.created_at desc limit 100`, [s.email],
    ),
  );
}
