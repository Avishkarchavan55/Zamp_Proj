import { after } from "next/server";
import { chainSummary } from "@/lib/ai/chain";
import { requireStaff } from "@/lib/auth";
import { sweepUndelivered } from "@/lib/comms";
import { one, query } from "@/lib/db";
import { appUrl } from "@/lib/http";
import { createRun, runPipeline } from "@/lib/pipeline";

export const maxDuration = 120;

type State = "ok" | "warn" | "error" | "off";
interface Result { step: string; state: State; title: string; detail: string; ms: number }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const n8nBase = () => (process.env.N8N_URL ?? (process.env.N8N_WEBHOOK_URL ? new URL(process.env.N8N_WEBHOOK_URL).origin : "")).replace(/\/$/, "");
const n8nHeaders = () => ({ "X-N8N-API-KEY": process.env.N8N_API_KEY ?? "" });

async function database(): Promise<Omit<Result, "step" | "ms">> {
  const row = await one<{ n: number }>("select count(*)::int as n from applications");
  return { state: "ok", title: "Database", detail: `Connected, ${row?.n ?? 0} applications` };
}

/** Render's free tier sleeps; a request wakes it and the health endpoint answers once it is up. */
async function n8n(): Promise<Omit<Result, "step" | "ms">> {
  const base = n8nBase();
  if (!base) return { state: "off", title: "Email automation (n8n)", detail: "Not configured" };
  const t0 = Date.now();
  for (let i = 0; i < 14; i++) {
    try {
      const res = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const s = Math.round((Date.now() - t0) / 1000);
        return { state: "ok", title: "Email automation (n8n)", detail: s > 3 ? `Woken up in ${s}s` : "Awake" };
      }
    } catch {
      // still starting
    }
    await sleep(3000);
  }
  return { state: "error", title: "Email automation (n8n)", detail: "Did not answer after 60 seconds. Check the Render service." };
}

/**
 * The Gmail inbox. Re-arming the inbox workflow makes n8n read the mailbox right away, so an expired
 * Google connection shows up here instead of silently during a recording. Unread mail is never lost.
 */
async function gmail(): Promise<Omit<Result, "step" | "ms">> {
  const base = n8nBase();
  if (!base || !process.env.N8N_API_KEY) {
    return { state: "warn", title: "Gmail inbox", detail: "Add N8N_URL and N8N_API_KEY in Vercel to check the Gmail connection." };
  }
  const call = async (path: string, method = "GET") => {
    const res = await fetch(`${base}/api/v1${path}`, { method, headers: n8nHeaders(), signal: AbortSignal.timeout(30_000) });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, body: body as Record<string, unknown> };
  };
  const list = await call("/workflows");
  const workflows = ((list.body.data as { id: string; name: string; active: boolean }[]) ?? []);
  const inbound = workflows.find((w) => /inbound vendor email/i.test(w.name));
  const outbound = workflows.find((w) => /communications/i.test(w.name));
  if (!list.ok || !inbound) return { state: "error", title: "Gmail inbox", detail: "Could not read the n8n workflows. Check N8N_API_KEY." };

  let outboundNote = "";
  if (outbound && !outbound.active) {
    const a = await call(`/workflows/${outbound.id}/activate`, "POST");
    outboundNote = a.ok ? " Email sending was off and is now on." : " Email sending is off and could not be started.";
  }
  if (inbound.active) await call(`/workflows/${inbound.id}/deactivate`, "POST");
  let on = await call(`/workflows/${inbound.id}/activate`, "POST");
  if (!on.ok) {
    await sleep(2500);
    on = await call(`/workflows/${inbound.id}/activate`, "POST");
  }
  if (!on.ok) {
    const msg = String(on.body.message ?? "unknown error").slice(0, 160);
    return { state: "error", title: "Gmail inbox", detail: `Could not start watching the inbox: ${msg}. Reconnect the Gmail credential in n8n.${outboundNote}` };
  }
  const recent = await call("/executions?limit=10");
  const failed = ((recent.body.data as { status: string; startedAt: string }[]) ?? []).filter((e) => e.status === "error" && Date.now() - new Date(e.startedAt).getTime() < 3_600_000).length;
  return failed
    ? { state: "warn", title: "Gmail inbox", detail: `Watching the inbox, but ${failed} email run(s) failed in the last hour. Open n8n, Executions.${outboundNote}` }
    : { state: "ok", title: "Gmail inbox", detail: `Connected and watching, checked just now.${outboundNote}` };
}

/** The Google Form link and the endpoint its Apps Script posts to. The script itself runs inside Google. */
async function form(req: Request): Promise<Omit<Result, "step" | "ms">> {
  const link = process.env.NEXT_PUBLIC_GOOGLE_FORM_URL;
  const notes: string[] = [];
  let state: State = "ok";
  if (link) {
    try {
      const res = await fetch(link, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
      if (res.status >= 500) { state = "warn"; notes.push(`Google answered ${res.status}`); } else notes.push("Form link is reachable");
    } catch {
      state = "warn";
      notes.push("Could not reach the form link");
    }
  } else {
    state = "warn";
    notes.push("Form link is not set");
  }
  try {
    const res = await fetch(`${appUrl(req)}/api/intake/form`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-vendoriq-secret": process.env.INTAKE_SHARED_SECRET ?? "" },
      body: JSON.stringify({ fields: {} }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 400) notes.push("intake accepts the secret");
    else { state = "error"; notes.push(`intake answered ${res.status}, check INTAKE_SHARED_SECRET`); }
  } catch {
    state = "error";
    notes.push("intake endpoint did not answer");
  }
  if (state === "ok") notes.push("if a response ever fails to appear, open the form's Apps Script, Executions");
  return { state, title: "Google Form", detail: notes.join("; ") };
}

async function ai(): Promise<Omit<Result, "step" | "ms">> {
  const providers = chainSummary().filter((p) => p.configured).length;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { state: providers ? "warn" : "error", title: "Document readers (AI)", detail: `${providers} backup reader(s) configured, no Gemini key` };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${key}`, { signal: AbortSignal.timeout(10_000) });
    if (res.ok) return { state: "ok", title: "Document readers (AI)", detail: `Gemini key works, ${providers} readers in the chain` };
    return { state: providers > 1 ? "warn" : "error", title: "Document readers (AI)", detail: `Gemini answered ${res.status}; ${providers - 1} backup readers will be used` };
  } catch {
    return { state: "warn", title: "Document readers (AI)", detail: "Gemini did not answer; backup readers will be used" };
  }
}

/** Anything that got stuck: emails n8n accepted but never delivered, and runs that never finished. */
async function repairs(req: Request): Promise<Omit<Result, "step" | "ms">> {
  const resent = await sweepUndelivered().catch(() => 0);
  const stuck = await query<{ id: string; application_id: string }>(
    `select id, application_id from runs where status = 'running' and started_at < now() - interval '10 minutes'`,
  );
  const base = appUrl(req);
  for (const r of stuck) {
    await query(`update runs set status = 'failed', finished_at = now(), error = 'Stuck: restarted from Wake up' where id = $1`, [r.id]);
    const runId = await createRun(r.application_id, "manual_rerun");
    after(() => runPipeline(runId, base));
  }
  const fixed = [resent ? `${resent} stalled email(s) sent directly` : "", stuck.length ? `${stuck.length} stuck run(s) restarted` : ""].filter(Boolean);
  return fixed.length
    ? { state: "warn", title: "Stuck items", detail: `Fixed: ${fixed.join(", ")}` }
    : { state: "ok", title: "Stuck items", detail: "Nothing stuck: no stalled emails or runs" };
}

const STEPS: Record<string, (req: Request) => Promise<Omit<Result, "step" | "ms">>> = { database, n8n, gmail, form, ai, repairs };

/** One system per call, so the page can show each result as soon as it is ready. */
export async function POST(req: Request) {
  // The sign-in check touches the database; several steps arrive together, so retry a busy pooler once.
  let staff: Awaited<ReturnType<typeof requireStaff>>;
  try {
    staff = await requireStaff();
  } catch {
    await sleep(600);
    try {
      staff = await requireStaff();
    } catch {
      return Response.json({ step: "", state: "warn", title: "Wake up", detail: "Database was busy, try again", ms: 0 }, { status: 503 });
    }
  }
  if (staff instanceof Response) return staff;
  const step = new URL(req.url).searchParams.get("step") ?? "";
  const run = STEPS[step];
  if (!run) return Response.json({ error: "Unknown step" }, { status: 400 });
  const t0 = Date.now();
  try {
    const r = await run(req);
    return Response.json({ step, ...r, ms: Date.now() - t0 } satisfies Result);
  } catch (e) {
    return Response.json({ step, state: "error", title: step, detail: e instanceof Error ? e.message.slice(0, 200) : "Failed", ms: Date.now() - t0 } satisfies Result);
  }
}
