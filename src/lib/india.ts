/**
 * Deterministic validators for Indian business identifiers.
 * These never call a model: an identifier either satisfies the published structure or it doesn't.
 */
import type { EntityType } from "./types";

export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

export const STATES = Object.values(GST_STATE_CODES).sort();

/** Two-letter state codes used inside a CIN. */
export const CIN_STATE_CODES: Record<string, string> = {
  JK: "Jammu and Kashmir", HP: "Himachal Pradesh", PB: "Punjab", CH: "Chandigarh", UR: "Uttarakhand",
  UT: "Uttarakhand", HR: "Haryana", DL: "Delhi", RJ: "Rajasthan", UP: "Uttar Pradesh", BR: "Bihar",
  SK: "Sikkim", AR: "Arunachal Pradesh", NL: "Nagaland", MN: "Manipur", MZ: "Mizoram", TR: "Tripura",
  ML: "Meghalaya", AS: "Assam", WB: "West Bengal", JH: "Jharkhand", OR: "Odisha", CT: "Chhattisgarh",
  MP: "Madhya Pradesh", GJ: "Gujarat", MH: "Maharashtra", KA: "Karnataka", GA: "Goa", KL: "Kerala",
  TN: "Tamil Nadu", PY: "Puducherry", TG: "Telangana", AP: "Andhra Pradesh",
};

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const CIN_RE = /^[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;

export const clean = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[\s-]/g, "");
export const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** 4th character of a PAN encodes the holder type. */
export const PAN_HOLDER_TYPES: Record<string, string> = {
  C: "Company", P: "Individual", H: "Hindu Undivided Family", F: "Firm / LLP", A: "Association of Persons",
  T: "Trust", B: "Body of Individuals", L: "Local Authority", J: "Artificial Juridical Person", G: "Government",
};

export const EXPECTED_PAN_TYPE: Record<EntityType, string[]> = {
  private_limited: ["C"],
  public_limited: ["C"],
  llp: ["F"],
  partnership: ["F"],
  proprietorship: ["P"],
};

export function validatePan(pan: string) {
  const p = clean(pan);
  return { value: p, valid: PAN_RE.test(p), holderType: p[3], holderLabel: PAN_HOLDER_TYPES[p[3]] ?? "Unknown" };
}

const GST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function gstinChecksum(first14: string): string {
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const product = GST_CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(product / 36) + (product % 36);
  }
  return GST_CHARS[(36 - (total % 36)) % 36];
}

export function validateGstin(gstin: string) {
  const g = clean(gstin);
  const formatValid = GSTIN_RE.test(g);
  const expectedCheck = g.length >= 14 ? gstinChecksum(g.slice(0, 14)) : null;
  const checksumValid = formatValid && expectedCheck === g[14];
  const stateCode = g.slice(0, 2);
  return {
    value: g,
    formatValid,
    checksumValid,
    expectedCheck,
    stateCode,
    stateName: GST_STATE_CODES[stateCode] ?? null,
    embeddedPan: g.slice(2, 12),
  };
}

export function validateIfsc(ifsc: string) {
  const v = clean(ifsc);
  return { value: v, valid: IFSC_RE.test(v), bankCode: v.slice(0, 4) };
}

export function validateCin(cin: string) {
  const c = clean(cin);
  const valid = CIN_RE.test(c);
  return {
    value: c,
    valid,
    listing: c[0] === "L" ? "Listed" : "Unlisted",
    stateCode: c.slice(6, 8),
    stateName: CIN_STATE_CODES[c.slice(6, 8)] ?? null,
    year: Number(c.slice(8, 12)),
    companyType: c.slice(12, 15),
  };
}

/** Company-type suffix inside a CIN, mapped to the entity types it allows. */
export const CIN_COMPANY_TYPES: Record<string, { label: string; entity: EntityType[] }> = {
  PTC: { label: "Private limited company", entity: ["private_limited"] },
  PLC: { label: "Public limited company", entity: ["public_limited"] },
  OPC: { label: "One person company", entity: ["private_limited"] },
  FTC: { label: "Subsidiary of foreign company", entity: ["private_limited"] },
  NPL: { label: "Not-for-profit licence company", entity: ["private_limited", "public_limited"] },
  GOI: { label: "Government of India company", entity: ["public_limited"] },
  SGC: { label: "State government company", entity: ["public_limited"] },
};

const UDYAM_RE = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;

/** Udyam Registration Number (Ministry of MSME): UDYAM-<state>-<district>-<7-digit serial>. */
export function validateUdyam(udyam: string) {
  const u = (udyam ?? "").toUpperCase().replace(/\s+/g, "");
  return { value: u, valid: UDYAM_RE.test(u), stateCode: u.slice(6, 8), stateName: CIN_STATE_CODES[u.slice(6, 8)] ?? null };
}

/** Indian mobile (+91, starts 6-9) or landline with STD code. */
export function validatePhone(phone: string) {
  const d = (phone ?? "").replace(/[^\d]/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  return { digits: d, mobile: /^[6-9]\d{9}$/.test(d), valid: /^[6-9]\d{9}$/.test(d) || /^[1-9]\d{9}$/.test(d) };
}

export const MSME_CATEGORIES = ["micro", "small", "medium"] as const;

/** Older or informal names that documents and APIs still print. */
const STATE_ALIASES: Record<string, string> = {
  "new delhi": "Delhi", "nct of delhi": "Delhi", "national capital territory of delhi": "Delhi",
  orissa: "Odisha", pondicherry: "Puducherry", uttaranchal: "Uttarakhand", "jammu kashmir": "Jammu and Kashmir",
  "andaman nicobar": "Andaman and Nicobar Islands", "andaman and nicobar": "Andaman and Nicobar Islands",
  "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu", "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
};
const stateKey = (s: string) => s.trim().toLowerCase().replace(/&/g, " and ").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();

/** Maps a state as written anywhere ("NCT of Delhi", "ORISSA", "Tamil Nadu (33)") onto the official GST name. */
export function canonicalState(s?: string | null): string {
  if (!s?.trim()) return "";
  const k = stateKey(s);
  return STATES.find((x) => stateKey(x) === k) ?? STATE_ALIASES[k] ?? STATES.find((x) => k.includes(stateKey(x))) ?? s.trim();
}

export const sameState = (a?: string | null, b?: string | null) =>
  !!a?.trim() && !!b?.trim() && stateKey(canonicalState(a)) === stateKey(canonicalState(b));

export const ENTITY_LABELS: Record<EntityType, string> = {
  private_limited: "Private Limited Company",
  public_limited: "Public Limited Company",
  llp: "Limited Liability Partnership",
  partnership: "Partnership Firm",
  proprietorship: "Sole Proprietorship",
};

export const FREE_EMAIL_DOMAINS = [
  "gmail.com", "yahoo.com", "yahoo.co.in", "hotmail.com", "outlook.com", "rediffmail.com", "live.com", "icloud.com",
  "protonmail.com", "aol.com",
];
