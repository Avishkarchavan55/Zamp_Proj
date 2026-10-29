import { cookies } from "next/headers";
import { DEMO_USERS, ensureDemoUsers } from "@/lib/auth";
import { query } from "@/lib/db";
import { bad } from "@/lib/http";
import { SESSION_COOKIE, cookieOptions, signSession } from "@/lib/session";

/** One-click demo login: { as: "reviewer" | "controller" }. */
export async function POST(req: Request) {
  const { as } = (await req.json().catch(() => ({}))) as { as?: string };
  const user = DEMO_USERS.find((u) => u.role === as);
  if (!user) return bad("Unknown demo account");
  await ensureDemoUsers();
  await query(`update app_users set last_login=now() where id=$1`, [user.id]);
  const token = await signSession({ sub: user.id, name: user.name, email: user.email, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions);
  return Response.json({ ok: true, user: { name: user.name, role: user.role } });
}

/** Link form of the demo login, e.g. /api/auth/login?as=reviewer&next=/review — handy to share with evaluators. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = DEMO_USERS.find((u) => u.role === url.searchParams.get("as")) ?? DEMO_USERS[0];
  await ensureDemoUsers();
  await query(`update app_users set last_login=now() where id=$1`, [user.id]);
  const token = await signSession({ sub: user.id, name: user.name, email: user.email, role: user.role });
  const next = url.searchParams.get("next") ?? "/";
  const res = Response.redirect(new URL(next.startsWith("/") ? next : "/", url.origin), 303);
  const headers = new Headers(res.headers);
  headers.append("set-cookie", `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${cookieOptions.maxAge}${cookieOptions.secure ? "; Secure" : ""}`);
  return new Response(null, { status: 303, headers });
}
