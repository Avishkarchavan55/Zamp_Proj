import type { DocType, Extraction, ExtractedField } from "../types";

/**
 * No-AI fallback for digital PDFs. Indian identifiers follow fixed published patterns, so they can be
 * found reliably in the text layer. Names are not attempted: anything this extractor misses becomes a
 * "key field not found" check, which routes the document to a human.
 */

const PATTERNS: { key: string; re: RegExp; normalise?: (s: string) => string }[] = [
  { key: "gstin", re: /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/ },
  { key: "cin", re: /\b[UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}\b/ },
  { key: "ifsc", re: /\b[A-Z]{4}0[A-Z0-9]{6}\b/ },
  { key: "udyam_number", re: /\bUDYAM-[A-Z]{2}-\d{2}-\d{7}\b/ },
  { key: "pan", re: /\b[A-Z]{3}[ABCFGHJLPT][A-Z]\d{4}[A-Z]\b/ },
];

function classify(text: string): { type: DocType; confidence: number } {
  const t = text.toUpperCase();
  if (t.includes("GST REG-06") || (t.includes("REGISTRATION CERTIFICATE") && t.includes("GSTIN"))) return { type: "gst_registration_certificate", confidence: 0.8 };
  if (t.includes("CERTIFICATE OF INCORPORATION")) return { type: "certificate_of_incorporation", confidence: 0.8 };
  if (t.includes("UDYAM REGISTRATION")) return { type: "udyam_certificate", confidence: 0.8 };
  if (t.includes("PERMANENT ACCOUNT NUMBER")) return { type: "pan_card", confidence: 0.7 };
  if (t.includes("CANCELLED") && t.includes("IFSC")) return { type: "cancelled_cheque", confidence: 0.7 };
  if (t.includes("STATEMENT") && t.includes("IFSC")) return { type: "bank_statement", confidence: 0.6 };
  return { type: "other", confidence: 0.3 };
}

export function extractWithRegex(text: string): Extraction {
  const upper = text.toUpperCase();
  const fields: ExtractedField[] = [];
  const seen = new Set<string>();
  for (const p of PATTERNS) {
    const m = upper.match(p.re);
    if (m && !seen.has(p.key)) {
      // A PAN found inside a GSTIN is the GSTIN's PAN, not necessarily a separately printed one.
      if (p.key === "pan" && fields.some((f) => f.key === "gstin" && f.value.includes(m[0]))) continue;
      seen.add(p.key);
      const at = upper.indexOf(m[0]);
      fields.push({
        key: p.key, value: m[0], confidence: 0.6,
        source_quote: text.slice(Math.max(0, at - 40), at + m[0].length + 10).trim(),
      });
    }
  }
  const acct = upper.match(/A\/C\s*NO\.?\s*([\d\s]{9,24})/);
  if (acct) fields.push({ key: "account_number", value: acct[1].replace(/\s/g, ""), confidence: 0.6, source_quote: acct[0].trim() });
  const { type, confidence } = classify(text);
  return {
    detected_type: type,
    type_confidence: confidence,
    legibility: "clear",
    fields,
    notes: "Read without AI from the PDF's text layer: identifiers only. Names must be confirmed by a reviewer.",
  };
}
