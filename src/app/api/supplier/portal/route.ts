import { query } from "@/lib/db";
import { requireSupplier, supplierApplications } from "@/lib/supplier";

/** The signed-in supplier's applications and unread notification count. */
export async function GET() {
  const s = await requireSupplier();
  if (s instanceof Response) return s;
  const [applications, unread] = await Promise.all([
    supplierApplications(s.email),
    query<{ n: number }>(
      `select count(*)::int as n from notifications n join applications a on a.id = n.application_id
        where lower(a.contact_email) = $1 and n.read_at is null`, [s.email],
    ),
  ]);
  return Response.json({ email: s.email, applications, unread: unread[0]?.n ?? 0 });
}
