import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Service-role client for Storage and Realtime broadcasts. Null when Supabase is not configured. */
let admin: SupabaseClient | null | undefined;

export function supabaseAdmin(): SupabaseClient | null {
  if (admin !== undefined) return admin;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = serverKey();
  admin = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return admin;
}

/** Supports both the legacy service_role key and the newer sb_secret_ key. */
export const serverKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

export const DOCUMENT_BUCKET = process.env.SUPABASE_BUCKET ?? "vendor-documents";

/**
 * Pushes a tiny "something changed" signal to browsers watching a run. No data travels over the
 * public channel — the page refetches through the authenticated API.
 */
export async function broadcast(topic: string, payload: Record<string, unknown> = {}) {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = serverKey();
  if (!url || !key) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      // New sb_secret_ keys are not JWTs and go in `apikey` only; legacy JWT keys also need Authorization.
      headers: { "content-type": "application/json", apikey: key, ...(key.startsWith("sb_") ? {} : { authorization: `Bearer ${key}` }) },
      body: JSON.stringify({ messages: [{ topic, event: "update", payload }] }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Realtime is a nicety; the page falls back to polling.
  }
}
