import type { AppStatus, CheckStatus, Stage } from "./types";

export const STAGES: { id: Stage; label: string; description: string }[] = [
  { id: "intake", label: "Received", description: "Required details and documents present?" },
  { id: "extraction", label: "Reading documents", description: "AI identifies each file and reads it" },
  { id: "validation", label: "ID checks", description: "PAN, GSTIN, IFSC, CIN follow official rules?" },
  { id: "cross_reference", label: "Consistency", description: "Do the form and documents agree?" },
  { id: "external", label: "Live lookups", description: "Bank directory, PIN codes, GST registry" },
  { id: "risk", label: "Fraud signals", description: "Shared bank accounts, duplicates, edited files" },
  { id: "decision", label: "Decision", description: "Fixed rules decide the outcome" },
  { id: "communication", label: "Email", description: "Vendor told what happens next" },
];

export const STATUS_META: Record<AppStatus, { label: string; tone: Tone; short: string }> = {
  processing: { label: "Checking…", tone: "info", short: "Checking" },
  approved: { label: "Approved", tone: "good", short: "Approved" },
  awaiting_vendor: { label: "Waiting for vendor", tone: "warn", short: "Waiting for vendor" },
  in_review: { label: "Needs your decision", tone: "serious", short: "Needs decision" },
  rejected: { label: "Rejected", tone: "critical", short: "Rejected" },
};

export type Tone = "good" | "warn" | "serious" | "critical" | "info" | "neutral" | "brand";

export const CHECK_META: Record<CheckStatus, { label: string; tone: Tone }> = {
  passed: { label: "Passed", tone: "good" },
  failed: { label: "Failed", tone: "critical" },
  warning: { label: "Flagged", tone: "serious" },
  unverified: { label: "Unverified", tone: "warn" },
  skipped: { label: "Skipped", tone: "neutral" },
};

export const ROUTE_LABEL: Record<string, string> = {
  vendor: "Vendor must fix",
  review: "Reviewer decides",
  reject: "Disqualifying",
  condition: "Condition",
  none: "",
};

export const ACTION_LABEL: Record<string, string> = {
  submitted: "Application submitted",
  run_started: "Verification run started",
  decision: "Decision recorded",
  vendor_contacted: "Vendor contacted",
  resubmitted: "Vendor resubmitted",
  manual_rerun: "Manual re-run requested",
  review_approved: "Approved by reviewer",
  review_rejected: "Rejected by reviewer",
  clarification_requested: "Clarification requested",
  email_sent: "Email delivered",
  reminder_sent: "Automatic reminder sent",
  escalated: "Escalated — vendor unresponsive",
  email_failed: "Email failed",
  run_failed: "Run failed",
  details_confirmed: "Vendor confirmed details",
  email_reply: "Vendor replied by email",
  erp_exported: "Exported to ERP",
};

export const CHANNEL_LABEL: Record<string, string> = {
  portal: "Supplier portal",
  email: "Email",
  google_form: "Google Form",
};

export const ENTITY_SHORT: Record<string, string> = {
  private_limited: "Pvt Ltd",
  public_limited: "Public Ltd",
  llp: "LLP",
  partnership: "Partnership",
  proprietorship: "Proprietorship",
};

/** Short, plain-English names for problems, used in lists and tags (full detail lives on the vendor page). */
const ISSUE_TITLES: [RegExp, string][] = [
  [/^xref\.gstin_pan$/, "GSTIN belongs to another company"],
  [/^xref\.name_bank$/, "Bank account in another name"],
  [/^xref\.name_/, "Company name doesn't match documents"],
  [/^xref\.gstin_state$/, "GSTIN state ≠ address state"],
  [/^xref\.gstin_doc$/, "GSTIN differs from certificate"],
  [/^xref\.pan_/, "PAN differs from documents"],
  [/^xref\.cin_/, "CIN differs from certificate"],
  [/^xref\.account_doc$/, "Account number differs from cheque"],
  [/^xref\.ifsc_doc$/, "IFSC differs from cheque"],
  [/^xref\.gst_after_incorp$/, "GST registered before company existed"],
  [/^xref\.msme_category$/, "MSME category doesn't match certificate"],
  [/^xref\.udyam/, "Udyam details don't match"],
  [/^ext\.gst_registry$/, "GST registration problem"],
  [/^ext\.bank_name$/, "Cheque bank ≠ IFSC bank"],
  [/^ext\.pincode_state$/, "PIN code in a different state"],
  [/^ext\.ifsc$/, "IFSC doesn't exist"],
  [/^risk\.duplicate_bank$/, "Bank account used by another vendor"],
  [/^risk\.duplicate_vendor$/, "May already be a vendor"],
  [/^risk\.doc_metadata/, "Document edited in image software"],
  [/^risk\.email_sender$/, "Email sender not verified"],
  [/^fmt\.pan_type$/, "PAN type doesn't match entity"],
  [/^fmt\.pan_initial$/, "PAN initial doesn't match name"],
  [/^fmt\.gstin$/, "GSTIN typo"],
  [/^fmt\.ifsc$/, "Invalid IFSC"],
  [/^fmt\.pan$/, "Invalid PAN"],
  [/^fmt\.cin$/, "CIN missing or invalid"],
  [/^fmt\.udyam$/, "Udyam number invalid"],
  [/^doc\..*\.type$/, "Wrong or unclear document"],
  [/^doc\..*\.quality$/, "Document hard to read"],
  [/^intake\.doc\./, "Document missing"],
  [/^intake\.required_fields$/, "Details missing"],
  [/^intake\.confirmation$/, "Vendor must confirm details"],
];

export function issueTitle(code: string, fallback?: string) {
  return ISSUE_TITLES.find(([re]) => re.test(code))?.[1] ?? fallback ?? code;
}
