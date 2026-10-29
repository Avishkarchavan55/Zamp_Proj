import { sweepUndelivered } from "@/lib/comms";
import { one } from "@/lib/db";

/**
 * Pinged every few minutes by an uptime monitor. Touching the database keeps the free Supabase
 * project from pausing, and the sweep sends any email n8n accepted but never delivered via SMTP.
 */
export async function GET() {
  const t0 = Date.now();
  const db = await one<{ n: number }>("select count(*)::int as n from applications");
  const resent = await sweepUndelivered().catch(() => 0);
  return Response.json({ ok: true, applications: db?.n ?? 0, smtp_fallbacks: resent, ms: Date.now() - t0 });
}
