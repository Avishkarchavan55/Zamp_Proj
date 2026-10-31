import "server-only";
import { cookies } from "next/headers";
import { query } from "./db";
import { SUPPLIER_COOKIE, verifySupplier } from "./supplier-session";

/** The signed-in supplier (by contact email), or null. */
export async function getSupplier() {
  return verifySupplier((await cookies()).get(SUPPLIER_COOKIE)?.value);
}

/** For route handlers: the supplier, or a 401 Response to return. */
export async function requireSupplier() {
  const s = await getSupplier();
  return s ?? Response.json({ error: "Sign in required" }, { status: 401 });
}

/**
 * What a supplier is told about their application. Rejections are deliberately shown as "with our team":
 * policy says a person tells the supplier, never the system.
 */
export function publicStatus(status: string) {
  switch (status) {
    case "approved": return { key: "approved", label: "Approved", text: "You are set up as a supplier. Our finance team will confirm payment details before the first payment." };
    case "awaiting_vendor": return { key: "action", label: "Action needed", text: "We need something from you before we can continue." };
    case "in_review":
    case "rejected": return { key: "team", label: "With our team", text: "A member of our team is reviewing your application. We will contact you if we need anything else." };
    default: return { key: "checking", label: "Being checked", text: "We are checking your documents. This usually takes about a minute." };
  }
}

export interface PortalApplication {
  id: string;
  legal_name: string;
  status: ReturnType<typeof publicStatus>;
  requested: string[];
  update_url: string | null;
  created_at: string;
  updated_at: string;
}

export async function supplierApplications(email: string): Promise<PortalApplication[]> {
  const rows = await query<{
    id: string; legal_name: string; status: string; resubmit_token: string; created_at: string; updated_at: string; requested: { title: string }[] | null;
  }>(
    `select id, legal_name, status, resubmit_token, created_at, updated_at, decision->'requested_items' as requested
       from applications where lower(contact_email) = $1 order by created_at desc`,
    [email.toLowerCase()],
  );
  return rows.map((a) => ({
    id: a.id,
    legal_name: a.legal_name,
    status: publicStatus(a.status),
    requested: a.status === "awaiting_vendor" ? (a.requested ?? []).map((i) => i.title) : [],
    update_url: a.status === "awaiting_vendor" ? `/vendor/${a.resubmit_token}` : null,
    created_at: a.created_at,
    updated_at: a.updated_at,
  }));
}
