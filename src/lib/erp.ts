import "server-only";
import { lookupIfsc } from "./external";
import { GST_STATE_CODES, validateGstin } from "./india";
import { PAYMENT_TERMS } from "./policy";
import type { Application } from "./types";

/**
 * Vendor master record handed to the ERP after approval: the process doesn't stop at "approved",
 * it ends with a record finance can load, including MSME payment terms and payment holds.
 */
export async function buildVendorMaster(app: Application) {
  const decision = app.decision!;
  const cat = (app.msme_category ?? "").toLowerCase();
  const msmeProtected = app.msme_registered === "yes" && (cat.includes("micro") || cat.includes("small"));
  const g = validateGstin(app.gstin);
  const ifsc = await lookupIfsc(app.bank_ifsc).catch(() => null);
  const holds = decision.conditions
    .filter((c) => /bank|penny|account/i.test(c))
    .map(() => "BANK_CONFIRMATION_BEFORE_FIRST_PAYMENT");
  if (decision.conditions.some((c) => /GST registration/i.test(c))) holds.push("GST_STATUS_CONFIRMATION");
  return {
    vendor_code: `V${app.id.replace(/\D/g, "").slice(-7)}`,
    source_application: app.id,
    legal_name: app.legal_name,
    trade_name: app.trade_name || null,
    entity_type: app.entity_type,
    pan: app.pan,
    gstin: app.gstin,
    gst_state: g.stateName ?? GST_STATE_CODES[g.stateCode] ?? null,
    cin: app.cin || null,
    address: { line: app.address, city: app.city, state: app.state, pincode: app.pincode },
    contact: { name: app.contact_name, email: app.contact_email, phone: app.contact_phone || null },
    bank: {
      account_holder: app.bank_account_holder,
      account_number: app.bank_account_number,
      ifsc: app.bank_ifsc,
      bank: ifsc?.BANK ?? app.bank_name ?? null,
      branch: ifsc?.BRANCH ?? null,
    },
    msme: {
      registered: app.msme_registered === "yes",
      udyam_number: app.udyam_number || null,
      category: app.msme_category || null,
      section_43b_h_applies: msmeProtected,
    },
    payment_terms_days: msmeProtected ? PAYMENT_TERMS.msmeMaxDays : PAYMENT_TERMS.standardDays,
    payment_holds: [...new Set(holds)],
    category: app.category || null,
    approved_by: app.decided_by === "policy_engine" ? "VendorIQ policy engine" : app.decided_by,
    approved_at: app.decided_at,
  };
}

export function toCsv(rec: Awaited<ReturnType<typeof buildVendorMaster>>) {
  const flat: Record<string, unknown> = {
    vendor_code: rec.vendor_code, legal_name: rec.legal_name, trade_name: rec.trade_name, entity_type: rec.entity_type,
    pan: rec.pan, gstin: rec.gstin, gst_state: rec.gst_state, cin: rec.cin,
    address: rec.address.line, city: rec.address.city, state: rec.address.state, pincode: rec.address.pincode,
    contact_name: rec.contact.name, contact_email: rec.contact.email, contact_phone: rec.contact.phone,
    account_holder: rec.bank.account_holder, account_number: rec.bank.account_number, ifsc: rec.bank.ifsc, bank: rec.bank.bank, branch: rec.bank.branch,
    msme: rec.msme.registered ? "Y" : "N", udyam_number: rec.msme.udyam_number, msme_category: rec.msme.category,
    payment_terms_days: rec.payment_terms_days, payment_holds: rec.payment_holds.join("|"),
    approved_by: rec.approved_by, approved_at: rec.approved_at, source_application: rec.source_application,
  };
  const cell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `${Object.keys(flat).join(",")}\n${Object.values(flat).map(cell).join(",")}\n`;
}
