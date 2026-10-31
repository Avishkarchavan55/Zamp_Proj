import { query } from "@/lib/db";
import { tidyJson } from "@/lib/tidy";

export async function GET() {
  return Response.json(
    tidyJson(
      await query(
        `select c.*, a.legal_name from communications c join applications a on a.id = c.application_id
          order by c.created_at desc limit 200`,
      ),
    ),
  );
}
