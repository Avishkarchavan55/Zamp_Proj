import { query } from "@/lib/db";
import { requireSupplier } from "@/lib/supplier";

export async function POST() {
  const s = await requireSupplier();
  if (s instanceof Response) return s;
  await query(
    `update notifications set read_at = now() where read_at is null and application_id in
       (select id from applications where lower(contact_email) = $1)`, [s.email],
  );
  return Response.json({ ok: true });
}
