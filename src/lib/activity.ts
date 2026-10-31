import { ACTION_LABEL, CHANNEL_LABEL } from "./ui-meta";

/** One line of the audit trail, with the vendor's name. Used by the bell, the activity log and vendor history. */
export interface ActivityRow {
  id: number;
  ts: string;
  actor: string;
  action: string;
  detail: Record<string, unknown> | null;
  application_id: string;
  legal_name: string | null;
}

const ACTORS: Record<string, string> = { system: "VendorIQ", vendor: "Supplier", n8n: "Email automation", policy_engine: "Rule engine" };
export const actorLabel = (actor: string) => ACTORS[actor] ?? actor;

/** Event groups for filtering the activity log. */
export const ACTION_GROUPS = [
  { key: "applications", label: "New applications", actions: ["submitted"] },
  { key: "supplier", label: "Supplier replies", actions: ["resubmitted", "details_confirmed", "email_reply"] },
  { key: "decisions", label: "Decisions", actions: ["decision", "review_approved", "review_rejected"] },
  { key: "emails", label: "Emails", actions: ["vendor_contacted", "email_sent", "reminder_sent", "message_sent", "email_failed", "clarification_requested", "escalated"] },
  { key: "system", label: "System", actions: ["run_started", "manual_rerun", "details_filled_from_documents", "erp_exported", "run_failed"] },
] as const;

export const eventLabel = (action: string) => ACTION_LABEL[action] ?? action.replaceAll("_", " ");

/** The specifics of an event in one line (what was uploaded, which fields changed, what was decided). */
export function auditDetailText(action: string, d: Record<string, unknown> | null): string {
  const x = d ?? {};
  if (action === "decision") return String(x.headline ?? "");
  if (action.startsWith("review_") || action === "clarification_requested") return String(x.note ?? "");
  if (action === "resubmitted" || action === "details_confirmed") {
    const docs = (x.documents as { slot: string; filename: string }[] | undefined) ?? [];
    const fields = Object.entries((x.fields as Record<string, { from: string; to: string }>) ?? {});
    return [x.channel === "email" ? "by email reply" : "", ...docs.map((f) => `uploaded ${f.filename}`), ...fields.map(([k, v]) => `${k}: ${v.from || "-"} to ${v.to}`)].filter(Boolean).join(", ");
  }
  if (action === "submitted") return x.channel ? `via ${CHANNEL_LABEL[String(x.channel)] ?? x.channel}` : "";
  if (action === "vendor_contacted") return ((x.items as string[]) ?? []).join(", ");
  if (action === "email_sent" || action === "reminder_sent") {
    return [String(x.subject ?? (x.reminder_no ? `Reminder ${x.reminder_no}` : "")), x.channel === "smtp" ? `(sent directly, backup: ${String(x.reason ?? "")})` : ""].join(" ").trim();
  }
  if (action === "message_sent") return String(x.subject ?? "").replace(/\s*\[VEN-\d{4}-\d{5}\]\s*$/, "");
  if (action === "erp_exported") return `${String(x.vendor_code)}, ${String(x.format)}`;
  if (action === "details_filled_from_documents") return Object.keys((x.fields as object) ?? {}).map((k) => k.replaceAll("_", " ")).join(", ");
  if (action === "escalated") return String(x.reason ?? "");
  return "";
}

export type NoticeTone = "info" | "good" | "serious" | "critical" | "warn";

/** What the company-side bell says about an event, or null when it is not worth interrupting for. */
export function staffNotice(a: ActivityRow): { title: string; detail?: string; tone: NoticeTone } | null {
  const name = a.legal_name ?? a.application_id;
  const d = a.detail ?? {};
  switch (a.action) {
    case "submitted":
      return { title: `New application: ${name}`, detail: d.channel ? `via ${CHANNEL_LABEL[String(d.channel)] ?? d.channel}` : undefined, tone: "info" };
    case "resubmitted":
    case "details_confirmed":
      return { title: `${name} sent updates`, detail: auditDetailText(a.action, a.detail) || undefined, tone: "info" };
    case "decision":
      switch (d.outcome) {
        case "approved": return { title: `${name} approved`, detail: "Decided automatically", tone: "good" };
        case "in_review": return { title: `${name} needs your decision`, tone: "serious" };
        case "rejected": return { title: `${name} rejected`, tone: "critical" };
        default: return null;
      }
    case "escalated":
      return { title: `${name} has not replied`, detail: "All reminders were sent", tone: "warn" };
    case "email_failed":
      return { title: `Email to ${name} failed`, tone: "critical" };
    default:
      return null;
  }
}
