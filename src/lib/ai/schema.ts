import { z } from "zod";
import { DOC_SLOTS } from "../policy";
import type { DocSlot } from "../types";

export const FIELD_KEYS = [
  "legal_name", "trade_name", "pan", "gstin", "cin", "registration_date", "constitution_of_business",
  "address", "state", "pincode", "account_holder_name", "account_number", "ifsc", "bank_name", "branch",
  "father_name", "date_of_birth", "udyam_number", "msme_category", "major_activity",
] as const;

export const DOC_TYPES = [
  "certificate_of_incorporation", "gst_registration_certificate", "pan_card", "cancelled_cheque",
  "bank_statement", "bank_letter", "udyam_certificate", "other",
] as const;

/** Fields that are identifiers: compared exactly and confirmable against a PDF text layer. */
export const ID_FIELDS = new Set(["pan", "gstin", "cin", "ifsc", "account_number", "udyam_number", "pincode"]);

const Box = z.array(z.number()).length(4);

export const FieldSchema = z.object({
  key: z.enum(FIELD_KEYS),
  value: z.string(),
  source_quote: z.string().default(""),
  confidence: z.coerce.number().min(0).max(1),
  box_2d: Box.optional().nullable(),
});

/** Models sometimes paraphrase the type ("GST certificate", "gst_reg_cert"); map those onto the real names. */
function looseDocType(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.toLowerCase().replace(/[^a-z]+/g, " ");
  if ((DOC_TYPES as readonly string[]).includes(v)) return v;
  if (/\bgst\b|reg 06|goods and services/.test(t)) return "gst_registration_certificate";
  if (/incorporat/.test(t)) return "certificate_of_incorporation";
  if (/udyam|msme/.test(t)) return "udyam_certificate";
  if (/cheque|check/.test(t)) return "cancelled_cheque";
  if (/statement/.test(t)) return "bank_statement";
  if (/bank/.test(t)) return "bank_letter";
  if (/\bpan\b|permanent account/.test(t)) return "pan_card";
  return v;
}

export const ExtractionSchema = z.object({
  detected_type: z.preprocess(looseDocType, z.enum(DOC_TYPES).catch("other")),
  type_confidence: z.coerce.number().min(0).max(1),
  legibility: z.enum(["clear", "degraded", "illegible"]).catch("degraded"),
  fields: z.array(z.unknown()).transform((items) =>
    // Keep valid fields, drop malformed ones instead of failing the whole document.
    items.flatMap((f) => {
      const r = FieldSchema.safeParse(f);
      return r.success && r.data.value.trim() ? [r.data] : [];
    }),
  ),
  notes: z.string().default(""),
});

/** Gemini's OpenAPI-subset schema for constrained JSON output. */
export const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    detected_type: { type: "STRING", enum: [...DOC_TYPES] },
    type_confidence: { type: "NUMBER" },
    legibility: { type: "STRING", enum: ["clear", "degraded", "illegible"] },
    fields: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          key: { type: "STRING", enum: [...FIELD_KEYS] },
          value: { type: "STRING" },
          source_quote: { type: "STRING" },
          confidence: { type: "NUMBER" },
          box_2d: { type: "ARRAY", items: { type: "NUMBER" } },
        },
        required: ["key", "value", "source_quote", "confidence"],
      },
    },
    notes: { type: "STRING" },
  },
  required: ["detected_type", "type_confidence", "legibility", "fields", "notes"],
};

export function extractionPrompt(slot: DocSlot | null, withJsonShape: boolean) {
  const where = slot
    ? `The vendor uploaded this file in the "${DOC_SLOTS[slot].label}" slot. Do not assume it is that document - look at it.`
    : "The vendor sent this file as an email attachment without saying what it is.";
  return `You are a document analyst on a vendor-onboarding team at an Indian company.
${where}

1. Classify the document (detected_type) and give your confidence (0-1).
   Types: certificate_of_incorporation, gst_registration_certificate, pan_card, cancelled_cheque, bank_statement,
   bank_letter, udyam_certificate, other.
2. Rate legibility: "clear", "degraded" (blurry/skewed/low-contrast but readable) or "illegible".
3. Extract every one of these fields that is actually printed on the document:
   ${FIELD_KEYS.join(", ")}.
   - GST certificate: legal_name = "Legal Name", trade_name = "Trade Name", registration_date = "Date of Liability".
   - Cheque: account_holder_name = the name printed for the account holder (often after "For").
   - PAN card: legal_name = the "Name" line.
   - Udyam certificate: udyam_number = "UDYAM-XX-00-0000000", msme_category = Micro / Small / Medium, legal_name = name of enterprise.
   - Copy values exactly as printed. Never infer, complete or correct a value.
   - If a field is absent or you cannot read it with confidence, leave it out.
   - Format: PAN/GSTIN/IFSC/CIN uppercase without spaces; account_number digits only; dates as YYYY-MM-DD;
     state as the full Indian state name.
   - source_quote: the short verbatim text on the page that contains the value.
   - confidence (0-1): how sure you are the value is read correctly. Lower it for blur, skew or ambiguous characters.
   - box_2d: where the value is on the first page as [ymin, xmin, ymax, xmax], each 0-1000.
4. notes: one sentence on anything a reviewer should know (e.g. "This is a GST certificate, not a bank document").${
    withJsonShape
      ? `

Reply with ONLY a JSON object of this shape, no prose, no code fences:
{"detected_type": "...", "type_confidence": 0.0, "legibility": "clear", "fields": [{"key": "...", "value": "...", "source_quote": "...", "confidence": 0.0}], "notes": "..."}`
      : ""
  }`;
}

/** Lenient JSON parse for models that wrap output in prose or code fences. */
export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("Model did not return JSON");
  }
}
