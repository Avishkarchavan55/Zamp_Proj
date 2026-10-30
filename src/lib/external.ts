import "server-only";
import { one } from "./db";

export interface IfscRecord {
  BANK: string;
  BRANCH: string;
  CITY: string;
  STATE: string;
  ADDRESS: string;
  MICR?: string;
}

const ifscCache = new Map<string, IfscRecord | null>();

/**
 * Live lookup against Razorpay's public IFSC dataset (https://ifsc.razorpay.com).
 * Returns null when the code does not exist, throws when the service is unreachable.
 */
export async function lookupIfsc(ifsc: string): Promise<IfscRecord | null> {
  if (ifscCache.has(ifsc)) return ifscCache.get(ifsc)!;
  const res = await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(ifsc)}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404) {
    ifscCache.set(ifsc, null);
    return null;
  }
  if (!res.ok) throw new Error(`IFSC service returned ${res.status}`);
  const data = (await res.json()) as IfscRecord;
  ifscCache.set(ifsc, data);
  return data;
}

export interface GstRegistryRecord {
  gstin: string;
  legal_name: string;
  trade_name: string | null;
  status: string;
  state_code: string | null;
  constitution: string | null;
}

/**
 * GST registry lookup. Production would call a GST Suvidha Provider (GSP) API; this build reads a
 * sandbox table seeded with the demo vendors, and the UI labels the source accordingly.
 */
export async function lookupGstRegistry(gstin: string) {
  return one<GstRegistryRecord>("select * from gst_registry where gstin = $1", [gstin]);
}

const pincodeCache = new Map<string, { state: string; district: string } | null>();

/**
 * Live lookup against India Post's public pincode directory (api.postalpincode.in).
 * Returns null for a pincode that does not exist, throws when the service is unreachable.
 */
export async function lookupPincode(pincode: string): Promise<{ state: string; district: string } | null> {
  if (pincodeCache.has(pincode)) return pincodeCache.get(pincode)!;
  const res = await fetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(pincode)}`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Pincode service returned ${res.status}`);
  const [data] = (await res.json()) as { Status: string; PostOffice: { State: string; District: string }[] | null }[];
  // Only India Post's explicit "Error" (no records) means the PIN does not exist; anything else is a service hiccup.
  if (data?.Status !== "Success" && data?.Status !== "Error") throw new Error(`Pincode service gave an unexpected answer (${data?.Status ?? "empty"})`);
  const hit = data.Status === "Success" && data.PostOffice?.length ? { state: data.PostOffice[0].State, district: data.PostOffice[0].District } : null;
  pincodeCache.set(pincode, hit);
  return hit;
}

export const PINCODE_SOURCE = "India Post pincode directory (live)";
export const GST_REGISTRY_SOURCE = "GST registry (internal dataset)";
export const IFSC_SOURCE = "Razorpay IFSC API (live)";
