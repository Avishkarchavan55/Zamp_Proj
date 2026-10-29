import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { json, one, query } from "./db";
import { MANUAL_MINUTES } from "./policy";
import { putDocumentBytes } from "./storage";
import type { Application, ApplicationForm, DocSlot, IntakeSource } from "./types";

export const FORM_FIELDS: (keyof ApplicationForm)[] = [
  "legal_name", "trade_name", "entity_type", "owner_name", "pan", "gstin", "cin", "address", "city", "state", "pincode",
  "contact_name", "contact_email", "contact_phone", "website", "category", "bank_account_holder",
  "bank_account_number", "bank_ifsc", "bank_name", "msme_registered", "udyam_number", "msme_category",
];

const UPPER_FIELDS = new Set(["pan", "gstin", "cin", "bank_ifsc", "udyam_number"]);

export function normaliseForm(input: Record<string, unknown>): ApplicationForm {
  const out: Record<string, string> = {};
  for (const f of FORM_FIELDS) {
    let v = String(input[f] ?? "").trim();
    if (UPPER_FIELDS.has(f)) v = v.toUpperCase().replace(/\s+/g, "");
    if (f === "contact_email" || f === "msme_registered") v = v.toLowerCase();
    if (f === "bank_account_number") v = v.replace(/\s+/g, "");
    out[f] = v;
  }
  return out as unknown as ApplicationForm;
}

export async function audit(applicationId: string, actor: string, action: string, detail?: unknown) {
  await query(`insert into audit_log (application_id, actor, action, detail) values ($1,$2,$3,$4::jsonb)`, [
    applicationId, actor, action, json(detail ?? null),
  ]);
}

export async function createApplication(
  form: ApplicationForm,
  opts: { scenario?: string | null; source?: IntakeSource; needsConfirmation?: boolean; intakeMeta?: unknown } = {},
): Promise<string> {
  const [{ n }] = await query<{ n: string }>("select nextval('application_seq')::text as n");
  const id = `VEN-${new Date().getFullYear()}-${n.padStart(5, "0")}`;
  const token = randomBytes(18).toString("base64url");
  const cols = FORM_FIELDS;
  await query(
    `insert into applications (id, status, resubmit_token, scenario, source, needs_confirmation, intake_meta, ${cols.join(", ")})
     values ($1, 'processing', $2, $3, $4, $5, $6::jsonb, ${cols.map((_, i) => `$${i + 7}`).join(", ")})`,
    [id, token, opts.scenario ?? null, opts.source ?? "portal", opts.needsConfirmation ?? false, json(opts.intakeMeta ?? null),
      ...cols.map((c) => form[c] ?? null)],
  );
  await audit(id, "vendor", "submitted", { legal_name: form.legal_name, contact_email: form.contact_email, channel: opts.source ?? "portal" });
  return id;
}

export async function updateApplicationFields(id: string, fields: Partial<ApplicationForm>) {
  const entries = Object.entries(fields).filter(([k]) => FORM_FIELDS.includes(k as keyof ApplicationForm));
  if (!entries.length) return;
  await query(
    `update applications set ${entries.map(([k], i) => `${k}=$${i + 2}`).join(", ")}, updated_at=now() where id=$1`,
    [id, ...entries.map(([, v]) => v)],
  );
}

export interface IncomingFile {
  name: string;
  type: string;
  bytes: Buffer;
}

export async function toIncoming(file: File): Promise<IncomingFile> {
  return { name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) };
}

export async function addDocument(applicationId: string, slot: DocSlot, file: IncomingFile | File) {
  const f = file instanceof File ? await toIncoming(file) : file;
  const buf = f.bytes;
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const prev = await one<{ version: number }>(
    `select coalesce(max(version),0)::int as version from documents where application_id=$1 and slot=$2`, [applicationId, slot],
  );
  await query(`update documents set superseded=true where application_id=$1 and slot=$2`, [applicationId, slot]);
  const mime = f.type || mimeFromName(f.name);
  const id = `DOC-${randomUUID().slice(0, 8)}`;
  const stored = await putDocumentBytes(applicationId, id, f.name, mime, buf);
  await query(
    `insert into documents (id, application_id, slot, filename, mime, size, sha256, data_b64, storage_path, version)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, applicationId, slot, f.name, mime, buf.length, sha256, stored.data_b64, stored.storage_path, (prev?.version ?? 0) + 1],
  );
  return id;
}

export function mimeFromName(name: string) {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  return "image/png";
}

export async function getApplication(id: string) {
  return one<Application>("select * from applications where id=$1", [id]);
}

export async function getApplicationByToken(token: string) {
  return one<Application>("select * from applications where resubmit_token=$1", [token]);
}

export async function listApplications() {
  return query(
    `select a.id, a.legal_name, a.entity_type, a.city, a.state, a.status, a.created_at, a.updated_at, a.flags,
            a.decision->>'headline' as headline, a.decision->'reasons' as reasons, a.decision->'requested_items' as requested_items,
            a.decided_by, a.contact_email, a.category, a.scenario, a.source, a.needs_confirmation,
            jsonb_array_length(coalesce(a.decision->'requested_items','[]'::jsonb)) as requested_count,
            jsonb_array_length(coalesce(a.decision->'reasons','[]'::jsonb)) as reason_count,
            r.duration_ms, r.status as run_status
       from applications a left join runs r on r.id = a.latest_run_id
      order by a.created_at desc`,
  );
}

export async function getApplicationDetail(id: string) {
  const app = await getApplication(id);
  if (!app) return null;
  const [documents, runs, communications, auditLog] = await Promise.all([
    query(`select id, slot, filename, mime, size, sha256, version, superseded, uploaded_at from documents where application_id=$1 order by slot, version desc`, [id]),
    query(`select id, trigger, status, started_at, finished_at, duration_ms, outcome, extractor from runs where application_id=$1 order by started_at desc`, [id]),
    query(`select * from communications where application_id=$1 order by created_at desc`, [id]),
    query(`select * from audit_log where application_id=$1 order by ts desc, id desc`, [id]),
  ]);
  const latestRun = app.latest_run_id ? await getRunDetail(app.latest_run_id) : null;
  return { app, documents, runs, communications, audit: auditLog, latestRun };
}

export async function getRunDetail(runId: string) {
  const run = await one(
    `select r.*, a.legal_name, a.entity_type, a.status as application_status
       from runs r join applications a on a.id = r.application_id where r.id=$1`, [runId],
  );
  if (!run) return null;
  const [events, checks, extractions] = await Promise.all([
    query(`select id, ts, stage, level, message, data from run_events where run_id=$1 order by id`, [runId]),
    query(`select id, code, category, label, status, severity, route, message, evidence, rule from checks where run_id=$1 order by id`, [runId]),
    query(
      `select e.id, e.document_id, e.slot, e.detected_type, e.type_confidence, e.legibility, e.fields, e.notes, e.model, e.latency_ms, e.cached,
              e.provider, e.attempts, e.pdf,
              d.filename, d.mime
         from extractions e join documents d on d.id = e.document_id where e.run_id=$1 order by e.slot`, [runId],
    ),
  ]);
  return { run, events, checks, extractions };
}

export async function getStats() {
  const [statusCounts, runs, topIssues, activity, daily] = await Promise.all([
    query<{ status: string; n: number }>(`select status, count(*)::int as n from applications group by status`),
    one<{ total: number; avg_ms: number; auto: number }>(
      `select count(*)::int as total, coalesce(avg(duration_ms),0)::int as avg_ms,
              count(*) filter (where outcome in ('approved','rejected','awaiting_vendor'))::int as auto
         from runs where status='completed'`,
    ),
    query<{ code: string; label: string; n: number }>(
      `select c.code, min(c.label) as label, count(distinct c.application_id)::int as n
         from checks c join applications a on a.latest_run_id = c.run_id
        where c.status in ('failed','warning') and c.route <> 'none'
        group by c.code order by n desc limit 6`,
    ),
    query(
      `select l.id, l.ts, l.actor, l.action, l.detail, l.application_id, a.legal_name
         from audit_log l join applications a on a.id = l.application_id
        order by l.ts desc, l.id desc limit 12`,
    ),
    query<{ day: string; n: number }>(
      `select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*)::int as n
         from applications where created_at > now() - interval '14 days' group by 1 order by 1`,
    ),
  ]);
  const effort = await one<{ apps: number; emails: number; reviews: number; avg_run_ms: number }>(
    `select (select count(*) from applications where status <> 'processing')::int as apps,
            (select count(*) from communications where status in ('sent','queued') and kind <> 'review_alert')::int as emails,
            (select count(*) from applications where status = 'in_review' or decided_by not in ('policy_engine'))::int as reviews,
            (select coalesce(avg(duration_ms),0) from runs where status='completed')::int as avg_run_ms`,
  );
  const manual = (effort?.apps ?? 0) * MANUAL_MINUTES.reviewPerApplication + (effort?.emails ?? 0) * MANUAL_MINUTES.perVendorEmail;
  const human = (effort?.reviews ?? 0) * MANUAL_MINUTES.perReviewCase;
  const timeSaved = { manual_minutes: manual, human_minutes: human, saved_minutes: Math.max(0, manual - human), assumptions: MANUAL_MINUTES };
  const sources = await query<{ source: string; n: number }>(`select source, count(*)::int as n from applications group by source`);
  const comms = await one<{ total: number; sent: number; reminders: number }>(
    `select count(*)::int as total, count(*) filter (where status='sent')::int as sent,
            count(*) filter (where kind='reminder')::int as reminders from communications`,
  );
  return { statusCounts, runs, topIssues, activity, daily, comms, timeSaved, sources };
}
