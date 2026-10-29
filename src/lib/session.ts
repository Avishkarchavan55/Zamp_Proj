import { SignJWT, jwtVerify } from "jose";

/**
 * Signed session cookie shared by proxy.ts (route protection) and server code (identity + roles).
 * Kept free of server-only imports so the proxy can use it.
 */

export type Role = "reviewer" | "controller";

export interface Session {
  sub: string;
  name: string;
  email: string;
  role: Role;
}

export const SESSION_COOKIE = "viq_session";
const MAX_AGE_S = 60 * 60 * 10;

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be set in production");
  return new TextEncoder().encode(secret ?? "vendoriq-local-development-secret-change-me");
}

export async function signSession(s: Session) {
  return new SignJWT({ name: s.name, email: s.email, role: s.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return { sub: String(payload.sub), name: String(payload.name), email: String(payload.email), role: payload.role as Role };
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_S,
};

export const ROLE_LABEL: Record<Role, string> = { reviewer: "Procurement team", controller: "Finance controller" };

/**
 * Permissions. The demo uses a single procurement role; in production, reversing a rejection would be
 * limited to a finance controller (segregation of duties) by changing `overrideRejection`.
 */
export const can = {
  decide: (r: Role) => r === "reviewer" || r === "controller",
  overrideRejection: (r: Role) => r === "reviewer" || r === "controller",
};
