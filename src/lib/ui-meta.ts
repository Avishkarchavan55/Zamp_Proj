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
  message_sent: "Message sent to vendor",
  details_filled_from_documents: "Details filled in from documents",
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
  [/^intake\.doc\.incorporation$/, "Incorporation certificate missing"],
  [/^intake\.doc\.gst$/, "GST certificate missing"],
  [/^intake\.doc\.pan$/, "PAN card missing"],
  [/^intake\.doc\.bank_proof$/, "Bank proof missing"],
  [/^intake\.doc\.udyam$/, "Udyam certificate missing"],
  [/^intake\.doc\./, "Document missing"],
  [/^intake\.required_fields$/, "Details missing"],
  [/^intake\.confirmation$/, "Vendor must confirm details"],
];

export function issueTitle(code: string, fallback?: string) {
  return ISSUE_TITLES.find(([re]) => re.test(code))?.[1] ?? fallback ?? code;
}

export type RejectionKind = "fraud" | "ineligible" | "reviewer" | "policy";

/**
 * Why a vendor was rejected, as a category a person recognises: fraud risk, not eligible, or a reviewer's
 * call — plus one sentence on why it matters.
 */
export function rejectionReason(d: { reasons?: { code: string; text: string }[] | null; decided_by?: string | null; summary?: string | null }) {
  const reasons = d.reasons ?? [];
  const has = (re: RegExp) => reasons.find((r) => re.test(r.code));
  const bank = has(/^risk\.duplicate_bank$/);
  if (bank) {
    return {
      kind: "fraud" as RejectionKind, label: "Fraud risk", title: "Bank account belongs to another company",
      explain: "This bank account is already registered to a different company. Paying it could send money to the wrong party — a common payment-diversion fraud pattern.",
    };
  }
  const gst = has(/^ext\.gst_registry$/);
  if (gst) {
    const status = gst.text.match(/is (CANCELLED|SUSPENDED|INACTIVE)/i)?.[1]?.toLowerCase() ?? "not active";
    return {
      kind: "ineligible" as RejectionKind, label: "Not eligible", title: `GST registration ${status}`,
      explain: `The vendor's GST registration is ${status}. Invoices from it cannot be used to claim input tax credit, so the vendor cannot be onboarded until it is restored.`,
    };
  }
  if (d.decided_by && d.decided_by !== "policy_engine") {
    return {
      kind: "reviewer" as RejectionKind, label: "Rejected by reviewer", title: d.summary?.trim() || "Rejected after review",
      explain: `${d.decided_by} reviewed the evidence and rejected this vendor.`,
    };
  }
  const first = reasons[0];
  return {
    kind: "policy" as RejectionKind, label: "Policy", title: first ? issueTitle(first.code) : "Did not meet onboarding policy",
    explain: first?.text.split(": ").slice(1).join(": ") || "The application failed a check that disqualifies a vendor.",
  };
}
