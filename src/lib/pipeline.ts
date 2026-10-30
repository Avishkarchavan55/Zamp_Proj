import "server-only";
import { randomUUID } from "node:crypto";
import { providerLabel } from "./ai/chain";
import { reviewerBrief } from "./ai/brief";
import { EDITING_TOOLS } from "./ai/pdf";
import {
  crossReferenceChecks, documentChecks, externalChecks, intakeChecks, riskChecks, validationChecks,
  type Check, type CheckContext,
} from "./checks";
import { composeApproval, composeInformationRequest, composeReviewAlert, describeDelivery, dispatch } from "./comms";
import { json, one, query } from "./db";
import { decide } from "./decision";
import { extractDocument, extractorLabel, extractorMode, type ReadResult } from "./extractor";
import { DOC_SLOTS, DOC_TYPE_LABELS } from "./policy";
import { draftFromDocuments } from "./draft";
import { FORM_FIELDS, audit, getApplication, normaliseForm, updateApplicationFields } from "./repo";
import { getDocumentBytes } from "./storage";
import { broadcast } from "./supabase";
import type { ApplicationForm, DocSlot, Extraction, Stage } from "./types";

const PACE_MS = Number(process.env.STAGE_PACING_MS ?? 350);
const pause = () => new Promise((r) => setTimeout(r, PACE_MS));

export async function createRun(applicationId: string, trigger: "submission" | "resubmission" | "manual_rerun" | "confirmation") {
  const id = `RUN-${randomUUID().slice(0, 8).toUpperCase()}`;
  await query(
    `insert into runs (id, application_id, trigger, status, current_stage, extractor) values ($1,$2,$3,'running','intake',$4)`,
    [id, applicationId, trigger, extractorLabel()],
  );
  await query(`update applications set status='processing', latest_run_id=$2, updated_at=now() where id=$1`, [applicationId, id]);
  return id;
}

interface DocRow {
  id: string;
  slot: DocSlot;
  filename: string;
  mime: string;
  data_b64: string | null;
  storage_path: string | null;
  sha256: string;
}

interface PriorExtraction {
  detected_type: Extraction["detected_type"];
  type_confidence: number;
  legibility: Extraction["legibility"];
  fields: Extraction["fields"];
  notes: string;
  model: string;
  provider: string | null;
  pdf: ReadResult["pdf"];
  application_id: string;
  document_id: string;
  run_id: string;
}

/** Tool name embedded in an image file (PNG tEXt / JPEG EXIF "Software"), if it is an editing tool. */
function imageTool(bytes: Buffer): string | null {
  const texts: string[] = [];
  if (bytes.subarray(1, 4).toString("latin1") === "PNG") {
    // Walk PNG chunks and collect tEXt / iTXt values.
    for (let at = 8; at + 8 <= bytes.length; ) {
      const len = bytes.readUInt32BE(at);
      const type = bytes.subarray(at + 4, at + 8).toString("latin1");
      if (type === "tEXt" || type === "iTXt") {
        const body = bytes.subarray(at + 8, at + 8 + len).toString("latin1");
        texts.push(body.slice(body.indexOf("\0") + 1).replace(/^[\0-\x1f]+/, ""));
      }
      if (type === "IDAT" || type === "IEND") break;
      at += 12 + len;
    }
  } else {
    // JPEG/WebP: EXIF strings are plain ASCII runs.
    texts.push(...(bytes.subarray(0, 128 * 1024).toString("latin1").match(/[\x20-\x7e]{4,80}/g) ?? []));
  }
  return texts.find((t) => EDITING_TOOLS.test(t))?.trim() ?? null;
}

export async function runPipeline(runId: string, appUrl: string) {
  const started = Date.now();
  const run = await one<{ application_id: string; trigger: string }>("select application_id, trigger from runs where id=$1", [runId]);
  if (!run) return;
  const appId = run.application_id;

  const emit = async (stage: Stage, level: "info" | "success" | "warning" | "error", message: string, data?: unknown) => {
    await query(`insert into run_events (run_id, stage, level, message, data) values ($1,$2,$3,$4,$5::jsonb)`, [
      runId, stage, level, message, json(data ?? null),
    ]);
    void broadcast(`run:${runId}`, { stage });
  };
  const enter = async (stage: Stage) => {
    await query(`update runs set current_stage=$2 where id=$1`, [runId, stage]);
  };
  const all: Check[] = [];
  const record = async (checks: Check[]) => {
    for (const c of checks) {
      all.push(c);
      await query(
        `insert into checks (run_id, application_id, code, category, label, status, severity, route, message, evidence, rule)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
        [runId, appId, c.code, c.category, c.label, c.status, c.severity, c.route, c.message, json(c.evidence ?? null), c.rule ?? null],
      );
    }
  };
  const summarise = (checks: Check[]) => {
    const failed = checks.filter((c) => c.status === "failed").length;
    const warn = checks.filter((c) => c.status === "warning" || c.status === "unverified").length;
    return { failed, warn, passed: checks.filter((c) => c.status === "passed").length };
  };
  const stageDone = async (stage: Stage, checks: Check[], label: string) => {
    const s = summarise(checks);
    await emit(stage, s.failed ? "error" : s.warn ? "warning" : "success",
      `${label}: ${s.passed} passed${s.failed ? `, ${s.failed} failed` : ""}${s.warn ? `, ${s.warn} flagged` : ""}`, s);
    await pause();
  };

  try {
    const app = (await getApplication(appId))!;
    await audit(appId, "system", "run_started", { run_id: runId, trigger: run.trigger });

    // 1. Intake ---------------------------------------------------------------------------------
    await enter("intake");
    const channel = app.source === "email" ? "email" : app.source === "google_form" ? "Google Form" : "vendor portal";
    await emit("intake", "info", `${run.trigger === "resubmission" ? "Resubmission" : run.trigger === "confirmation" ? "Vendor confirmation" : "Submission"} received via ${channel} from ${app.legal_name || app.contact_email}`, { entity_type: app.entity_type, source: app.source });
    const docs = await query<DocRow>(
      `select id, slot, filename, mime, data_b64, storage_path, sha256 from documents where application_id=$1 and not superseded`, [appId],
    );
    const ctx: CheckContext = { app, present: new Set(docs.map((d) => d.slot)), extractions: {}, docMeta: {} };
    const intake = intakeChecks(ctx);
    await record(intake);
    await stageDone("intake", intake, "Received");

    // 2. Document intelligence ---------------------------------------------------------------------
    await enter("extraction");
    await emit("extraction", "info", `Reading ${docs.length} document(s) — ${extractorLabel()}`);
    const docChecks: Check[] = [];
    await Promise.all(
      docs.map(async (d) => {
        // Reuse: same document in an earlier run, or an identical file (same SHA-256) seen anywhere before.
        const prior = await one<PriorExtraction>(
          `select e.detected_type, e.type_confidence, e.legibility, e.fields, e.notes, e.model, e.provider, e.pdf, e.run_id,
                  d.application_id, d.id as document_id
             from extractions e join documents d on d.id = e.document_id
            where d.sha256 = $1 and e.cached = false and coalesce(e.provider,'') not in ('none', 'pdf-text-regex')
              and ($3 or coalesce(e.provider,'') <> 'fixture')
            order by (e.document_id = $2) desc, e.created_at desc limit 1`,
          [d.sha256, d.id, extractorMode() === "fixture"],
        );
        const bytes = await getDocumentBytes(d);
        let result: ReadResult;
        let cached = false;
        if (prior) {
          cached = true;
          result = {
            extraction: { detected_type: prior.detected_type, type_confidence: prior.type_confidence, legibility: prior.legibility, fields: prior.fields, notes: prior.notes },
            provider: prior.provider ?? prior.model, attempts: [], pdf: prior.pdf, failed: false,
          };
          await emit("extraction", "info",
            prior.run_id === runId
              ? `${d.filename}: read by ${providerLabel(prior.provider ?? "")} while sorting the email's attachments`
              : prior.document_id === d.id
              ? `${d.filename}: unchanged since last run — reusing previous reading`
              : `${d.filename}: identical file already read for ${prior.application_id} — reusing (no AI call)`,
            { slot: d.slot });
        } else {
          await emit("extraction", "info", `${d.filename}: classifying and extracting…`, { slot: d.slot });
          result = await extractDocument(d.slot, { mime: d.mime, data_b64: bytes.toString("base64"), sha256: d.sha256 });
          const fellBack = result.attempts.filter((a) => !a.ok && !a.skipped);
          if (fellBack.length && !result.failed) {
            await emit("extraction", "warning",
              `${d.filename}: ${fellBack.map((a) => `${providerLabel(a.provider)} failed (${(a.error ?? "").slice(0, 60)})`).join("; ")} → read by ${providerLabel(result.provider)}`,
              { slot: d.slot, attempts: result.attempts });
          }
        }
        const ex = result.extraction;
        const latency = result.attempts.filter((a) => a.ok).reduce((s, a) => s + a.ms, 0);
        // Readings made while sorting an email's attachments are already stored for this run.
        const alreadyStored = cached && prior?.run_id === runId && prior.document_id === d.id;
        if (!alreadyStored) await query(
          `insert into extractions (id, run_id, document_id, slot, detected_type, type_confidence, legibility, fields, notes, model, latency_ms, cached, provider, attempts, pdf)
           values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb)`,
          [`EXT-${randomUUID().slice(0, 8)}`, runId, d.id, d.slot, ex.detected_type, ex.type_confidence, ex.legibility,
            json(ex.fields), ex.notes, providerLabel(result.provider), latency, cached, result.provider, json(result.attempts), json(result.pdf)],
        );
        ctx.extractions[d.slot] = ex;
        const tool = d.mime === "application/pdf" ? [result.pdf?.producer, result.pdf?.creator].find((t) => t && EDITING_TOOLS.test(t)) ?? null : imageTool(bytes);
        ctx.docMeta[d.slot] = { filename: d.filename, tool };
        const checks = documentChecks(d.slot, ex);
        docChecks.push(...checks);
        if (result.failed) {
          await emit("extraction", "error", `${d.filename}: no AI provider or fallback could read it — routed to a human`, { slot: d.slot, detected_type: "other", attempts: result.attempts });
          return;
        }
        const wrong = !DOC_SLOTS[d.slot].expects.includes(ex.detected_type);
        const confirmed = ex.fields.filter((f) => f.verified_by?.includes("text_layer")).length;
        await emit("extraction", wrong ? "error" : ex.legibility === "clear" ? "success" : "warning",
          `${d.filename}: ${DOC_TYPE_LABELS[ex.detected_type]} · ${ex.fields.length} fields · ${ex.legibility}` +
            `${confirmed ? ` · ${confirmed} confirmed against PDF text` : ""}${latency ? ` · ${(latency / 1000).toFixed(1)}s` : ""}${cached ? "" : ` · ${providerLabel(result.provider)}`}`,
          { slot: d.slot, detected_type: ex.detected_type, wrong_slot: wrong, provider: result.provider });
      }),
    );
    await record(docChecks);
    await stageDone("extraction", docChecks, "Reading documents");

    // Email and Google Form applications can arrive without some details (e.g. bank details before the
    // cheque was sent). Whatever is still blank is taken from the documents just read, then intake re-checked.
    if (app.source !== "portal") {
      const { form, sources } = draftFromDocuments((slot) => ctx.extractions[slot]);
      const known = ((ctx.app.intake_meta ?? {}) as { field_sources?: Record<string, DocSlot> }).field_sources ?? {};
      // Before the vendor confirms, the draft's guesses (default entity type, "(unconfirmed)" name) give way
      // to what the documents now say. After confirmation only truly blank fields are filled.
      const guessed = (k: string) => ctx.app.needs_confirmation && !known[k] && !!sources[k] &&
        (k === "entity_type" || (k === "legal_name" && (/\(unconfirmed\)$/.test(ctx.app.legal_name) || ctx.app.legal_name === ctx.app.contact_email)));
      const blanks = Object.fromEntries(
        Object.entries(form).filter(([k, v]) => v && FORM_FIELDS.includes(k as keyof ApplicationForm) &&
          (!String(ctx.app[k as keyof ApplicationForm] ?? "").trim() || (guessed(k) && v !== ctx.app[k as keyof ApplicationForm]))),
      );
      if (Object.keys(blanks).length) {
        const full = normaliseForm({ ...ctx.app, ...blanks });
        const filled = Object.fromEntries(Object.keys(blanks).map((k) => [k, full[k as keyof ApplicationForm]])) as Partial<ApplicationForm>;
        await updateApplicationFields(appId, filled);
        const meta = (ctx.app.intake_meta ?? {}) as { field_sources?: Record<string, DocSlot> };
        await query(`update applications set intake_meta=$2::jsonb where id=$1`, [appId, json({
          ...meta, field_sources: { ...meta.field_sources, ...Object.fromEntries(Object.keys(filled).map((k) => [k, sources[k]])) },
        })]);
        await audit(appId, "system", "details_filled_from_documents", { run_id: runId, fields: filled });
        ctx.app = (await getApplication(appId))!;
        await emit("extraction", "info", `Filled ${Object.keys(filled).length} blank detail(s) from the documents: ${Object.keys(filled).map((k) => k.replaceAll("_", " ")).join(", ")}`, { fields: Object.keys(filled) });
        // Re-run intake against the completed details (e.g. "required details missing" may now pass).
        await query(`delete from checks where run_id=$1 and category='intake'`, [runId]);
        for (let i = all.length - 1; i >= 0; i--) if (all[i].category === "intake") all.splice(i, 1);
        await record(intakeChecks(ctx));
      }
    }

    // 3–4. Deterministic validation + cross-reference --------------------------------------------
    await enter("validation");
    const v = validationChecks(ctx);
    await record(v);
    await stageDone("validation", v, "ID checks");

    await enter("cross_reference");
    const x = crossReferenceChecks(ctx);
    await record(x);
    await stageDone("cross_reference", x, "Consistency");

    // 5. External --------------------------------------------------------------------------------
    await enter("external");
    await emit("external", "info", "Querying bank directory, India Post and GST registry…");
    const e = await externalChecks(ctx);
    await record(e);
    await stageDone("external", e, "Live lookups");

    // 6. Risk ------------------------------------------------------------------------------------
    await enter("risk");
    const r = await riskChecks(ctx);
    await record(r);
    await stageDone("risk", r, "Fraud signals");

    // 7. Decision --------------------------------------------------------------------------------
    await enter("decision");
    const decision = decide(all, ctx.app.legal_name || "This vendor");
    const fired = decision.rule_trace.find((t) => t.matched)!;
    await emit("decision", decision.outcome === "approved" ? "success" : decision.outcome === "rejected" ? "error" : "warning",
      `${fired.rule} → ${decision.headline}`, { outcome: decision.outcome });
    if (decision.outcome === "in_review") {
      decision.ai_brief = await reviewerBrief(app.legal_name, all);
      if (decision.ai_brief) await emit("decision", "info", `Reviewer brief drafted by ${decision.ai_brief.model} (does not affect the decision)`);
    }
    // A newer run started meanwhile (the vendor sent more while this one was checking): it decides, not us.
    const latest = await one<{ latest_run_id: string }>(`select latest_run_id from applications where id=$1`, [appId]);
    if (latest && latest.latest_run_id !== runId) {
      await emit("decision", "info", `Superseded by newer run ${latest.latest_run_id} — that run makes the decision.`);
      await query(`update runs set status='completed', current_stage='done', finished_at=now(), duration_ms=$2, outcome=$3, decision=$4::jsonb where id=$1`, [
        runId, Date.now() - started, decision.outcome, json(decision),
      ]);
      return;
    }
    await query(
      `update applications set status=$2, decision=$3::jsonb, decided_at=now(), decided_by='policy_engine', updated_at=now() where id=$1`,
      [appId, decision.outcome, json(decision)],
    );
    await audit(appId, "policy_engine", "decision", { run_id: runId, outcome: decision.outcome, rule: fired.rule, headline: decision.headline });
    await pause();

    // 8. Communication ---------------------------------------------------------------------------
    await enter("communication");
    const fresh = (await getApplication(appId))!;
    if (decision.outcome === "awaiting_vendor") {
      const content = await composeInformationRequest(fresh, decision.requested_items, appUrl);
      const c = await dispatch({ app: fresh, runId, kind: "information_request", to: fresh.contact_email, content, appUrl, reminders: true, meta: { items: decision.requested_items } });
      const d = describeDelivery(c, fresh.contact_email);
      await emit("communication", d.level, `Information request${content.ai_worded ? " (AI-worded)" : ""} ${d.text}`, { communication_id: c.id });
      await audit(appId, "system", "vendor_contacted", { communication_id: c.id, items: decision.requested_items.map((i) => i.title) });
    } else if (decision.outcome === "approved") {
      const c = await dispatch({ app: fresh, runId, kind: "approval_notice", to: fresh.contact_email, content: composeApproval(fresh, decision), appUrl, reminders: false });
      const d = describeDelivery(c, fresh.contact_email);
      await emit("communication", d.level, `Approval notice ${d.text}`, { communication_id: c.id });
    } else if (decision.outcome === "in_review") {
      const reviewer = process.env.PROCUREMENT_EMAIL;
      if (reviewer) {
        const c = await dispatch({ app: fresh, runId, kind: "review_alert", to: reviewer, content: composeReviewAlert(fresh, decision, appUrl), appUrl, reminders: false });
        await emit("communication", "info", `Reviewer alert ${describeDelivery(c, reviewer).text}`, { communication_id: c.id });
      } else {
        await emit("communication", "info", "Added to the review queue. No vendor email — a reviewer decides what to ask for.");
      }
    } else {
      await emit("communication", "info", "No automatic email: by policy, rejections are communicated by a person after escalation.");
    }

    const duration = Date.now() - started;
    await query(`update runs set status='completed', current_stage='done', finished_at=now(), duration_ms=$2, outcome=$3, decision=$4::jsonb where id=$1`, [
      runId, duration, decision.outcome, json(decision),
    ]);
    await emit("communication", "success", `Run completed in ${(duration / 1000).toFixed(1)}s`);
  } catch (err) {
    const message = (err as Error).message;
    await emit("decision", "error", `Run failed: ${message}`);
    await query(`update runs set status='failed', finished_at=now(), duration_ms=$2, error=$3 where id=$1`, [runId, Date.now() - started, message]);
    await query(`update applications set status='in_review', updated_at=now(), flags = flags || '["processing_error"]'::jsonb where id=$1`, [appId]);
    await audit(appId, "system", "run_failed", { run_id: runId, error: message });
  }
}
