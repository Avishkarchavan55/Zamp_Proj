import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { bad } from "@/lib/http";
import { SUPPLIER_COOKIE, signSupplier, supplierCookieOptions } from "@/lib/supplier-session";

/** Best-effort throttle per client (per server instance): 10 tries every 10 minutes. */
const tries = new Map<string, { n: number; since: number }>();

/**
 * Supplier sign-in: the application reference and the contact email the supplier gave on it.
 * (Production would add an emailed one-time code; the reference alone is guessable, so the email is required too.)
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const t = tries.get(ip);
  if (t && now - t.since < 600_000 && t.n >= 10) return bad("Too many attempts. Please wait a few minutes and try again.", 429);
  tries.set(ip, t && now - t.since < 600_000 ? { n: t.n + 1, since: t.since } : { n: 1, since: now });

  const body = (await req.json().catch(() => ({}))) as { reference?: string; email?: string; pick?: string };

  // One-click entry: choose a supplier from the list on the sign-in page (same open access as the company portal).
  if (body.pick) {
    const [row] = await query<{ contact_email: string }>(`select contact_email from applications where upper(id) = $1`, [String(body.pick).trim().toUpperCase()]);
    if (!row?.contact_email) return bad("That supplier could not be found.", 404);
    (await cookies()).set(SUPPLIER_COOKIE, await signSupplier(row.contact_email), supplierCookieOptions);
    return Response.json({ ok: true });
  }

  const reference = String(body.reference ?? "").trim().toUpperCase();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!reference || !email) return bad("Enter your application reference and the contact email you gave.");

  const [hit] = await query<{ id: string }>(
    `select id from applications where upper(id) = $1 and lower(contact_email) = $2`, [reference, email],
  );
  if (!hit) {
    await new Promise((r) => setTimeout(r, 400));
    return bad("We could not find an application with that reference and contact email. Please check both.", 401);
  }
  (await cookies()).set(SUPPLIER_COOKIE, await signSupplier(email), supplierCookieOptions);
  return Response.json({ ok: true });
}
