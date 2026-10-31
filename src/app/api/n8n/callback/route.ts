import { randomUUID } from "node:crypto";
import type { Communication } from "@/lib/comms";
import { json, one, query } from "@/lib/db";
import { appUrl, bad, n8nAuthorised } from "@/lib/http";
import { COMMS } from "@/lib/policy";
import { smtpFallback } from "@/lib/comms";
import { notifySupplier, noticeFor } from "@/lib/notify";
import { audit, getApplication } from "@/lib/repo";

/**
 * Events reported back by the n8n workflow so the audit trail reflects what was actually delivered.
 *   sent           - Gmail accepted the original message
 *   reminder_sent  - a reminder went out (logged as its own communication)
 *   escalated      - reminders exhausted; vendor unresponsive
 *   failed         - sending failed
 *
 * The response tells n8n what to do next (`next`), so the workflow stays stateless: VendorIQ owns the
 * reminder count and policy, n8n owns waiting and delivery.
 */
export async function POST(req: Request) {
  if (!n8nAuthorised(req)) return bad("Unauthorised", 401);
  const body = (await req.json()) as {
    communication_id: string;
    event: "sent" | "reminder_sent" | "escalated" | "failed";
    message_id?: string;
    reminder_no?: number;
    subject?: string;
    html?: string;
    to?: string;
    error?: string;
  };
  const comm = await one<Communication>("select * from communications where id=$1", [body.communication_id]);
  if (!comm) return bad("Unknown communication", 404);

  const remindable = comm.kind === "information_request" || comm.kind === "reviewer_request";
  let nextReminder = 0;

  switch (body.event) {
    case "sent":
      await query(`update communications set status='sent', sent_at=now(), meta = coalesce(meta,'{}'::jsonb) || $2::jsonb where id=$1`, [
        comm.id, json({ message_id: body.message_id ?? null }),
      ]);
      await audit(comm.application_id, "n8n", "email_sent", { communication_id: comm.id, kind: comm.kind, subject: comm.subject });
      nextReminder = remindable ? 1 : 0;
      break;
    case "reminder_sent": {
      const id = `COM-${randomUUID().slice(0, 8).toUpperCase()}`;
      await query(
        `insert into communications (id, application_id, run_id, kind, to_email, subject, body, status, sent_at, meta)
         values ($1,$2,$3,'reminder',$4,$5,$6,'sent',now(),$7::jsonb)`,
        [id, comm.application_id, comm.run_id, comm.to_email, body.subject ?? `Reminder ${body.reminder_no ?? ""}`,
          body.html ?? "", json({ parent: comm.id, reminder_no: body.reminder_no ?? null, message_id: body.message_id ?? null, delivered_to: body.to ?? null })],
      );
      await audit(comm.application_id, "n8n", "reminder_sent", { communication_id: id, parent: comm.id, reminder_no: body.reminder_no });
      {
        const app = await getApplication(comm.application_id);
        const notice = app && !(app.intake_meta as { quiet?: boolean } | null)?.quiet ? noticeFor("reminder", app, { subject: body.subject ?? "" }) : null;
        if (app && notice) await notifySupplier(app.id, notice).catch(() => {});
      }
      nextReminder = (body.reminder_no ?? 1) + 1;
      break;
    }
    case "escalated":
      await query(
        `update applications set flags = (select jsonb_agg(distinct f) from jsonb_array_elements(flags || '["vendor_unresponsive"]'::jsonb) f), updated_at=now() where id=$1`,
        [comm.application_id],
      );
      await audit(comm.application_id, "n8n", "escalated", { communication_id: comm.id, reason: "No response after all reminders" });
      break;
    case "failed":
      // n8n could not deliver it: send it ourselves so the vendor is never left without the email.
      await audit(comm.application_id, "n8n", "email_failed", { communication_id: comm.id, error: body.error });
      await smtpFallback(comm.id, `n8n could not send it: ${body.error ?? "unknown error"}`);
      break;
    default:
      return bad("Unknown event");
  }
  return Response.json({
    ok: true,
    next: nextReminder
      ? {
          enabled: true,
          after_minutes: COMMS.reminderAfterMinutes,
          status_url: `${appUrl(req)}/api/n8n/status/${comm.id}?reminder=${nextReminder}`,
        }
      : { enabled: false },
  });
}
