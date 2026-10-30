import { DEMO_USERS, getSession } from "@/lib/auth";
import { ROLE_LABEL, can } from "@/lib/session";

export async function GET() {
  const s = await getSession();
  if (!s) return Response.json({ error: "Sign in required" }, { status: 401 });
  return Response.json({
    // The current account name, even for sessions signed before it was renamed.
    name: DEMO_USERS.find((u) => u.id === s.sub)?.name ?? s.name,
    email: s.email,
    role: s.role,
    role_label: ROLE_LABEL[s.role],
    can_decide: can.decide(s.role),
    can_override_rejection: can.overrideRejection(s.role),
  });
}
