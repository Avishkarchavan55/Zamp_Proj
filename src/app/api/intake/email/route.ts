import { after } from "next/server";
import { appUrl, bad, n8nAuthorised } from "@/lib/http";
import { intakeEmail } from "@/lib/intake";
import { runPipeline } from "@/lib/pipeline";
import { realMime, type IncomingFile } from "@/lib/repo";

export const maxDuration = 300;

/**
 * Inbound vendor email, posted by the n8n Gmail-trigger workflow (W2).
 * Accepts multipart (fields + binary attachments) or JSON with base64 attachments.
 */
export async function POST(req: Request) {
  if (!n8nAuthorised(req)) return bad("Unauthorised", 401);
  let mail: { from: string; subject: string; text: string; messageId?: string; auth?: string; attachments: IncomingFile[] };

  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const fd = await req.formData();
    const attachments: IncomingFile[] = [];
    for (const [, v] of fd.entries()) {
      if (v instanceof File && v.size > 0) {
        attachments.push({ name: v.name, type: realMime(v.type, v.name), bytes: Buffer.from(await v.arrayBuffer()) });
      }
    }
    mail = {
      from: String(fd.get("from") ?? ""), subject: String(fd.get("subject") ?? ""), text: String(fd.get("text") ?? ""),
      messageId: String(fd.get("message_id") ?? ""), auth: String(fd.get("auth") ?? ""), attachments,
    };
  } else {
    const body = (await req.json()) as {
      from: string; subject: string; text?: string; message_id?: string; auth?: string;
      attachments?: { name: string; mime?: string; b64: string }[];
    };
    mail = {
      from: body.from, subject: body.subject ?? "", text: body.text ?? "", messageId: body.message_id, auth: body.auth,
      attachments: (body.attachments ?? []).map((a) => ({ name: a.name, type: realMime(a.mime, a.name), bytes: Buffer.from(a.b64, "base64") })),
    };
  }
  if (!mail.from) return bad("Missing sender");
  if (mail.attachments.some((a) => a.bytes.length > 8 * 1024 * 1024)) return bad("Attachment larger than 8 MB");

  const result = await intakeEmail(mail);
  if (result.runId) {
    const base = appUrl(req);
    after(() => runPipeline(result.runId!, base));
  }
  return Response.json(result, { status: result.mode === "ignored" ? 200 : 201 });
}
