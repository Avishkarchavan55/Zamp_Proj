import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { geminiJson } from "./ai/gemini";
import { REF_RE } from "./comms";
import { json, query } from "./db";
import { extractDocument, type ReadResult } from "./extractor";
import { draftFromDocuments } from "./draft";
import { FREE_EMAIL_DOMAINS } from "./india";
import { providerLabel } from "./ai/chain";
import { createRun } from "./pipeline";
import { addDocument, audit, createApplication, getApplication, normaliseForm, type IncomingFile } from "./repo";
import type { DocSlot, DocType } from "./types";

/**
 * Intake normaliser: every channel (vendor portal, email, Google Form) ends up as the same
 * application + documents + verification run. Routes call these and then schedule runPipeline().
 */

export interface IntakeResult {
  id: string;
  runId: string | null;
  mode: "new" | "resubmission" | "ignored";
  note?: string;
  /** Set when a new email had nothing usable: the sender should be told what to attach. */
  help?: { ignored: string[] };
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

/** When the model calls a document "other", its fields still tell us what it is (a GSTIN → GST certificate, …). */
function slotFromFields(read: ReadResult): DocSlot | null {
  if (read.failed) return null;
  const has = new Set(read.extraction.fields.map((f) => f.key));
  if (has.has("udyam_number")) return "udyam";
  if (has.has("gstin")) return "gst";
  if (has.has("cin")) return "incorporation";
  if (has.has("account_number") && has.has("ifsc")) return "bank_proof";
  if (has.has("pan") && (has.has("father_name") || has.has("date_of_birth"))) return "pan";
  return null;
}

/** Reads every attachment once; tiny images (logos, signatures) are ignored. */
async function classifyAttachments(files: IncomingFile[]) {
  const usable = files.filter((f) => /pdf|png|jpe?g|webp/i.test(f.type || f.name) && !(f.bytes.length < 15_000 && !/pdf/i.test(f.type)));
  const out: Classified[] = await Promise.all(
    usable.map(async (file) => {
      const read = await extractDocument(null, {
        mime: file.type, data_b64: file.bytes.toString("base64"), sha256: createHash("sha256").update(file.bytes).digest("hex"),
      });
      return { file, read, slot: SLOT_FOR[read.extraction.detected_type] ?? slotFromFields(read) };
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

const BodySchema = z.object({
  contact_name: z.string().default(""),
  contact_phone: z.string().default(""),
  category: z.string().default(""),
  msme_registered: z.enum(["yes", "no", ""]).catch(""),
});

/** A6 - reads the email body for what documents cannot tell us. Falls back to simple patterns. */
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

/** Documents emailed for an application that already exists: stored, then re-checked (unless nothing is new). */
async function addToApplication(appId: string, bySlot: Map<DocSlot, Classified>, ignored: { name: string; reason: string }[], fromAddr: string, subject: string): Promise<IntakeResult> {
  if (!bySlot.size) {
    await audit(appId, "vendor", "email_reply", { from: fromAddr, subject, note: "Email without usable documents", ignored });
    return { id: appId, runId: null, mode: "ignored", note: "No documents in email" };
  }
  let added = 0;
  for (const [slot, c] of bySlot) if ((await addDocument(appId, slot, c.file)).added) added++;
  if (!added) {
    // e.g. Gmail re-attaching the original files: nothing new, so no new check and no new email.
    await audit(appId, "vendor", "email_reply", { from: fromAddr, subject, note: "Email only contained documents already on file", ignored });
    return { id: appId, runId: null, mode: "ignored", note: "No new documents in email" };
  }
  await audit(appId, "vendor", "resubmitted", { channel: "email", from: fromAddr, documents: [...bySlot].map(([slot, c]) => ({ slot, filename: c.file.name })), ignored });
  const runId = await createRun(appId, "resubmission");
  await seedExtractions(runId, appId, bySlot);
  return { id: appId, runId, mode: "resubmission" };
}

export async function intakeEmail(mail: InboundEmail): Promise<IntakeResult> {
  const fromAddr = (mail.from.match(/<([^>]+)>/)?.[1] ?? mail.from).trim().toLowerCase();
  const refId = mail.subject.match(REF_RE)?.[1];

  // Reply to one of our emails → attachments are a resubmission on that application.
  if (refId) {
    const app = await getApplication(refId);
    if (!app) return { id: refId, runId: null, mode: "ignored", note: "Unknown application reference" };
    // Only an application waiting on the vendor (or mid-check) takes new documents - a late reply must not reopen a decision.
    if (app.status !== "awaiting_vendor" && app.status !== "processing") {
      await audit(app.id, "vendor", "email_reply", { from: fromAddr, subject: mail.subject, note: `Reply received while the application is ${app.status} - not re-checked` });
      return { id: app.id, runId: null, mode: "ignored", note: `Application is ${app.status}` };
    }
    const { bySlot, ignored } = await classifyAttachments(mail.attachments);
    return addToApplication(app.id, bySlot, ignored, fromAddr, mail.subject);
  }

  // New vendor by email. Mail without any attachment is not an application - ignore it.
  if (!mail.attachments.length) return { id: "", runId: null, mode: "ignored", note: "No attachments and not a reply", help: { ignored: [] } };
  const { bySlot, ignored } = await classifyAttachments(mail.attachments);
  if (!bySlot.size) {
    return { id: "", runId: null, mode: "ignored", note: `No registration documents among the attachments (${ignored.map((i) => i.name).join(", ")})`, help: { ignored: ignored.map((i) => i.name) } };
  }
  const { form, sources } = draftFromDocuments((slot) => bySlot.get(slot)?.read.extraction);

  // Vendors often send documents in several emails ("PFA GST cert", later "PFA cheque") without our [VEN-…]
  // reference. Join the sender's open application if the documents are for the same business (same PAN or
  // GSTIN), or carry no PAN/GSTIN at all (e.g. only a cheque). A different PAN/GSTIN is a new application.
  const open = await query<{ id: string; pan: string; gstin: string }>(
    `select id, pan, gstin from applications where lower(contact_email)=$1 and source='email'
        and status in ('awaiting_vendor','processing') order by created_at desc limit 5`, [fromAddr],
  );
  const pan = (form.pan ?? "").toUpperCase(), gstin = (form.gstin ?? "").toUpperCase();
  const same = open.find((a) => (pan && a.pan === pan) || (gstin && a.gstin === gstin)) ?? (!pan && !gstin ? open[0] : undefined);
  if (same) return addToApplication(same.id, bySlot, ignored, fromAddr, mail.subject);

  const body = await readEmailBody(mail.from, mail.text);
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
