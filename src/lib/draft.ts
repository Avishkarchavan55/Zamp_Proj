import { validateGstin } from "./india";
import type { ApplicationForm, DocSlot, EntityType, Extraction } from "./types";

/**
 * Builds application details from what the documents say, remembering which document each value came
 * from. Used by email intake (the whole draft) and by the pipeline (to fill details still left blank).
 */

/** Certificates print names in capitals; drafts read better (and match how vendors type) in title case. */
const KEEP_UPPER = new Set(["LLP", "OPC", "HUF", "MIDC", "GIDC", "II", "III"]);
export function titleCase(s: string) {
  if (!s || s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/[a-z0-9]+/g, (w) => (KEEP_UPPER.has(w.toUpperCase()) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)));
}

const val = (ex: Extraction | undefined, key: string) => ex?.fields.find((f) => f.key === key)?.value ?? "";

function entityFrom(constitution: string, pan: string): EntityType {
  const c = constitution.toLowerCase();
  if (c.includes("proprietor")) return "proprietorship";
  if (c.includes("liability partnership")) return "llp";
  if (c.includes("partnership")) return "partnership";
  if (c.includes("public")) return "public_limited";
  if (c.includes("private") || c.includes("company")) return "private_limited";
  return pan[3] === "P" ? "proprietorship" : pan[3] === "F" ? "partnership" : "private_limited";
}

export function draftFromDocuments(ex: (slot: DocSlot) => Extraction | undefined) {
  const gst = ex("gst"), ud = ex("udyam");
  const sources: Record<string, DocSlot> = {};
  const pick = (field: string, ...cands: [DocSlot, string][]) => {
    for (const [slot, key] of cands) {
      const v = val(ex(slot), key);
      if (v) {
        sources[field] = slot;
        return v;
      }
    }
    return "";
  };
  const gstin = pick("gstin", ["gst", "gstin"]);
  let panNo = pick("pan", ["pan", "pan"], ["incorporation", "pan"]);
  if (!panNo && gstin && validateGstin(gstin).formatValid) {
    panNo = gstin.slice(2, 12);
    sources.pan = "gst";
  }
  const entity = entityFrom(val(gst, "constitution_of_business"), panNo);
  // Read from the GST certificate (or the PAN's 4th letter); otherwise it is only a default guess.
  if (val(gst, "constitution_of_business")) sources.entity_type = "gst";
  else if (/^[A-Z]{3}[PFC]/.test(panNo)) sources.entity_type = sources.pan ?? "pan";
  const proprietor = entity === "proprietorship";
  const legal = proprietor
    ? pick("legal_name", ["gst", "trade_name"], ["bank_proof", "account_holder_name"])
    : pick("legal_name", ["incorporation", "legal_name"], ["gst", "legal_name"], ["pan", "legal_name"]);
  const owner = proprietor ? pick("owner_name", ["pan", "legal_name"], ["gst", "legal_name"]) : "";
  const address = pick("address", ["gst", "address"], ["incorporation", "address"]);
  const state = pick("state", ["gst", "state"], ["incorporation", "state"]);
  const pincode = address.match(/\b\d{6}\b/)?.[0] ?? val(gst, "pincode");
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  const stateIdx = parts.findIndex((p) => state && p.toLowerCase().startsWith(state.toLowerCase()));
  const city = stateIdx > 0 ? parts[stateIdx - 1] : parts.at(-2) ?? "";
  return {
    form: {
      legal_name: titleCase(legal), trade_name: proprietor ? "" : val(gst, "trade_name") !== legal ? val(gst, "trade_name") : "",
      entity_type: entity, owner_name: titleCase(owner), pan: panNo, gstin, cin: pick("cin", ["incorporation", "cin"]),
      address: titleCase(stateIdx > 1 ? parts.slice(0, stateIdx - 1).join(", ") : address), city: titleCase(city), state, pincode,
      bank_account_holder: titleCase(pick("bank_account_holder", ["bank_proof", "account_holder_name"])),
      bank_account_number: pick("bank_account_number", ["bank_proof", "account_number"]),
      bank_ifsc: pick("bank_ifsc", ["bank_proof", "ifsc"]),
      bank_name: titleCase(pick("bank_name", ["bank_proof", "bank_name"])),
      udyam_number: pick("udyam_number", ["udyam", "udyam_number"]),
      msme_category: val(ud, "msme_category"),
      msme_registered: ud ? "yes" : "",
    } as Partial<ApplicationForm>,
    sources,
  };
}
