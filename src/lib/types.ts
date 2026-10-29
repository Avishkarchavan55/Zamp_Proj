export type EntityType = "private_limited" | "public_limited" | "llp" | "partnership" | "proprietorship";

export type DocSlot = "incorporation" | "gst" | "pan" | "bank_proof" | "udyam";

export type DocType =
  | "certificate_of_incorporation"
  | "gst_registration_certificate"
  | "pan_card"
  | "cancelled_cheque"
  | "bank_statement"
  | "bank_letter"
  | "udyam_certificate"
  | "other";

export type AppStatus = "processing" | "approved" | "awaiting_vendor" | "in_review" | "rejected";

export type IntakeSource = "portal" | "email" | "google_form";

export type CheckStatus = "passed" | "failed" | "warning" | "unverified" | "skipped";
export type Severity = "critical" | "high" | "medium" | "low" | "info";
/** Who has to act when the check does not pass. */
export type Route = "none" | "vendor" | "review" | "reject" | "condition";

export type Stage =
  | "intake"
  | "extraction"
  | "validation"
  | "cross_reference"
  | "external"
  | "risk"
  | "decision"
  | "communication";

export interface ApplicationForm {
  legal_name: string;
  trade_name?: string;
  entity_type: EntityType;
  owner_name?: string;
  pan: string;
  gstin: string;
  cin?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  website?: string;
  category?: string;
  bank_account_holder: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_name?: string;
  /** "yes" | "no" | "" — whether the vendor declares Udyam (MSME) registration. */
  msme_registered?: string;
  udyam_number?: string;
  msme_category?: string;
}

export interface Application extends ApplicationForm {
  id: string;
  source: IntakeSource;
  /** Email intake: details were read from documents and still need the vendor's confirmation. */
  needs_confirmation: boolean;
  intake_meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  status: AppStatus;
  flags: string[];
  resubmit_token: string;
  latest_run_id: string | null;
  decision: Decision | null;
  decided_at: string | null;
  decided_by: string | null;
  scenario: string | null;
}

export interface ExtractedField {
  key: string;
  value: string;
  source_quote: string;
  confidence: number;
  /** [ymin, xmin, ymax, xmax] on page 1, 0–1000 (Gemini only). */
  box_2d?: number[] | null;
  /** Independent confirmations, e.g. "text_layer" or a second model id. */
  verified_by?: string[];
  second_opinion?: { provider: string; value: string; agrees: boolean } | null;
}

export interface Extraction {
  detected_type: DocType;
  type_confidence: number;
  legibility: "clear" | "degraded" | "illegible";
  fields: ExtractedField[];
  notes: string;
}

export interface Evidence {
  form?: string | null;
  document?: string | null;
  document_slot?: DocSlot;
  source_quote?: string | null;
  expected?: string | null;
  actual?: string | null;
  source?: string;
  diff?: { left: string[]; right: string[] };
  [k: string]: unknown;
}

export interface CheckResult {
  code: string;
  category: Stage;
  label: string;
  status: CheckStatus;
  severity: Severity;
  route: Route;
  message: string;
  evidence?: Evidence;
  rule?: string;
}

export interface RequestedItem {
  code: string;
  kind: "document" | "field" | "confirm";
  slot?: DocSlot;
  field?: keyof ApplicationForm;
  title: string;
  instruction: string;
  suggested_value?: string;
}

export interface Decision {
  outcome: Exclude<AppStatus, "processing">;
  headline: string;
  summary: string;
  reasons: { code: string; text: string; route: Route }[];
  next_actions: string[];
  conditions: string[];
  requested_items: RequestedItem[];
  rule_trace: { rule: string; description: string; matched: boolean; checks: string[] }[];
  counts: Record<CheckStatus, number>;
  decided_by: "policy_engine" | string;
  /** Plain-English AI summary for reviewers; never affects the outcome. */
  ai_brief?: {
    summary: string;
    likely_benign: string;
    likely_risk: string;
    ask_vendor: { title: string; instruction: string }[];
    model: string;
  } | null;
}
