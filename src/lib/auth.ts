import "server-only";
import { cookies } from "next/headers";
import { one, query } from "./db";
import { SESSION_COOKIE, type Role, type Session, verifySession } from "./session";

/** Demo staff account (one-click login). Seeded into app_users on first use. */
export const DEMO_USERS: { id: string; name: string; email: string; role: Role }[] = [
  { id: "usr-reviewer", name: process.env.DEMO_REVIEWER_NAME ?? "Gaurav Ahuja", email: "procurement@acme-demo.in", role: "reviewer" },
];

export async function ensureDemoUsers() {
  for (const u of DEMO_USERS) {
    await query(
      `insert into app_users (id, name, email, role) values ($1,$2,$3,$4)
       on conflict (id) do update set name=excluded.name, role=excluded.role`,
      [u.id, u.name, u.email, u.role],
    );
  }
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** For route handlers: the signed-in staff member, or a 401/403 Response to return. */
export async function requireStaff(check?: (role: Role) => boolean): Promise<Session | Response> {
  const s = await getSession();
  if (!s) return Response.json({ error: "Sign in required" }, { status: 401 });
  const user = await one<{ active: boolean }>("select active from app_users where id=$1", [s.sub]);
  if (user && !user.active) return Response.json({ error: "Account disabled" }, { status: 403 });
  if (check && !check(s.role)) return Response.json({ error: "Your role is not allowed to do this" }, { status: 403 });
  return { ...s, name: DEMO_USERS.find((u) => u.id === s.sub)?.name ?? s.name };
}
