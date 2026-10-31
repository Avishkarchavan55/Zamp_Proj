import { SignJWT, jwtVerify } from "jose";
import { signingKey } from "./session";

/**
 * The supplier portal's own cookie. It never grants staff access (and a staff cookie never grants this):
 * it only proves the visitor knew an application reference and its contact email.
 */
export const SUPPLIER_COOKIE = "viq_supplier";
const MAX_AGE_S = 60 * 60 * 24 * 7;

export const supplierCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_S,
};

export async function signSupplier(email: string) {
  return new SignJWT({ typ: "supplier" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email.toLowerCase())
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(signingKey());
}

export async function verifySupplier(token: string | undefined | null): Promise<{ email: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey(), { algorithms: ["HS256"] });
    return payload.typ === "supplier" && payload.sub ? { email: String(payload.sub) } : null;
  } catch {
    return null;
  }
}
