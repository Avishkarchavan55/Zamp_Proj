import { query } from "@/lib/db";

export async function GET() {
  return Response.json(
    await query(
      `select c.*, a.legal_name from communications c join applications a on a.id = c.application_id
        order by c.created_at desc limit 200`,
    ),
  );
}
