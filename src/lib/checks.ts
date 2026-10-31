import "server-only";
import { query } from "./db";
import { EDITING_TOOLS } from "./ai/pdf";
import { GST_REGISTRY_SOURCE, IFSC_SOURCE, PINCODE_SOURCE, lookupGstRegistry, lookupIfsc, lookupPincode } from "./external";
import {
  CIN_COMPANY_TYPES, ENTITY_LABELS, EXPECTED_PAN_TYPE, FREE_EMAIL_DOMAINS, PAN_HOLDER_TYPES,
  clean, digits, sameState, validateCin, validateGstin, validateIfsc, validatePan, validatePhone, validateUdyam,
} from "./india";
import { compareNames, coreName, namesAgree, type NameComparison } from "./names";
import { DOC_SLOTS, DOC_TYPE_LABELS, KEY_FIELDS, REQUIRED_DOCS, REQUIRED_FIELDS, THRESHOLDS } from "./policy";
import type {
  Application, ApplicationForm, CheckResult, DocSlot, Extraction, ExtractedField, RequestedItem,
} from "./types";

export interface CheckContext {
  app: Application;
  present: Set<DocSlot>;
  extractions: Partial<Record<DocSlot, Extraction>>;
  /** Producer / creator / embedded software strings per document, for the tamper hint. */
  docMeta: Partial<Record<DocSlot, { filename: string; tool: string | null }>>;
}

export type Check = CheckResult & { request?: RequestedItem };

const FIELD_LABELS: Partial<Record<keyof ApplicationForm, string>> = {
  legal_name: "Legal name", entity_type: "Entity type", pan: "PAN", gstin: "GSTIN", cin: "CIN", address: "Address",
  city: "City", state: "State", pincode: "PIN code", contact_name: "Contact name", contact_email: "Contact email",
  bank_account_holder: "Account holder name", bank_account_number: "Account number", bank_ifsc: "IFSC",
  owner_name: "Proprietor name", udyam_number: "Udyam registration number", contact_phone: "Phone",
};

const isCompany = (app: Application) =>
  app.entity_type === "private_limited" || app.entity_type === "public_limited" || app.entity_type === "llp";

/** Extraction from a slot, but only if the document in that slot is the right kind of document. */
function usable(ctx: CheckContext, slot: DocSlot): Extraction | undefined {
  const ex = ctx.extractions[slot];
  if (!ex || ex.legibility === "illegible") return undefined;
  return DOC_SLOTS[slot].expects.includes(ex.detected_type) ? ex : undefined;
}

function field(ex: Extraction | undefined, key: string): ExtractedField | undefined {
  return ex?.fields.find((f) => f.key === key);
}

function fieldRequest(f: keyof ApplicationForm, instruction: string, suggested?: string): RequestedItem {
  return {
    code: `field.${f}`, kind: "field", field: f, title: `Correct ${FIELD_LABELS[f] ?? f}`, instruction,
    suggested_value: suggested,
  };
}

function docRequest(slot: DocSlot, instruction: string): RequestedItem {
  return { code: `doc.${slot}`, kind: "document", slot, title: `Upload ${DOC_SLOTS[slot].label}`, instruction };
}

// ------------------------------------------------------------------------------------------------
// Stage 1 - Intake
// ------------------------------------------------------------------------------------------------

export function intakeChecks(ctx: CheckContext): Check[] {
  const { app } = ctx;
  const missing = REQUIRED_FIELDS.filter((f) => !String(app[f as keyof Application] ?? "").trim());
  if (app.entity_type === "proprietorship" && !app.owner_name?.trim()) missing.push("owner_name" as never);
  const out: Check[] = [
    {
      code: "intake.required_fields", category: "intake", label: "Mandatory fields present",
      status: missing.length ? "failed" : "passed", severity: "high", route: missing.length ? "vendor" : "none",
      message: missing.length
        ? `Missing: ${missing.map((f) => FIELD_LABELS[f as keyof ApplicationForm] ?? f).join(", ")}`
        : `All ${REQUIRED_FIELDS.length} mandatory fields are filled in.`,
      rule: "Every mandatory field on the registration form must be completed.",
      request: missing.length
        ? { code: "field.missing", kind: "field", fields: missing as (keyof ApplicationForm)[], title: "Complete missing details", instruction: `Please provide: ${missing.map((f) => FIELD_LABELS[f as keyof ApplicationForm] ?? f).join(", ")}.` }
        : undefined,
    },
  ];
  for (const slot of REQUIRED_DOCS[app.entity_type]) {
    const ok = ctx.present.has(slot);
    out.push({
      code: `intake.doc.${slot}`, category: "intake", label: `${DOC_SLOTS[slot].label} received`,
      status: ok ? "passed" : "failed", severity: "high", route: ok ? "none" : "vendor",
      message: ok ? "File received." : `Required for ${ENTITY_LABELS[app.entity_type]} vendors but not uploaded.`,
      rule: `${ENTITY_LABELS[app.entity_type]} vendors must provide: ${REQUIRED_DOCS[app.entity_type].map((s) => DOC_SLOTS[s].label).join(", ")}.`,
      request: ok ? undefined : docRequest(slot, `Please upload your ${DOC_SLOTS[slot].label} (${DOC_SLOTS[slot].hint}).`),
    });
  }
  if (app.msme_registered === "yes") {
    const ok = ctx.present.has("udyam");
    out.push({
      code: "intake.doc.udyam", category: "intake", label: "Udyam certificate received",
      status: ok ? "passed" : "failed", severity: "medium", route: ok ? "none" : "vendor",
      message: ok ? "File received." : "Vendor declared MSME registration but did not upload the Udyam certificate.",
      rule: "A declared MSME status must be backed by the Udyam Registration Certificate - it changes our legal payment terms.",
      request: ok ? undefined : docRequest("udyam", "You told us you are a registered MSME. Please upload your Udyam Registration Certificate so we can apply MSME payment terms."),
    });
  }
  if (app.needs_confirmation) {
    out.push({
      code: "intake.confirmation", category: "intake", label: "Details confirmed by vendor",
      status: "failed", severity: "medium", route: "vendor",
      message: `This application arrived by ${app.source === "email" ? "email" : app.source}; its details were read from the attached documents and must be confirmed by the vendor.`,
      rule: "Data read from documents is evidence, not a declaration. The vendor confirms it once before approval.",
      request: {
        code: "confirm.details", kind: "confirm", title: "Confirm your details",
        instruction: "We pre-filled your registration from the documents you sent. Please check it, add anything missing, and confirm.",
      },
    });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------
// Stage 2 - Document intelligence (per document)
// ------------------------------------------------------------------------------------------------

export function documentChecks(slot: DocSlot, ex: Extraction): Check[] {
  const meta = DOC_SLOTS[slot];
  const out: Check[] = [];
  const rightType = meta.expects.includes(ex.detected_type);
  const typeLabel = DOC_TYPE_LABELS[ex.detected_type] ?? ex.detected_type;

  if (rightType && ex.type_confidence >= THRESHOLDS.typeConfidence) {
    out.push({
      code: `doc.${slot}.type`, category: "extraction", label: `${meta.label}: correct document`,
      status: "passed", severity: "high", route: "none",
      message: `Identified as ${typeLabel} (${Math.round(ex.type_confidence * 100)}% confidence).`,
      rule: `The ${meta.label} slot accepts: ${meta.expects.map((t) => DOC_TYPE_LABELS[t]).join(", ")}.`,
    });
  } else if (!rightType && ex.type_confidence >= THRESHOLDS.typeConfidence) {
    out.push({
      code: `doc.${slot}.type`, category: "extraction", label: `${meta.label}: correct document`,
      status: "failed", severity: "high", route: "vendor",
      message: `The file in this slot is a ${typeLabel}, not a ${meta.label}.`,
      evidence: { expected: meta.label, actual: typeLabel, source_quote: ex.notes },
      rule: `The ${meta.label} slot accepts: ${meta.expects.map((t) => DOC_TYPE_LABELS[t]).join(", ")}.`,
      request: docRequest(slot, `The file uploaded as your ${meta.label} appears to be a ${typeLabel}. Please upload a ${meta.hint.toLowerCase()}.`),
    });
  } else {
    out.push({
      code: `doc.${slot}.type`, category: "extraction", label: `${meta.label}: correct document`,
      status: "warning", severity: "medium", route: "review",
      message: `Could not confidently identify this document (best guess: ${typeLabel}, ${Math.round(ex.type_confidence * 100)}%).`,
      rule: `Document type must be identified with at least ${THRESHOLDS.typeConfidence * 100}% confidence.`,
    });
  }

  if (!rightType) return out;

  if (ex.legibility === "illegible") {
    out.push({
      code: `doc.${slot}.quality`, category: "extraction", label: `${meta.label}: readable`,
      status: "failed", severity: "high", route: "vendor", message: "The document could not be read.",
      rule: "Documents must be legible enough to read every key field.",
      request: docRequest(slot, `Your ${meta.label} could not be read. Please upload a clearer scan or the original PDF.`),
    });
    return out;
  }

  const keys = KEY_FIELDS[slot];
  const missing = keys.filter((k) => !field(ex, k));
  const weak = keys
    .map((k) => field(ex, k))
    .filter((f): f is ExtractedField => !!f && f.confidence < THRESHOLDS.fieldConfidence);
  if (missing.length || weak.length) {
    out.push({
      code: `doc.${slot}.quality`, category: "extraction", label: `${meta.label}: key fields readable`,
      status: "warning", severity: "medium", route: "review",
      message: [
        missing.length ? `Not found on document: ${missing.join(", ")}.` : "",
        weak.length ? `Low-confidence reads: ${weak.map((f) => `${f.key} "${f.value}" (${Math.round(f.confidence * 100)}%)`).join(", ")}.` : "",
      ].filter(Boolean).join(" ") + " A reviewer should confirm against the original.",
      evidence: { legibility: ex.legibility, uncertain: weak, missing },
      rule: `Key fields must be read with at least ${THRESHOLDS.fieldConfidence * 100}% confidence, otherwise a human confirms them.`,
    });
  } else {
    const minConf = Math.min(...keys.map((k) => field(ex, k)!.confidence));
    out.push({
      code: `doc.${slot}.quality`, category: "extraction", label: `${meta.label}: key fields readable`,
      status: "passed", severity: "medium", route: "none",
      message: `${keys.length} key fields read (lowest confidence ${Math.round(minConf * 100)}%)${ex.legibility === "degraded" ? "; scan quality is degraded but readable" : ""}.`,
      rule: `Key fields must be read with at least ${THRESHOLDS.fieldConfidence * 100}% confidence.`,
    });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------
// Stage 3 - Identifier validation (deterministic)
// ------------------------------------------------------------------------------------------------

export function validationChecks(ctx: CheckContext): Check[] {
  const { app } = ctx;
  const out: Check[] = [];

  const pan = validatePan(app.pan);
  out.push({
    code: "fmt.pan", category: "validation", label: "PAN format",
    status: pan.valid ? "passed" : "failed", severity: "high", route: pan.valid ? "none" : "vendor",
    message: pan.valid ? `${pan.value} matches the PAN structure (AAAAA9999A).` : `"${app.pan}" is not a valid PAN.`,
    evidence: { form: app.pan },
    rule: "PAN must be 5 letters, 4 digits, 1 letter.",
    request: pan.valid ? undefined : fieldRequest("pan", "The PAN entered is not in a valid format. Please re-enter it exactly as printed on the PAN card."),
  });
  if (pan.valid) {
    const expected = EXPECTED_PAN_TYPE[app.entity_type];
    const ok = expected.includes(pan.holderType);
    out.push({
      code: "fmt.pan_type", category: "validation", label: "PAN holder type matches entity",
      status: ok ? "passed" : "failed", severity: "high", route: ok ? "none" : "review",
      message: ok
        ? `4th character "${pan.holderType}" = ${pan.holderLabel}, consistent with ${ENTITY_LABELS[app.entity_type]}.`
        : `4th character "${pan.holderType}" means the PAN belongs to a ${pan.holderLabel}, but the vendor registered as a ${ENTITY_LABELS[app.entity_type]}.`,
      evidence: { form: app.pan, expected: expected.map((c) => `${c} (${PAN_HOLDER_TYPES[c]})`).join(" or "), actual: `${pan.holderType} (${pan.holderLabel})` },
      rule: "The PAN's 4th character encodes the holder type and must agree with the declared entity type.",
    });
  }

  const g = validateGstin(app.gstin);
  const docGstin = field(usable(ctx, "gst"), "gstin")?.value;
  const docG = docGstin ? validateGstin(docGstin) : null;
  if (!g.formatValid || !g.checksumValid) {
    const suggestion = docG?.checksumValid && docG.value !== g.value ? docG.value : undefined;
    out.push({
      code: "fmt.gstin", category: "validation", label: "GSTIN format & checksum",
      status: "failed", severity: "high", route: "vendor",
      message: !g.formatValid
        ? `"${app.gstin}" does not follow the GSTIN structure.`
        : `"${g.value}" fails the GSTIN checksum (last character should be "${g.expectedCheck}") - most likely a typo.` +
          (suggestion ? ` The GST certificate shows ${suggestion}.` : ""),
      evidence: { form: app.gstin, document: docGstin ?? null, document_slot: "gst", expected: suggestion ?? null },
      rule: "GSTIN = 2-digit state code + PAN + entity number + 'Z' + checksum character (mod-36).",
      request: fieldRequest("gstin",
        suggestion
          ? `The GSTIN entered (${g.value}) appears to contain a typo. Your GST certificate shows ${suggestion}. Please confirm and correct it.`
          : "The GSTIN entered is invalid. Please re-enter it exactly as printed on your GST certificate.",
        suggestion),
    });
  } else {
    out.push({
      code: "fmt.gstin", category: "validation", label: "GSTIN format & checksum",
      status: "passed", severity: "high", route: "none",
      message: `${g.value} is structurally valid and its checksum character verifies.`,
      evidence: { form: app.gstin },
      rule: "GSTIN = 2-digit state code + PAN + entity number + 'Z' + checksum character (mod-36).",
    });
  }

  const ifsc = validateIfsc(app.bank_ifsc);
  out.push({
    code: "fmt.ifsc", category: "validation", label: "IFSC format",
    status: ifsc.valid ? "passed" : "failed", severity: "high", route: ifsc.valid ? "none" : "vendor",
    message: ifsc.valid ? `${ifsc.value} matches the IFSC structure.` : `"${app.bank_ifsc}" is not a valid IFSC.`,
    evidence: { form: app.bank_ifsc },
    rule: "IFSC = 4-letter bank code + '0' + 6-character branch code.",
    request: ifsc.valid ? undefined : fieldRequest("bank_ifsc", "The IFSC entered is invalid. Please copy it from your cheque or bank letter."),
  });

  if (app.entity_type === "llp") {
    // LLPs are registered under the LLP Act and get an LLPIN (e.g. AAB-1234), not a CIN.
    const llpin = clean(app.cin);
    const ok = /^[A-Z]{3}-?\d{4}$/.test(llpin);
    out.push({
      code: "fmt.cin", category: "validation", label: "LLPIN provided & valid",
      status: !llpin ? "warning" : ok ? "passed" : "failed", severity: "low", route: !llpin || ok ? "none" : "vendor",
      message: !llpin ? "No LLPIN given - it is on the LLP's Certificate of Incorporation." : ok ? `${llpin}: valid LLP Identification Number format.` : `"${app.cin}" is not a valid LLPIN (format AAA-1234).`,
      evidence: { form: app.cin },
      rule: "LLPIN = three letters + four digits, issued by the Registrar under the LLP Act, 2008.",
      request: !llpin || ok ? undefined : fieldRequest("cin", "The LLPIN entered is invalid. Please copy it from your LLP's Certificate of Incorporation (format AAA-1234)."),
    });
  } else if (isCompany(app)) {
    if (!app.cin?.trim()) {
      out.push({
        code: "fmt.cin", category: "validation", label: "CIN provided & valid",
        status: "failed", severity: "medium", route: "vendor", message: "Companies must provide their CIN.",
        rule: "Registered companies must provide a Corporate Identity Number.",
        request: fieldRequest("cin", "Please provide your company's Corporate Identity Number (CIN) from the Certificate of Incorporation."),
      });
    } else {
      const cin = validateCin(app.cin);
      const typeInfo = CIN_COMPANY_TYPES[cin.companyType];
      const typeOk = !typeInfo || typeInfo.entity.includes(app.entity_type);
      out.push({
        code: "fmt.cin", category: "validation", label: "CIN provided & valid",
        status: !cin.valid ? "failed" : typeOk ? "passed" : "failed", severity: "medium",
        route: !cin.valid ? "vendor" : typeOk ? "none" : "review",
        message: !cin.valid
          ? `"${app.cin}" is not a valid CIN.`
          : typeOk
            ? `${cin.value}: ${cin.listing}, registered ${cin.year} in ${cin.stateName ?? cin.stateCode}, type ${cin.companyType}${typeInfo ? ` (${typeInfo.label})` : ""}.`
            : `CIN type ${cin.companyType} (${typeInfo?.label}) does not match the declared entity type ${ENTITY_LABELS[app.entity_type]}.`,
        evidence: { form: app.cin },
        rule: "CIN = listing (L/U) + industry code + state + year + company type + registration number.",
        request: cin.valid ? undefined : fieldRequest("cin", "The CIN entered is invalid. Please copy it from your Certificate of Incorporation."),
      });
    }
  }
  if (pan.valid) {
    // 5th character: first letter of the entity's name, or of an individual's surname.
    const proprietor = app.entity_type === "proprietorship";
    const basis = proprietor ? (app.owner_name ?? "").trim().split(/\s+/).pop() ?? "" : coreName(app.legal_name).replace(/^THE /, "");
    const expected = basis.charAt(0).toUpperCase();
    if (expected) {
      const ok = pan.value[4] === expected;
      out.push({
        code: "fmt.pan_initial", category: "validation", label: "PAN matches name initial",
        status: ok ? "passed" : "warning", severity: "medium", route: ok ? "none" : "review",
        message: ok
          ? `5th character "${pan.value[4]}" matches the ${proprietor ? "proprietor's surname" : "entity name"} initial.`
          : `5th character is "${pan.value[4]}", but the ${proprietor ? `proprietor's surname "${basis}"` : `entity name "${app.legal_name}"`} starts with "${expected}". The PAN may belong to someone else.`,
        evidence: { form: app.pan, expected, actual: pan.value[4] },
        rule: "Income Tax rule: the PAN's 5th character is the first letter of the holder's name (surname for individuals).",
      });
    }
  }

  if (app.contact_phone?.trim()) {
    const ph = validatePhone(app.contact_phone);
    out.push({
      code: "fmt.phone", category: "validation", label: "Phone number format",
      status: ph.valid ? "passed" : "warning", severity: "low", route: "none",
      message: ph.valid ? `${ph.mobile ? "Mobile" : "Landline"} number in a valid Indian format.` : `"${app.contact_phone}" is not a valid Indian phone number.`,
      evidence: { form: app.contact_phone },
      rule: "Informational: Indian mobiles are 10 digits starting 6–9; landlines carry an STD code.",
    });
  }

  if (app.msme_registered === "yes") {
    const u = validateUdyam(app.udyam_number ?? "");
    out.push({
      code: "fmt.udyam", category: "validation", label: "Udyam number format",
      status: u.valid ? "passed" : "failed", severity: "medium", route: u.valid ? "none" : "vendor",
      message: u.valid
        ? `${u.value}: registered in ${u.stateName ?? u.stateCode}.`
        : app.udyam_number ? `"${app.udyam_number}" is not a valid Udyam Registration Number.` : "MSME declared but no Udyam number given.",
      evidence: { form: app.udyam_number ?? null },
      rule: "Ministry of MSME: UDYAM-<state>-<district>-<7-digit serial>, e.g. UDYAM-MH-26-0012345.",
      request: u.valid ? undefined : fieldRequest("udyam_number", "Please enter your Udyam Registration Number exactly as printed on your certificate (UDYAM-XX-00-0000000)."),
    });
  }
  // An empty field is a "missing details" problem (intake), not a format error - don't ask twice.
  const values: Record<string, string | undefined> = { "fmt.pan": app.pan, "fmt.gstin": app.gstin, "fmt.ifsc": app.bank_ifsc };
  for (const c of out) {
    if (c.code in values && !String(values[c.code] ?? "").trim()) {
      Object.assign(c, { status: "skipped", route: "none", severity: "info", message: "Not provided yet - covered by the missing-details request.", request: undefined });
    }
  }
  return out;
}

// ------------------------------------------------------------------------------------------------
// Stage 4 - Cross-reference (form vs documents vs each other)
// ------------------------------------------------------------------------------------------------

function nameCheck(
  code: string, label: string, cmp: NameComparison, leftLabel: string, rightLabel: string,
  slot: DocSlot, quote: string | undefined, severity: "high" | "critical" = "high",
): Check {
  const ok = namesAgree(cmp);
  return {
    code, category: "cross_reference", label,
    status: ok ? "passed" : "failed", severity, route: ok ? "none" : "review",
    message: ok
      ? cmp.match === "exact" ? `${leftLabel} and ${rightLabel} are identical.` : cmp.explanation
      : `${leftLabel} "${cmp.left}" vs ${rightLabel} "${cmp.right}". ${cmp.explanation}`,
    evidence: {
      form: cmp.left, document: cmp.right, document_slot: slot, source_quote: quote ?? null,
      match: cmp.match, similarity: cmp.similarity, diff: cmp.diff,
    },
    rule: "Names must match after normalising legal-form abbreviations (Pvt. Ltd. = Private Limited, & = and). Near-matches go to a reviewer - similar names can be different companies.",
  };
}

function idCheck(
  code: string, label: string, formValue: string | undefined, docField: ExtractedField | undefined,
  slot: DocSlot, normalise: (s: string) => string, route: "review" | "vendor" = "review",
): Check | null {
  if (!formValue || !docField) return null;
  const a = normalise(formValue);
  const b = normalise(docField.value);
  const ok = a === b;
  return {
    code, category: "cross_reference", label,
    status: ok ? "passed" : "failed", severity: "high", route: ok ? "none" : route,
    message: ok
      ? `Form and ${DOC_SLOTS[slot].label} both show ${a}.`
      : `Form says ${a} but the ${DOC_SLOTS[slot].label} shows ${b}.`,
    evidence: { form: formValue, document: docField.value, document_slot: slot, source_quote: docField.source_quote },
    rule: "Identifiers are compared character-for-character by code, never by the AI model.",
  };
}

export function crossReferenceChecks(ctx: CheckContext): Check[] {
  const { app } = ctx;
  const out: Check[] = [];
  const push = (c: Check | null) => c && out.push(c);
  const inc = usable(ctx, "incorporation");
  const gst = usable(ctx, "gst");
  const panDoc = usable(ctx, "pan");
  const bank = usable(ctx, "bank_proof");
  const g = validateGstin(app.gstin);
  const pan = validatePan(app.pan);
  const proprietor = app.entity_type === "proprietorship";

  // Identifier links ------------------------------------------------------------------------------
  if (g.checksumValid && pan.valid) {
    const ok = g.embeddedPan === pan.value;
    out.push({
      code: "xref.gstin_pan", category: "cross_reference", label: "GSTIN belongs to this PAN",
      status: ok ? "passed" : "failed", severity: "critical", route: ok ? "none" : "review",
      message: ok
        ? `Characters 3–12 of the GSTIN (${g.embeddedPan}) equal the PAN.`
        : `The GSTIN is registered to PAN ${g.embeddedPan}, but the vendor's PAN is ${pan.value}. The GST registration belongs to a different legal entity.`,
      evidence: { form: app.pan, document: g.value, expected: pan.value, actual: g.embeddedPan },
      rule: "A GSTIN embeds the holder's PAN in characters 3–12; it must be the vendor's own PAN.",
    });
  } else {
    out.push({
      code: "xref.gstin_pan", category: "cross_reference", label: "GSTIN belongs to this PAN",
      status: "skipped", severity: "info", route: "none",
      message: "Skipped until a valid GSTIN and PAN are provided.",
    });
  }

  if (g.formatValid) {
    const ok = sameState(g.stateName, app.state);
    out.push({
      code: "xref.gstin_state", category: "cross_reference", label: "GSTIN state matches address",
      status: ok ? "passed" : "failed", severity: "high", route: ok ? "none" : "review",
      message: ok
        ? `State code ${g.stateCode} = ${g.stateName}, matching the business address.`
        : `GSTIN state code ${g.stateCode} (${g.stateName ?? "unknown"}) does not match the address state (${app.state}). GST registration is state-specific.`,
      evidence: { form: app.state, document: g.value, expected: app.state, actual: g.stateName ?? g.stateCode },
      rule: "GST registration is per state; the GSTIN's state code must match the place of business.",
    });
  }

  // Form vs documents: identifiers ----------------------------------------------------------------
  if (g.checksumValid) push(idCheck("xref.gstin_doc", "GSTIN matches GST certificate", app.gstin, field(gst, "gstin"), "gst", clean));
  push(idCheck("xref.pan_doc", "PAN matches PAN card", app.pan, field(panDoc, "pan"), "pan", clean));
  push(idCheck("xref.pan_incorp", "PAN matches incorporation certificate", app.pan, field(inc, "pan"), "incorporation", clean));
  push(idCheck("xref.cin_doc", "CIN matches incorporation certificate", app.cin, field(inc, "cin"), "incorporation", clean));
  push(idCheck("xref.account_doc", "Account number matches bank proof", app.bank_account_number, field(bank, "account_number"), "bank_proof", digits));
  push(idCheck("xref.ifsc_doc", "IFSC matches bank proof", app.bank_ifsc, field(bank, "ifsc"), "bank_proof", clean));

  // Names ---------------------------------------------------------------------------------------------
  if (!proprietor) {
    const incName = field(inc, "legal_name");
    if (incName) out.push(nameCheck("xref.name_incorp", "Legal name matches incorporation certificate", compareNames(app.legal_name, incName.value), "Form", "certificate", "incorporation", incName.source_quote));
    const gstName = field(gst, "legal_name");
    if (gstName) out.push(nameCheck("xref.name_gst", "Legal name matches GST certificate", compareNames(app.legal_name, gstName.value), "Form", "GST certificate", "gst", gstName.source_quote));
    const panName = field(panDoc, "legal_name");
    if (panName) out.push(nameCheck("xref.name_pan", "Legal name matches PAN card", compareNames(app.legal_name, panName.value), "Form", "PAN card", "pan", panName.source_quote));
  } else {
    // Proprietorships: GST legal name and PAN are the owner's; the trade name is the business.
    const owner = app.owner_name ?? app.contact_name;
    const gstLegal = field(gst, "legal_name");
    if (gstLegal) out.push(nameCheck("xref.name_gst", "GST legal name is the proprietor", compareNames(owner, gstLegal.value), "Proprietor", "GST legal name", "gst", gstLegal.source_quote));
    const gstTrade = field(gst, "trade_name");
    if (gstTrade) out.push(nameCheck("xref.name_trade", "Business name matches GST trade name", compareNames(app.legal_name, gstTrade.value), "Business name", "GST trade name", "gst", gstTrade.source_quote));
    const panName = field(panDoc, "legal_name");
    if (panName) out.push(nameCheck("xref.name_pan", "PAN card is in the proprietor's name", compareNames(owner, panName.value), "Proprietor", "PAN card", "pan", panName.source_quote));
  }

  const holder = field(bank, "account_holder_name");
  if (holder) {
    const vsLegal = compareNames(app.legal_name, holder.value);
    const vsOwner = proprietor ? compareNames(app.owner_name, holder.value) : null;
    const best = vsOwner && namesAgree(vsOwner) ? vsOwner : vsLegal;
    const c = nameCheck("xref.name_bank", "Bank account holder is the vendor", best, proprietor && best === vsOwner ? "Proprietor" : "Vendor name", "account holder on bank proof", "bank_proof", holder.source_quote, "critical");
    if (proprietor) c.rule = "For proprietorships the account may be in the business name or the proprietor's own name.";
    else c.rule = "For companies the account must be in the company's own name - payments to a third-party account are a primary fraud vector.";
    out.push(c);
  }

  // Dates -----------------------------------------------------------------------------------------------
  const incDate = field(inc, "registration_date")?.value;
  if (incDate && app.cin) {
    const cin = validateCin(app.cin);
    const year = Number(incDate.slice(0, 4));
    if (cin.valid && year) {
      const ok = cin.year === year;
      out.push({
        code: "xref.cin_year", category: "cross_reference", label: "CIN year matches incorporation date",
        status: ok ? "passed" : "failed", severity: "medium", route: ok ? "none" : "review",
        message: ok ? `CIN year ${cin.year} matches the incorporation date ${incDate}.` : `CIN encodes ${cin.year} but the certificate says ${incDate}.`,
        evidence: { form: app.cin, document: incDate, document_slot: "incorporation" },
        rule: "Characters 9–12 of a CIN are the year of incorporation.",
      });
    }
  }
  // GST registration cannot pre-date the company itself.
  const gstDate = field(gst, "registration_date")?.value;
  if (gstDate && incDate && !proprietor) {
    const ok = gstDate >= incDate;
    out.push({
      code: "xref.gst_after_incorp", category: "cross_reference", label: "GST registered after incorporation",
      status: ok ? "passed" : "failed", severity: "high", route: ok ? "none" : "review",
      message: ok
        ? `GST liability from ${gstDate}, incorporated ${incDate}.`
        : `GST certificate shows liability from ${gstDate}, before the company was incorporated (${incDate}). One of the documents is wrong or belongs to another entity.`,
      evidence: { document: gstDate, document_slot: "gst", expected: `on or after ${incDate}`, actual: gstDate },
      rule: "An entity cannot be GST-registered before it legally exists.",
    });
  }

  // Udyam certificate vs declaration (MSME status changes legal payment terms, so it must be right).
  const ud = usable(ctx, "udyam");
  if (ud && app.msme_registered === "yes") {
    push(idCheck("xref.udyam_doc", "Udyam number matches certificate", app.udyam_number, field(ud, "udyam_number"), "udyam", clean));
    const udName = field(ud, "legal_name");
    if (udName) {
      const cmp = compareNames(proprietor ? app.legal_name : app.legal_name, udName.value);
      const alt = proprietor ? compareNames(app.owner_name, udName.value) : null;
      out.push(nameCheck("xref.udyam_name", "Udyam certificate is in the vendor's name", alt && namesAgree(alt) ? alt : cmp, "Vendor", "Udyam certificate", "udyam", udName.source_quote));
    }
    const certCat = field(ud, "msme_category")?.value?.toLowerCase();
    if (certCat && app.msme_category) {
      const ok = certCat.includes(app.msme_category.toLowerCase());
      out.push({
        code: "xref.msme_category", category: "cross_reference", label: "MSME category matches certificate",
        status: ok ? "passed" : "failed", severity: "high", route: ok ? "none" : "review",
        message: ok
          ? `Declared and certified category: ${app.msme_category}.`
          : `Vendor declared "${app.msme_category}" but the Udyam certificate says "${field(ud, "msme_category")!.value}". Payment terms depend on this.`,
        evidence: { form: app.msme_category, document: field(ud, "msme_category")!.value, document_slot: "udyam" },
        rule: "Only Micro and Small enterprises get the 45-day payment protection; the certificate is authoritative.",
      });
    }
  }

  // Email intake: draft values were copied from a document, so comparing a value with its own source
  // proves nothing. Those comparisons wait for the vendor's confirmation.
  if (app.needs_confirmation) {
    const sources = ((app.intake_meta as { field_sources?: Record<string, DocSlot> } | null)?.field_sources) ?? {};
    const FIELD_OF: Record<string, string> = {
      "xref.gstin_doc": "gstin", "xref.pan_doc": "pan", "xref.pan_incorp": "pan", "xref.cin_doc": "cin",
      "xref.account_doc": "bank_account_number", "xref.ifsc_doc": "bank_ifsc", "xref.name_incorp": "legal_name",
      "xref.name_gst": proprietor ? "owner_name" : "legal_name", "xref.name_pan": proprietor ? "owner_name" : "legal_name",
      "xref.name_trade": "legal_name", "xref.name_bank": "legal_name",
    };
    for (const c of out) {
      const f = FIELD_OF[c.code];
      if (f && c.evidence?.document_slot && sources[f] === c.evidence.document_slot) {
        c.status = "skipped";
        c.route = "none";
        c.severity = "info";
        c.message = `Value was read from this ${DOC_SLOTS[c.evidence.document_slot].label}; it is compared again after the vendor confirms.`;
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------------------------------------
// Stage 5 - External verification
// ------------------------------------------------------------------------------------------------

export async function externalChecks(ctx: CheckContext): Promise<Check[]> {
  const { app } = ctx;
  const out: Check[] = [];
  const ifsc = validateIfsc(app.bank_ifsc);

  if (ifsc.valid) {
    try {
      const rec = await lookupIfsc(ifsc.value);
      if (!rec) {
        out.push({
          code: "ext.ifsc", category: "external", label: "IFSC exists (bank directory)",
          status: "failed", severity: "high", route: "vendor",
          message: `${ifsc.value} is not a valid branch in the national IFSC directory.`,
          evidence: { form: app.bank_ifsc, source: IFSC_SOURCE },
          rule: "The IFSC must resolve to a real bank branch.",
          request: fieldRequest("bank_ifsc", `The IFSC ${ifsc.value} does not exist. Please check it against your cheque or bank letter.`),
        });
      } else {
        out.push({
          code: "ext.ifsc", category: "external", label: "IFSC exists (bank directory)",
          status: "passed", severity: "high", route: "none",
          message: `${ifsc.value} → ${rec.BANK}, ${rec.BRANCH}, ${rec.CITY} (${rec.STATE}).`,
          evidence: { form: app.bank_ifsc, source: IFSC_SOURCE, bank: rec.BANK, branch: rec.BRANCH, city: rec.CITY, state: rec.STATE },
          rule: "The IFSC must resolve to a real bank branch.",
        });
        const printedBank = field(usable(ctx, "bank_proof"), "bank_name")?.value ?? app.bank_name;
        if (printedBank) {
          const a = coreName(printedBank).replace(/\bBANK\b/g, "").trim();
          const b = coreName(rec.BANK).replace(/\bBANK\b/g, "").trim();
          // Banks are often written as initials: SBI = State Bank of India, PNB = Punjab National Bank.
          const initials = (n: string) => coreName(n).split(" ").filter((w) => w && !["OF", "AND", "THE"].includes(w)).map((w) => w[0]).join("");
          const compact = (n: string) => coreName(n).replace(/\s+/g, "");
          const ok = !!a && !!b && (a.includes(b) || b.includes(a) || a.split(" ")[0] === b.split(" ")[0] ||
            initials(rec.BANK) === compact(printedBank) || initials(printedBank) === compact(rec.BANK));
          out.push({
            code: "ext.bank_name", category: "external", label: "Bank on document matches IFSC",
            status: ok ? "passed" : "failed", severity: "high", route: ok ? "none" : "review",
            message: ok
              ? `Bank on the document (${printedBank}) matches the IFSC directory (${rec.BANK}).`
              : `Document shows ${printedBank}, but IFSC ${ifsc.value} belongs to ${rec.BANK}.`,
            evidence: { document: printedBank, actual: rec.BANK, source: IFSC_SOURCE, document_slot: "bank_proof" },
            rule: "The bank printed on the bank proof must be the bank that owns the IFSC.",
          });
        }
      }
    } catch (err) {
      out.push({
        code: "ext.ifsc", category: "external", label: "IFSC exists (bank directory)",
        status: "unverified", severity: "medium", route: "condition",
        message: `Bank directory unreachable (${(err as Error).message}). IFSC checked for format only.`,
        evidence: { source: IFSC_SOURCE },
        rule: "The IFSC must resolve to a real bank branch.",
      });
    }
  }

  const g = validateGstin(app.gstin);
  if (g.checksumValid) {
    const rec = await lookupGstRegistry(g.value);
    if (!rec) {
      out.push({
        code: "ext.gst_registry", category: "external", label: "GST registration active",
        status: "unverified", severity: "medium", route: "condition",
        message: `${g.value} was not found in the registry source, so its status could not be confirmed.`,
        evidence: { form: app.gstin, source: GST_REGISTRY_SOURCE },
        rule: "GST registration must be Active on the GST registry.",
      });
    } else if (rec.status !== "Active") {
      out.push({
        code: "ext.gst_registry", category: "external", label: "GST registration active",
        status: "failed", severity: "critical", route: "reject",
        message: `GST registration ${g.value} is ${rec.status.toUpperCase()} on the registry. Input tax credit cannot be claimed on invoices from this registration.`,
        evidence: { form: app.gstin, source: GST_REGISTRY_SOURCE, actual: rec.status },
        rule: "GST registration must be Active. A cancelled or suspended registration is disqualifying.",
      });
    } else {
      const cmp = compareNames(app.entity_type === "proprietorship" ? app.owner_name : app.legal_name, rec.legal_name);
      const ok = namesAgree(cmp);
      out.push({
        code: "ext.gst_registry", category: "external", label: "GST registration active",
        status: ok ? "passed" : "failed", severity: ok ? "high" : "critical", route: ok ? "none" : "review",
        message: ok
          ? `Active. Registered to ${rec.legal_name} (${rec.constitution}).`
          : `Active, but registered to "${rec.legal_name}" - not to the applying vendor.`,
        evidence: { form: app.legal_name, document: rec.legal_name, source: GST_REGISTRY_SOURCE, actual: rec.status, diff: cmp.diff },
        rule: "GST registration must be Active and registered to the applying entity.",
      });
    }
  }

  if (/^\d{6}$/.test(app.pincode ?? "")) {
    try {
      const rec = await lookupPincode(app.pincode);
      const ok = !!rec && sameState(rec.state, app.state);
      out.push({
        code: "ext.pincode_state", category: "external", label: "PIN code belongs to the stated state",
        status: !rec ? "failed" : ok ? "passed" : "failed", severity: "medium",
        route: !rec ? "vendor" : ok ? "none" : "review",
        message: !rec
          ? `PIN code ${app.pincode} does not exist in the India Post directory.`
          : ok ? `${app.pincode} → ${rec.district}, ${rec.state}.` : `PIN code ${app.pincode} is in ${rec.district}, ${rec.state} - but the address says ${app.state}.`,
        evidence: { form: `${app.pincode} / ${app.state}`, actual: rec ? `${rec.district}, ${rec.state}` : "not found", source: PINCODE_SOURCE },
        rule: "The address PIN code must exist and lie in the declared state.",
        request: rec ? undefined : fieldRequest("pincode", `The PIN code ${app.pincode} does not exist. Please check your registered address.`),
      });
    } catch (err) {
      out.push({
        code: "ext.pincode_state", category: "external", label: "PIN code belongs to the stated state",
        status: "unverified", severity: "low", route: "none",
        message: `Pincode directory unreachable (${(err as Error).message}); checked for format only.`,
        evidence: { source: PINCODE_SOURCE },
      });
    }
  }

  out.push({
    code: "ext.bank_ownership", category: "external", label: "Bank account ownership verified",
    status: "unverified", severity: "high", route: "condition",
    message: "No penny-drop / account-validation connector is configured. The account holder name was read from the bank proof, which shows what the document says - not what the bank says.",
    evidence: { source: "Penny-drop connector (not configured)" },
    rule: "Account ownership must be confirmed with the bank (₹1 penny-drop or call-back) before the first payment.",
  });
  return out;
}

// ------------------------------------------------------------------------------------------------
// Stage 6 - Risk & duplicates
// ------------------------------------------------------------------------------------------------

export async function riskChecks(ctx: CheckContext): Promise<Check[]> {
  const { app } = ctx;
  const out: Check[] = [];
  const account = digits(app.bank_account_number);
  const ifsc = clean(app.bank_ifsc);
  const pan = clean(app.pan);

  // Without an account number and IFSC there is nothing to compare (blank would "match" other blanks).
  const sameAccount = account && ifsc ? await query<{ id: string; legal_name: string; pan: string; status: string }>(
    `select id, legal_name, pan, status from applications
      where id <> $1 and regexp_replace(coalesce(bank_account_number,''), '\\D', '', 'g') = $2
        and upper(bank_ifsc) = $3 and status in ('approved','in_review','awaiting_vendor')`,
    [app.id, account, ifsc],
  ) : [];
  // Reject only when both sides carry a valid, different PAN. A blank or mistyped PAN on either side
  // (e.g. an email draft not yet confirmed) can't prove "different company" - a human looks instead.
  const panOk = (p: string) => validatePan(p).valid;
  const otherEntity = sameAccount.filter((r) => panOk(pan) && panOk(clean(r.pan)) && clean(r.pan) !== pan);
  const unclear = sameAccount.filter((r) => !(panOk(pan) && panOk(clean(r.pan))));
  if (account && ifsc && !otherEntity.length && unclear.length) out.push({
    code: "risk.duplicate_bank", category: "risk", label: "Bank account not used by another vendor",
    status: "warning", severity: "high", route: "review",
    message: `Account ${account} at ${ifsc} also appears on ${unclear.map((r) => `${r.legal_name} (${r.id}, ${r.status.replace("_", " ")})`).join(", ")}. A PAN is missing or invalid, so it is unclear whether this is the same business - please check.`,
    evidence: { form: `${account} / ${ifsc}`, matches: unclear },
    rule: "One bank account may belong to only one legal entity. Sharing an account with another vendor is a hallmark of payment-diversion fraud.",
  });
  else if (!account || !ifsc) out.push({
    code: "risk.duplicate_bank", category: "risk", label: "Bank account not used by another vendor",
    status: "skipped", severity: "info", route: "none",
    message: "No bank details yet - checked once the vendor provides them.",
    evidence: {},
    rule: "One bank account may belong to only one legal entity. Sharing an account with another vendor is a hallmark of payment-diversion fraud.",
  });
  else out.push({
    code: "risk.duplicate_bank", category: "risk", label: "Bank account not used by another vendor",
    status: otherEntity.length ? "failed" : "passed", severity: "critical", route: otherEntity.length ? "reject" : "none",
    message: otherEntity.length
      ? `Account ${account} at ${ifsc} is already registered to ${otherEntity.map((r) => `${r.legal_name} (${r.id}, ${r.status.replace("_", " ")})`).join(", ")} - a different legal entity (PAN ${otherEntity[0].pan}).`
      : "This account is not registered to any other vendor.",
    evidence: { form: `${account} / ${ifsc}`, matches: otherEntity },
    rule: "One bank account may belong to only one legal entity. Sharing an account with another vendor is a hallmark of payment-diversion fraud.",
  });

  const existing = await query<{ id: string; legal_name: string; status: string }>(
    `select id, legal_name, status from applications
      where id <> $1 and status = 'approved' and ((upper(pan) = $2 and $2 <> '') or (upper(gstin) = $3 and $3 <> ''))`,
    [app.id, pan, clean(app.gstin)],
  );
  out.push({
    code: "risk.duplicate_vendor", category: "risk", label: "Not an existing vendor",
    status: existing.length ? "warning" : "passed", severity: "medium", route: existing.length ? "review" : "none",
    message: existing.length
      ? `A vendor with the same PAN/GSTIN is already approved: ${existing.map((r) => `${r.legal_name} (${r.id})`).join(", ")}. This may be a duplicate or a change request.`
      : "No approved vendor shares this PAN or GSTIN.",
    evidence: { matches: existing },
    rule: "Duplicate vendor records cause duplicate payments; a reviewer decides whether to merge or treat as a change request.",
  });

  const domain = (app.contact_email.split("@")[1] ?? "").toLowerCase();
  const free = FREE_EMAIL_DOMAINS.includes(domain);
  out.push({
    code: "risk.email_domain", category: "risk", label: "Business email domain",
    status: free && app.entity_type !== "proprietorship" ? "warning" : "passed", severity: "low", route: "none",
    message: free
      ? app.entity_type === "proprietorship"
        ? `Uses a personal mailbox (${domain}) - common for proprietorships.`
        : `A registered company is using a free mailbox (${domain}). Not disqualifying, but noted for the reviewer.`
      : `Corporate domain ${domain}.`,
    evidence: { form: app.contact_email },
    rule: "Informational: companies normally correspond from their own domain.",
  });

  const incDate = field(usable(ctx, "incorporation"), "registration_date")?.value;
  if (incDate) {
    const ageDays = Math.floor((Date.now() - new Date(incDate).getTime()) / 86_400_000);
    if (!Number.isNaN(ageDays)) {
      const young = ageDays < THRESHOLDS.newEntityDays;
      out.push({
        code: "risk.entity_age", category: "risk", label: "Entity age",
        status: young ? "warning" : "passed", severity: "low", route: "none",
        message: young ? `Incorporated only ${ageDays} days ago.` : `Incorporated ${incDate} (${(ageDays / 365).toFixed(1)} years).`,
        rule: `Informational: entities younger than ${THRESHOLDS.newEntityDays} days are highlighted.`,
      });
    }
  }
  // Document metadata: bank and government documents are not produced in image editors.
  for (const [slot, meta] of Object.entries(ctx.docMeta) as [DocSlot, { filename: string; tool: string | null }][]) {
    if (meta?.tool && EDITING_TOOLS.test(meta.tool)) {
      out.push({
        code: `risk.doc_metadata.${slot}`, category: "risk", label: `${DOC_SLOTS[slot].label}: file origin`,
        status: "warning", severity: "high", route: "review",
        message: `${meta.filename} carries metadata from "${meta.tool}". Genuine bank and registration documents are not produced in image-editing software - the file may have been altered.`,
        evidence: { document: meta.tool, document_slot: slot },
        rule: "Files produced or saved by image editors are flagged for a person to compare against the original. This is a hint, never a rejection on its own.",
      });
    }
  }

  // Email intake: did the email really come from who it claims, and from the company's domain?
  if (app.source === "email") {
    const im = (app.intake_meta ?? {}) as { from?: string; auth?: string };
    const auth = (im.auth ?? "").toLowerCase();
    const spf = auth.match(/spf=(\w+)/)?.[1] ?? "none";
    const dkim = auth.match(/dkim=(\w+)/)?.[1] ?? "none";
    const fromDomain = (im.from ?? "").split("@")[1]?.replace(/>.*/, "").toLowerCase() ?? "";
    const site = (app.website ?? "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
    const failed = spf === "fail" || spf === "softfail" || dkim === "fail";
    out.push({
      code: "risk.email_sender", category: "risk", label: "Email sender authenticated",
      status: failed ? "warning" : spf === "pass" || dkim === "pass" ? "passed" : "unverified",
      severity: failed ? "high" : "low", route: failed ? "review" : "none",
      message: failed
        ? `The email from ${im.from} failed sender authentication (SPF ${spf}, DKIM ${dkim}) - it may be spoofed.`
        : `SPF ${spf}, DKIM ${dkim} for ${fromDomain || "unknown sender"}${site && fromDomain && !fromDomain.endsWith(site) && !FREE_EMAIL_DOMAINS.includes(fromDomain) ? ` (note: sender domain differs from website ${site})` : ""}.`,
      evidence: { form: im.from ?? null, source: "Gmail Authentication-Results header" },
      rule: "Emailed applications must pass SPF/DKIM; a failure means the sender address may be forged.",
    });
  }

  // MSME obligation: not a verification gap, a legal payment-term requirement carried into the decision.
  const cat = (field(usable(ctx, "udyam"), "msme_category")?.value ?? app.msme_category ?? "").toLowerCase();
  if (app.msme_registered === "yes" && (cat.includes("micro") || cat.includes("small"))) {
    out.push({
      code: "msme.payment_terms", category: "risk", label: "MSME payment terms",
      status: "passed", severity: "info", route: "condition",
      message: `${cat.includes("micro") ? "Micro" : "Small"} enterprise: payment must be made within 45 days of acceptance.`,
      rule: `MSME (${cat.includes("micro") ? "Micro" : "Small"}): set payment terms to ≤45 days in the ERP - MSMED Act s.15/16 (interest at 3× RBI rate on delay) and Income Tax s.43B(h) (deduction only when paid in time).`,
    });
  }
  return out;
}

