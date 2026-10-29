import { after } from "next/server";
import { query } from "@/lib/db";
import { SLOTS, appUrl, bad, validateFile } from "@/lib/http";
import { createRun, runPipeline } from "@/lib/pipeline";
import { BUYER } from "@/lib/policy";
import { FORM_FIELDS, addDocument, audit, getApplicationByToken, normaliseForm, updateApplicationFields } from "@/lib/repo";
import type { ApplicationForm } from "@/lib/types";

export const maxDuration = 300;

/** Vendor-facing view: only what the vendor needs to see — never internal check details. */
export async function GET(_req: Request, ctx: RouteContext<"/api/vendor/[token]">) {
  const { token } = await ctx.params;
  const app = await getApplicationByToken(token);
  if (!app) return bad("This link is not valid.", 404);
  const docs = await query(
    `select slot, filename, uploaded_at from documents where application_id=$1 and not superseded order by slot`, [app.id],
  );
  const form = Object.fromEntries(FORM_FIELDS.map((f) => [f, app[f] ?? ""]));
  return Response.json({
    buyer: BUYER.name,
    id: app.id,
    legal_name: app.legal_name,
    contact_name: app.contact_name,
    status: app.status,
    scenario: app.scenario,
    source: app.source,
    needs_confirmation: app.needs_confirmation,
    requested_items: app.status === "awaiting_vendor" ? app.decision?.requested_items ?? [] : [],
    documents: docs,
    form,
  });
}

export async function POST(req: Request, ctx: RouteContext<"/api/vendor/[token]">) {
  const { token } = await ctx.params;
  const app = await getApplicationByToken(token);
  if (!app) return bad("This link is not valid.", 404);
  if (app.status !== "awaiting_vendor") return bad("This application is not waiting for any information from you.", 409);

  const data = await req.formData();
  const rawFields = JSON.parse(String(data.get("fields") ?? "{}")) as Record<string, string>;
  const normalised = normaliseForm({ ...app, ...rawFields });
  const changed: Partial<ApplicationForm> = {};
  for (const k of Object.keys(rawFields) as (keyof ApplicationForm)[]) {
    if (FORM_FIELDS.includes(k) && normalised[k] !== app[k]) (changed as Record<string, unknown>)[k] = normalised[k];
  }

  const files: [(typeof SLOTS)[number], File][] = [];
  for (const slot of SLOTS) {
    const f = data.get(slot);
    if (f instanceof File && f.size > 0) {
      const err = validateFile(f);
      if (err) return bad(err);
      files.push([slot, f]);
    }
  }
  // Email intake: the vendor reviews the details we read from their documents and confirms them.
  const confirming = app.needs_confirmation && data.get("confirm") === "true";
  if (!confirming && !files.length && !Object.keys(changed).length) return bad("Please upload a document or correct a field before submitting.");

  await updateApplicationFields(app.id, changed);
  for (const [slot, f] of files) await addDocument(app.id, slot, f);
  if (confirming) await query(`update applications set needs_confirmation=false, updated_at=now() where id=$1`, [app.id]);
  await audit(app.id, "vendor", confirming ? "details_confirmed" : "resubmitted", {
    documents: files.map(([slot, f]) => ({ slot, filename: f.name })),
    fields: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, { from: app[k as keyof ApplicationForm], to: v }])),
  });
  const runId = await createRun(app.id, confirming ? "confirmation" : "resubmission");
  const base = appUrl(req);
  after(() => runPipeline(runId, base));
  return Response.json({ ok: true, runId });
}
