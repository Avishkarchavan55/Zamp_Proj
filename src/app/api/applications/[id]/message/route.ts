import { composeManualMessage, describeDelivery, dispatch } from "@/lib/comms";
import { requireStaff } from "@/lib/auth";
import { appUrl, bad } from "@/lib/http";
import { audit, getApplication } from "@/lib/repo";

/**
 * A free-text email from a person on the team to the vendor (e.g. a specific question or an update),
 * alongside the automatic requests. Sent through the same channel (n8n, SMTP backup) and audited.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/applications/[id]/message">) {
  const staff = await requireStaff();
  if (staff instanceof Response) return staff;
  const { id } = await ctx.params;
  const app = await getApplication(id);
  if (!app) return bad("Unknown application", 404);

  const body = (await req.json()) as { subject?: string; message?: string; include_link?: boolean };
  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();
  if (!subject) return bad("Add a subject");
  if (message.length < 5) return bad("Write a message");
  if (subject.length > 200 || message.length > 5000) return bad("That message is too long");

  const url = appUrl(req);
  const content = composeManualMessage(app, { subject, message, includeLink: !!body.include_link, sender: staff.name }, url);
  const comm = await dispatch({
    app, runId: app.latest_run_id, kind: "manual_message", to: app.contact_email, content, appUrl: url, reminders: false,
    meta: { sender: staff.name },
  });
  await audit(id, staff.name, "message_sent", { communication_id: comm.id, subject: content.subject });
  return Response.json({ ok: true, communication: comm, delivery: describeDelivery(comm, app.contact_email).text });
}
