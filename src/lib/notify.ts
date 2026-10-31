import "server-only";
import { randomUUID } from "node:crypto";
import { query } from "./db";
import type { Application, RequestedItem } from "./types";

/**
 * Supplier notifications: a short notice in the supplier portal for everything we email a supplier.
 * The email stays exactly as it was; this is the same message, shorter, where the supplier can see it later.
 */
export interface Notice {
  kind: string;
  title: string;
  body: string;
  link?: string;
}

export async function notifySupplier(applicationId: string, n: Notice) {
  await query(
    `insert into notifications (id, application_id, kind, title, body, link) values ($1,$2,$3,$4,$5,$6)`,
    [`NTF-${randomUUID().slice(0, 8).toUpperCase()}`, applicationId, n.kind, n.title, n.body, n.link ?? null],
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const list = (titles: string[], max = 4) => titles.slice(0, max).join(", ") + (titles.length > max ? ` and ${titles.length - max} more` : "");
const noRef = (subject: string) => subject.replace(/\s*\[VEN-\d{4}-\d{5}\]\s*$/, "").trim();

/** The portal notice that goes with an email of this kind, or null for emails that are not for the supplier. */
export function noticeFor(
  kind: string,
  app: Pick<Application, "legal_name" | "resubmit_token">,
  content: { subject: string },
  meta?: Record<string, unknown>,
): Notice | null {
  const update = `/vendor/${app.resubmit_token}`;
  const items = (meta?.items as RequestedItem[] | undefined) ?? [];
  switch (kind) {
    case "information_request":
    case "reviewer_request":
      return {
        kind: "action_needed",
        title: items.some((i) => i.kind === "confirm") ? "Please confirm your details" : `Action needed: ${plural(items.length || 1, "item", "items")}`,
        body: items.length ? list(items.map((i) => i.title)) : "We need a few more details to continue your registration.",
        link: update,
      };
    case "reminder":
      return { kind: "reminder", title: "Reminder: action still needed", body: "Your application is on hold until the items we asked for arrive.", link: update };
    case "approval_notice":
      return { kind: "approved", title: "Your registration is approved", body: `${app.legal_name} is now an approved supplier to Acme Manufacturing.`, link: "/portal" };
    case "manual_message":
      return { kind: "message", title: noRef(content.subject), body: String(meta?.snippet ?? ""), link: meta?.include_link ? update : "/portal" };
    default:
      return null;
  }
}
