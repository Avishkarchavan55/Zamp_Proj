import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { geminiJson } from "./ai/gemini";
import { REF_RE } from "./comms";
import { json, query } from "./db";
import { extractDocument, type ReadResult } from "./extractor";
import { FREE_EMAIL_DOMAINS, validateGstin } from "./india";
import { providerLabel } from "./ai/chain";
import { createRun } from "./pipeline";
import { addDocument, audit, createApplication, getApplication, normaliseForm, updateApplicationFields, type IncomingFile } from "./repo";
import type { ApplicationForm, DocSlot, DocType, EntityType, Extraction } from "./types";

/**
 * Intake normaliser: every channel (vendor portal, email, Google Form) ends up as the same
 * application + documents + verification run. Routes call these and then schedule runPipeline().
 */

export interface IntakeResult {
  id: string;
  runId: string | null;
  mode: "new" | "resubmission" | "ignored";
  note?: string;
}

// ---- portal & Google Form: the vendor typed the details ---------------------------------------------

export async function intakeStructured(opts: {
  source: "portal" | "google_form";
  form: Record<string, unknown>;
  files: [DocSlot, IncomingFile][];
  scenario?: string | null;
  meta?: Record<string, unknown>;
}): Promise<IntakeResult> {
  const form = normaliseForm(opts.form);
  const id = await createApplication(form, { scenario: opts.scenario, source: opts.source, intakeMeta: opts.meta });
  for (const [slot, f] of opts.files) await addDocument(id, slot, f);
  const runId = await createRun(id, "submission");
  return { id, runId, mode: "new" };
}

// ---- email: documents first, the vendor confirms afterwards -----------------------------------------

const SLOT_FOR: Partial<Record<DocType, DocSlot>> = {
  certificate_of_incorporation: "incorporation",
  gst_registration_certificate: "gst",
  pan_card: "pan",
  cancelled_cheque: "bank_proof",
  bank_letter: "bank_proof",
  bank_statement: "bank_proof",
  udyam_certificate: "udyam",
};

export interface InboundEmail {
  from: string;
  subject: string;
  text: string;
  messageId?: string;
  auth?: string;
  attachments: IncomingFile[];
}

interface Classified {
  file: IncomingFile;
  read: ReadResult;
  slot: DocSlot | null;
}

/** Reads every attachment once; tiny images (logos, signatures) are ignored. */
async function classifyAttachments(files: IncomingFile[]) {
  const usable = files.filter((f) => /pdf|png|jpe?g|webp/i.test(f.type || f.name) && !(f.bytes.length < 15_000 && !/pdf/i.test(f.type)));
  const out: Classified[] = await Promise.all(
    usable.map(async (file) => {
      const read = await extractDocument(null, {
        mime: file.type, data_b64: file.bytes.toString("base64"), sha256: createHash("sha256").update(file.bytes).digest("hex"),
      });
      return { file, read, slot: SLOT_FOR[read.extraction.detected_type] ?? null };
    }),
  );
  // One document per slot: keep the most confident reading.
  const bySlot = new Map<DocSlot, Classified>();
  const ignored: { name: string; reason: string }[] = files.filter((f) => !usable.includes(f)).map((f) => ({ name: f.name, reason: "not a document (logo or unsupported type)" }));
  for (const c of out) {
    if (!c.slot) {
      ignored.push({ name: c.file.name, reason: c.read.failed ? "could not be read" : `not a registration document (${c.read.extraction.detected_type})` });
      continue;
    }
    const cur = bySlot.get(c.slot);
    if (!cur || c.read.extraction.type_confidence > cur.read.extraction.type_confidence) {
      if (cur) ignored.push({ name: cur.file.name, reason: `duplicate ${c.slot}` });
      bySlot.set(c.slot, c);
    } else ignored.push({ name: c.file.name, reason: `duplicate ${c.slot}` });
  }
  return { bySlot, ignored };
}

/** Normalises only the given keys (normaliseForm fills every field). */
function normalisePartial(fields: Partial<ApplicationForm>): Partial<ApplicationForm> {
  const full = normaliseForm(fields as Record<string, unknown>);
  return Object.fromEntries(Object.keys(fields).map((k) => [k, full[k as keyof ApplicationForm]])) as Partial<ApplicationForm>;
}

/** Certificates print names in capitals; drafts read better (and match how vendors type) in title case. */
const KEEP_UPPER = new Set(["LLP", "OPC", "HUF", "MIDC", "GIDC", "II", "III"]);
function titleCase(s: string) {
  if (!s || s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/[a-z0-9]+/g, (w) => (KEEP_UPPER.has(w.toUpperCase()) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)));
}

const val = (ex: Extraction | undefined, key: string) => ex?.fields.find((f) => f.key === key)?.value ?? "";

function entityFrom(constitution: string, pan: string): EntityType {
  const c = constitution.toLowerCase();
  if (c.includes("proprietor")) return "proprietorship";
  if (c.includes("liability partnership")) return "llp";
  if (c.includes("partnership")) return "partnership";
  if (c.includes("public")) return "public_limited";
  if (c.includes("private") || c.includes("company")) return "private_limited";
  return pan[3] === "P" ? "proprietorship" : pan[3] === "F" ? "partnership" : "private_limited";
}

const BodySchema = z.object({
  contact_name: z.string().default(""),
  contact_phone: z.string().default(""),
  category: z.string().default(""),
  msme_registered: z.enum(["yes", "no", ""]).catch(""),
});

/** A6 — reads the email body for what documents cannot tell us. Falls back to simple patterns. */
async function readEmailBody(from: string, text: string) {
  const display = from.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim() ?? "";
  const phone = text.match(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/)?.[0] ?? "";
  const base = { contact_name: display, contact_phone: phone, category: "", msme_registered: "" as const };
  if (!process.env.GEMINI_API_KEY || !text.trim()) return base;
  try {
    const raw = await geminiJson({
      model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
      parts: [{ text: `A supplier emailed us to register as a vendor. From: ${from}\n---\n${text.slice(0, 4000)}\n---\nExtract only what is written: contact_name (the person writing), contact_phone, category (what they supply, a few words), msme_registered ("yes" if they say they are an MSME / Udyam registered, "no" if they say they are not, else ""). Use "" when not stated.` }],
      schema: {
        type: "OBJECT",
        properties: { contact_name: { type: "STRING" }, contact_phone: { type: "STRING" }, category: { type: "STRING" }, msme_registered: { type: "STRING", enum: ["yes", "no", ""] } },
        required: ["contact_name", "contact_phone", "category", "msme_registered"],
      },
      timeoutMs: 12_000,
    });
    const b = BodySchema.parse(raw);
    return { contact_name: b.contact_name || display, contact_phone: b.contact_phone || phone, category: b.category, msme_registered: b.msme_registered };
  } catch {
    return base;
  }
}

/** Builds a draft application from what the documents say, remembering which document each value came from. */
function draftFromDocuments(bySlot: Map<DocSlot, Classified>) {
  const ex = (s: DocSlot) => bySlot.get(s)?.read.extraction;
  const gst = ex("gst"), ud = ex("udyam");
  const sources: Record<string, DocSlot> = {};
  const pick = (field: string, ...cands: [DocSlot, string][]) => {
    for (const [slot, key] of cands) {
      const v = val(ex(slot), key);
      if (v) {
        sources[field] = slot;
        return v;
      }
    }
    return "";
  };
  const gstin = pick("gstin", ["gst", "gstin"]);
  let panNo = pick("pan", ["pan", "pan"], ["incorporation", "pan"]);
  if (!panNo && gstin && validateGstin(gstin).formatValid) {
    panNo = gstin.slice(2, 12);
    sources.pan = "gst";
  }
  const entity = entityFrom(val(gst, "constitution_of_business"), panNo);
  const proprietor = entity === "proprietorship";
  const legal = proprietor
    ? pick("legal_name", ["gst", "trade_name"], ["bank_proof", "account_holder_name"])
    : pick("legal_name", ["incorporation", "legal_name"], ["gst", "legal_name"], ["pan", "legal_name"]);
  const owner = proprietor ? pick("owner_name", ["pan", "legal_name"], ["gst", "legal_name"]) : "";
  const address = pick("address", ["gst", "address"], ["incorporation", "address"]);
  const state = pick("state", ["gst", "state"], ["incorporation", "state"]);
  const pincode = address.match(/\b\d{6}\b/)?.[0] ?? val(gst, "pincode");
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  const stateIdx = parts.findIndex((p) => state && p.toLowerCase().startsWith(state.toLowerCase()));
  const city = stateIdx > 0 ? parts[stateIdx - 1] : parts.at(-2) ?? "";
  return {
    form: {
      legal_name: titleCase(legal), trade_name: proprietor ? "" : val(gst, "trade_name") !== legal ? val(gst, "trade_name") : "",
      entity_type: entity, owner_name: titleCase(owner), pan: panNo, gstin, cin: pick("cin", ["incorporation", "cin"]),
      address: titleCase(stateIdx > 1 ? parts.slice(0, stateIdx - 1).join(", ") : address), city: titleCase(city), state, pincode,
      bank_account_holder: titleCase(pick("bank_account_holder", ["bank_proof", "account_holder_name"])),
      bank_account_number: pick("bank_account_number", ["bank_proof", "account_number"]),
      bank_ifsc: pick("bank_ifsc", ["bank_proof", "ifsc"]),
      bank_name: titleCase(pick("bank_name", ["bank_proof", "bank_name"])),
      udyam_number: pick("udyam_number", ["udyam", "udyam_number"]),
      msme_category: val(ud, "msme_category"),
      msme_registered: ud ? "yes" : "",
    } as Partial<ApplicationForm>,
    sources,
  };
}

/** Stores the readings made during intake so the pipeline reuses them instead of calling AI again. */
async function seedExtractions(runId: string, applicationId: string, bySlot: Map<DocSlot, Classified>) {
  for (const [slot, c] of bySlot) {
    const sha = createHash("sha256").update(c.file.bytes).digest("hex");
    const [doc] = await query<{ id: string }>(
      `select id from documents where application_id=$1 and slot=$2 and sha256=$3 and not superseded limit 1`, [applicationId, slot, sha],
    );
    if (!doc) continue;
    const ex = c.read.extraction;
    await query(
      `insert into extractions (id, run_id, document_id, slot, detected_type, type_confidence, legibility, fields, notes, model, latency_ms, cached, provider, attempts, pdf)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,false,$12,$13::jsonb,$14::jsonb)`,
      [`EXT-${randomUUID().slice(0, 8)}`, runId, doc.id, slot, ex.detected_type, ex.type_confidence, ex.legibility, json(ex.fields), ex.notes,
        providerLabel(c.read.provider), c.read.attempts.filter((a) => a.ok).reduce((s, a) => s + a.ms, 0), c.read.provider,
        json(c.read.attempts), json(c.read.pdf)],
    );
  }
}

export async function intakeEmail(mail: InboundEmail): Promise<IntakeResult> {
  const fromAddr = (mail.from.match(/<([^>]+)>/)?.[1] ?? mail.from).trim().toLowerCase();
  const refId = mail.subject.match(REF_RE)?.[1];

  // Reply to one of our emails → attachments are a resubmission on that application.
  if (refId) {
    const app = await getApplication(refId);
    if (!app) return { id: refId, runId: null, mode: "ignored", note: "Unknown application reference" };
    const { bySlot, ignored } = await classifyAttachments(mail.attachments);
    if (!bySlot.size) {
      await audit(app.id, "vendor", "email_reply", { from: fromAddr, subject: mail.subject, note: "Reply without usable documents", ignored });
      return { id: app.id, runId: null, mode: "ignored", note: "No documents in reply" };
    }
    for (const [slot, c] of bySlot) await addDocument(app.id, slot, c.file);
    if (app.needs_confirmation) {
      // Still a draft built from documents: fill any blanks from the newly sent documents.
      const { form, sources } = draftFromDocuments(bySlot);
      const blanks = Object.fromEntries(
        Object.entries(form).filter(([k, v]) => v && !String((app as unknown as Record<string, unknown>)[k] ?? "").trim()),
      ) as Partial<ApplicationForm>;
      if (Object.keys(blanks).length) {
        await updateApplicationFields(app.id, normalisePartial(blanks));
        const meta = (app.intake_meta ?? {}) as { field_sources?: Record<string, DocSlot> };
        const merged = { ...meta, field_sources: { ...meta.field_sources, ...Object.fromEntries(Object.keys(blanks).map((k) => [k, sources[k]])) } };
        await query(`update applications set intake_meta=$2::jsonb where id=$1`, [app.id, json(merged)]);
      }
    }
    await audit(app.id, "vendor", "resubmitted", { channel: "email", from: fromAddr, documents: [...bySlot].map(([slot, c]) => ({ slot, filename: c.file.name })), ignored });
    const runId = await createRun(app.id, "resubmission");
    await seedExtractions(runId, app.id, bySlot);
    return { id: app.id, runId, mode: "resubmission" };
  }

  // New vendor by email.
  const { bySlot, ignored } = await classifyAttachments(mail.attachments);
  const [{ form, sources }, body] = await Promise.all([Promise.resolve(draftFromDocuments(bySlot)), readEmailBody(mail.from, mail.text)]);
  const domain = fromAddr.split("@")[1] ?? "";
  const draft = normaliseForm({
    ...form,
    contact_email: fromAddr,
    contact_name: body.contact_name,
    contact_phone: body.contact_phone,
    category: body.category,
    msme_registered: form.msme_registered || body.msme_registered,
    website: FREE_EMAIL_DOMAINS.includes(domain) ? "" : domain,
    legal_name: form.legal_name || (body.contact_name ? `${body.contact_name} (unconfirmed)` : fromAddr),
  });
  const id = await createApplication(draft, {
    source: "email",
    needsConfirmation: true,
    intakeMeta: {
      from: mail.from, subject: mail.subject, message_id: mail.messageId ?? null, auth: mail.auth ?? "",
      field_sources: sources, ignored_attachments: ignored, body_excerpt: mail.text.slice(0, 600),
    },
  });
  for (const [slot, c] of bySlot) await addDocument(id, slot, c.file);
  const runId = await createRun(id, "submission");
  await seedExtractions(runId, id, bySlot);
  return { id, runId, mode: "new" };
}
