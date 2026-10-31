import type { AppListRow } from "@/components/api-types";

/**
 * What needs a person: vendors whose documents disagree, and vendors who stopped replying after every reminder.
 * (Everything else is handled automatically, so this list shrinks to zero when the team is caught up.)
 */
export const isUnresponsive = (a: AppListRow) => a.status === "awaiting_vendor" && !!a.flags?.includes("vendor_unresponsive");
export const needsAttention = (a: AppListRow) => a.status === "in_review" || isUnresponsive(a);

/** Fraud-shaped signals rank above ordinary mismatches. */
export const HIGH_RISK = /^risk\.|ext\.bank_name|doc_metadata|xref\.gstin_pan/;
export const isHighRisk = (a: AppListRow) => (a.reasons ?? []).some((r) => HIGH_RISK.test(r.code));
