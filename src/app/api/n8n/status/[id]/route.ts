import { composeInformationRequest, type Communication } from "@/lib/comms";
import { one } from "@/lib/db";
import { appUrl, bad, n8nAuthorised } from "@/lib/http";
import { COMMS } from "@/lib/policy";
import { getApplication } from "@/lib/repo";

/**
 * Called by n8n after each wait period: "is the vendor still holding this up?"
 * Returns `waiting: false` as soon as the vendor resubmits (or the application moved on), which ends
 * the reminder loop. When still waiting, it returns a freshly composed reminder so the content always
 * reflects the current outstanding items.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/n8n/status/[id]">) {
  if (!n8nAuthorised(req)) return bad("Unauthorised", 401);
  const { id } = await ctx.params;
  const comm = await one<Communication>("select * from communications where id=$1", [id]);
  if (!comm) return bad("Unknown communication", 404);
  const app = (await getApplication(comm.application_id))!;
  const resubmitted = await one<{ n: number }>(
    `select count(*)::int as n from audit_log where application_id=$1 and action in ('resubmitted','details_confirmed') and ts > $2`,
    [app.id, comm.created_at],
  );
  // A newer request to the same vendor carries its own reminders — this older loop stops.
  const newer = await one<{ n: number }>(
    `select count(*)::int as n from communications where application_id=$1 and kind=$2 and created_at > $3`,
    [app.id, comm.kind, comm.created_at],
  );
  const superseded = (newer?.n ?? 0) > 0;
  const waiting = app.status === "awaiting_vendor" && (resubmitted?.n ?? 0) === 0 && !superseded;
  const reminderNo = Number(new URL(req.url).searchParams.get("reminder") ?? 1);
  const reminder = waiting
    ? await composeInformationRequest(app, app.decision?.requested_items ?? [], appUrl(req), reminderNo)
    : null;
  return Response.json({
    communication_id: id,
    reminder_no: reminderNo,
    reminders_left: reminderNo <= COMMS.maxReminders,
    application_id: app.id,
    application_status: app.status,
    waiting,
    reason: waiting ? "Vendor has not responded" : resubmitted?.n ? "Vendor resubmitted" : superseded ? "A newer request was sent" : `Application is ${app.status}`,
    to: process.env.EMAIL_OVERRIDE_TO || app.contact_email,
    reminder: reminder && { subject: reminder.subject, html: reminder.html, text: reminder.text },
  });
}
