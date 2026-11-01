import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";

/**
 * Guards the procurement console. Vendor-facing pages and machine endpoints stay public; each of
 * those authenticates itself (resubmission token, shared secret, Turnstile).
 */
const PUBLIC_PREFIXES = [
  "/go", "/login", "/apply", "/supplier", "/vendor/", "/demo/", "/test-cases/",
  "/api/auth/", "/api/vendor/", "/api/intake/", "/api/n8n/", "/api/health", "/api/channels",
  // The supplier portal has its own sign-in (reference + email); it never grants staff access.
  "/portal", "/api/supplier/",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();
  // The vendor portal submits here without a staff session.
  if (pathname === "/api/applications" && req.method === "POST") return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|pdf|json)$).*)"],
};
