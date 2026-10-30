import { after } from "next/server";
import { SLOTS, appUrl, bad } from "@/lib/http";
import { intakeStructured } from "@/lib/intake";
import { runPipeline } from "@/lib/pipeline";
import { realMime, type IncomingFile } from "@/lib/repo";
import { trustedCaller } from "@/lib/turnstile";
import type { DocSlot } from "@/lib/types";

export const maxDuration = 300;

/**
 * Google Form submissions, posted by the Apps Script in google/apps-script.gs. The script runs inside
 * Google as the form owner, so it reads the uploaded files from Drive itself — no Drive access is
 * needed here.
 */
export async function POST(req: Request) {
  if (!trustedCaller(req)) return bad("Unauthorised", 401);
  const body = (await req.json()) as {
    fields: Record<string, string>;
    files?: { slot: string; name: string; mime?: string; b64: string }[];
    response_id?: string;
    respondent_email?: string;
  };
  if (!body.fields?.legal_name) return bad("legal_name is required");
  const files: [DocSlot, IncomingFile][] = (body.files ?? [])
    .filter((f) => SLOTS.includes(f.slot as DocSlot) && f.b64)
    .map((f) => [f.slot as DocSlot, { name: f.name, type: realMime(f.mime, f.name), bytes: Buffer.from(f.b64, "base64") }]);

  const result = await intakeStructured({
    source: "google_form",
    form: { ...body.fields, contact_email: body.fields.contact_email || body.respondent_email || "" },
    files,
    meta: { response_id: body.response_id ?? null, respondent_email: body.respondent_email ?? null },
  });
  const base = appUrl(req);
  after(() => runPipeline(result.runId!, base));
  return Response.json({ id: result.id, runId: result.runId }, { status: 201 });
}
