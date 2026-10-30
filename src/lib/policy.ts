import type { DocSlot, DocType, EntityType } from "./types";

/**
 * Onboarding policy for "Acme Manufacturing Pvt Ltd" (the fictional buyer).
 * Written as data so the same definitions drive the engine, the decision trace and the Policy page.
 */

export const BUYER = {
  name: "Acme Manufacturing Pvt Ltd",
  team: "Vendor Onboarding Team",
};

export const DOC_SLOTS: Record<DocSlot, { label: string; expects: DocType[]; hint: string }> = {
  incorporation: {
    label: "Certificate of Incorporation",
    expects: ["certificate_of_incorporation"],
    hint: "MCA certificate showing the company's CIN",
  },
  gst: {
    label: "GST Registration Certificate",
    expects: ["gst_registration_certificate"],
    hint: "Form GST REG-06",
  },
  pan: {
    label: "PAN Card",
    expects: ["pan_card"],
    hint: "PAN card of the entity (or of the proprietor)",
  },
  bank_proof: {
    label: "Bank Proof",
    expects: ["cancelled_cheque", "bank_letter", "bank_statement"],
    hint: "Cancelled cheque, or bank letter / statement showing account holder, number and IFSC",
  },
  udyam: {
    label: "Udyam (MSME) Certificate",
    expects: ["udyam_certificate"],
    hint: "Udyam Registration Certificate — only if you are a registered MSME",
  },
};

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  certificate_of_incorporation: "Certificate of Incorporation",
  gst_registration_certificate: "GST Registration Certificate",
  pan_card: "PAN Card",
  cancelled_cheque: "Cancelled Cheque",
  bank_statement: "Bank Statement",
  bank_letter: "Bank Letter",
  udyam_certificate: "Udyam (MSME) Certificate",
  other: "Unrecognised document",
};

export const REQUIRED_DOCS: Record<EntityType, DocSlot[]> = {
  private_limited: ["incorporation", "gst", "pan", "bank_proof"],
  public_limited: ["incorporation", "gst", "pan", "bank_proof"],
  llp: ["incorporation", "gst", "pan", "bank_proof"],
  partnership: ["gst", "pan", "bank_proof"],
  proprietorship: ["gst", "pan", "bank_proof"],
};

/** Fields per document that must be read confidently, otherwise a human confirms them. */
export const KEY_FIELDS: Record<DocSlot, string[]> = {
  incorporation: ["legal_name"],  // CIN is cross-checked on its own (xref.cin_doc); LLP certificates carry an LLPIN instead
  gst: ["gstin", "legal_name"],
  pan: ["pan", "legal_name"],
  bank_proof: ["account_holder_name", "account_number", "ifsc"],
  udyam: ["udyam_number", "legal_name"],
};

export const REQUIRED_FIELDS = [
  "legal_name", "entity_type", "pan", "gstin", "address", "city", "state", "pincode",
  "contact_name", "contact_email", "bank_account_holder", "bank_account_number", "bank_ifsc",
] as const;

export const THRESHOLDS = {
  /** Below this, an extracted field is treated as uncertain and goes to a human. */
  fieldConfidence: 0.75,
  /** Below this, the classifier's document-type call is not trusted. */
  typeConfidence: 0.7,
  /** Companies younger than this get an informational flag. */
  newEntityDays: 180,
};

export const PAYMENT_TERMS = {
  /** MSMED Act s.15: micro and small suppliers must be paid within 45 days of acceptance. */
  msmeMaxDays: 45,
  standardDays: 60,
};

/**
 * Manual effort the process replaces, used for the "time saved" metric. Assumptions (stated on the
 * Policy page): a person reviewing one application end-to-end, and writing / chasing one vendor email.
 */
export const MANUAL_MINUTES = {
  reviewPerApplication: 35,
  perVendorEmail: 10,
  /** Human time still spent on a case that needs review. */
  perReviewCase: 15,
};

export const COMMS = {
  reminderAfterMinutes: Number(process.env.REMINDER_AFTER_MINUTES ?? 2),
  maxReminders: Number(process.env.MAX_REMINDERS ?? 2),
};

/** Decision rules, evaluated top to bottom. First match wins. */
export const DECISION_RULES = [
  {
    id: "R1",
    outcome: "rejected" as const,
    title: "Disqualifying condition",
    description:
      "Reject when a check confirms a disqualifying fact: the bank account is already registered to a different legal entity, or the GST registration is cancelled/suspended.",
  },
  {
    id: "R2",
    outcome: "awaiting_vendor" as const,
    title: "Vendor must fix something",
    description:
      "Hold as Awaiting Vendor when a required field or document is missing, a document is the wrong type or unreadable, or an identifier is mistyped. The vendor gets a specific request and a resubmission link.",
  },
  {
    id: "R3",
    outcome: "in_review" as const,
    title: "Needs human judgement",
    description:
      "Send to a reviewer when documents disagree with each other (names, PAN/GSTIN link, state), extraction confidence is low, or the vendor may already exist. Discrepancies are never auto-rejected — they can have legitimate explanations.",
  },
  {
    id: "R4",
    outcome: "approved" as const,
    title: "Approve",
    description:
      "Approve when every blocking check passes. Checks that could not be independently verified become conditions (e.g. confirm bank ownership before the first payment) rather than silently passing.",
  },
];

export const POLICY_PRINCIPLES = [
  "The AI reads documents; it never makes the decision. Decisions come from the rules on this page.",
  "Identifiers (PAN, GSTIN, IFSC, account numbers) are compared exactly, by code — never by a model.",
  "A check that could not be verified is shown as Unverified, never as Passed.",
  "Missing or wrong documents lead to a specific request to the vendor, not a rejection.",
  "Mismatches go to a human with the evidence side by side.",
  "Every decision, email and override is written to the audit trail.",
];
