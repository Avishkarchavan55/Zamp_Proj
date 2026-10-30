import { chainSummary } from "@/lib/ai/chain";
import { n8nConfigured, smtpConfigured } from "@/lib/comms";
import { extractorLabel, extractorMode } from "@/lib/extractor";
import { COMMS } from "@/lib/policy";
import { storageMode } from "@/lib/storage";

export async function GET() {
  return Response.json({
    extractor: extractorMode(),
    extractor_label: extractorLabel(),
    ai_chain: chainSummary(),
    n8n: n8nConfigured(),
    smtp: smtpConfigured(),
    database: process.env.DATABASE_URL ? "postgres" : "pglite",
    storage: storageMode(),
    realtime: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    turnstile: !!process.env.TURNSTILE_SECRET_KEY,
    email_override: !!process.env.EMAIL_OVERRIDE_TO,
    procurement_alerts: !!process.env.PROCUREMENT_EMAIL,
    reminders: COMMS,
    // Shown on the overview so the team knows where vendors can email their documents.
    intake_email: process.env.INTAKE_EMAIL || process.env.SMTP_USER || null,
  });
}
