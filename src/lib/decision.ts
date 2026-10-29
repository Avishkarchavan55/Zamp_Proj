import type { Check } from "./checks";
import { DECISION_RULES } from "./policy";
import type { CheckStatus, Decision, RequestedItem } from "./types";

const blocking = (c: Check) => c.status === "failed" || c.status === "warning";

/**
 * Policy engine: maps check results to an outcome. No model is involved; the same checks always
 * produce the same decision, and every decision carries the rule that produced it.
 */
export function decide(checks: Check[], vendorName: string): Decision {
  const rejectHits = checks.filter((c) => c.route === "reject" && c.status === "failed");
  const vendorHits = checks.filter((c) => c.route === "vendor" && blocking(c));
  const reviewHits = checks.filter((c) => c.route === "review" && blocking(c));
  // Conditions = things we could not verify, plus obligations (e.g. MSME payment terms) to carry into the ERP.
  const conditions = checks.filter((c) => c.route === "condition" && (c.status === "unverified" || c.status === "passed"));

  const counts = { passed: 0, failed: 0, warning: 0, unverified: 0, skipped: 0 } as Record<CheckStatus, number>;
  for (const c of checks) counts[c.status]++;

  const hits = { R1: rejectHits, R2: vendorHits, R3: reviewHits, R4: [] as Check[] };
  const firing = rejectHits.length ? "R1" : vendorHits.length ? "R2" : reviewHits.length ? "R3" : "R4";
  const rule_trace = DECISION_RULES.map((r) => ({
    rule: `${r.id} · ${r.title}`,
    description: r.description,
    matched: r.id === firing,
    checks: hits[r.id as keyof typeof hits].map((c) => c.code),
  }));

  const requested: RequestedItem[] = [];
  const seen = new Set<string>();
  for (const c of vendorHits) {
    if (c.request && !seen.has(c.request.code)) {
      seen.add(c.request.code);
      requested.push(c.request);
    }
  }

  const reasons = (list: Check[]) => list.map((c) => ({ code: c.code, text: `${c.label}: ${c.message}`, route: c.route }));
  const conditionTexts = conditions.map((c) => c.rule ?? c.message);

  switch (firing) {
    case "R1":
      return {
        outcome: "rejected",
        headline: "Rejected — this vendor cannot be onboarded",
        summary: `${vendorName} cannot be onboarded: ${rejectHits.map((c) => c.message).join(" ")}`,
        reasons: reasons(rejectHits),
        next_actions: [
          "Do not create the vendor in the ERP or release any payment.",
          "Escalate to the Finance Controller / fraud review with this report.",
          "If the vendor disputes the decision, a reviewer can re-open the application with a documented override.",
        ],
        conditions: [], requested_items: [], rule_trace, counts, decided_by: "policy_engine",
      };
    case "R2":
      return {
        outcome: "awaiting_vendor",
        headline: `Waiting for the vendor to fix ${requested.length === 1 ? "one thing" : `${requested.length} things`}`,
        summary: `The application cannot be verified until the vendor fixes: ${requested.map((r) => r.title.toLowerCase()).join("; ")}.` +
          (reviewHits.length ? ` ${reviewHits.length} further issue(s) will be re-checked after resubmission.` : ""),
        reasons: reasons([...vendorHits, ...reviewHits]),
        next_actions: [
          "A specific request with a secure resubmission link has been sent to the vendor.",
          "Automatic reminders go out if the vendor does not respond; unresponsive vendors are escalated.",
          "Only the affected checks change on resubmission — unchanged documents are not re-read.",
        ],
        conditions: conditionTexts, requested_items: requested, rule_trace, counts, decided_by: "policy_engine",
      };
    case "R3":
      return {
        outcome: "in_review",
        headline: `Needs your decision — ${reviewHits.length === 1 ? "one thing doesn't" : `${reviewHits.length} things don't`} add up`,
        summary: `The documents do not tell one consistent story. ${reviewHits[0].message}`,
        reasons: reasons(reviewHits),
        next_actions: [
          "A reviewer compares the highlighted evidence side by side.",
          "Approve with a documented reason, request clarification from the vendor, or reject.",
        ],
        conditions: conditionTexts, requested_items: [], rule_trace, counts, decided_by: "policy_engine",
      };
    default:
      return {
        outcome: "approved",
        headline: conditions.length
          ? `Approved — ${conditions.length === 1 ? "one thing" : `${conditions.length} things`} to clear before the first payment`
          : "Approved",
        summary: `All ${counts.passed} blocking checks passed for ${vendorName}.` +
          (conditions.length ? ` ${conditions.length} item(s) could not be independently verified and are carried as conditions.` : ""),
        reasons: [],
        next_actions: [
          "Create the vendor master record in the ERP.",
          ...conditionTexts.map((t) => `Condition: ${t}`),
        ],
        conditions: conditionTexts, requested_items: [], rule_trace, counts, decided_by: "policy_engine",
      };
  }
}
