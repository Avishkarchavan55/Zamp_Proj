import { after } from "next/server";
import { SLOTS, appUrl, bad, validateFile } from "@/lib/http";
import { intakeStructured } from "@/lib/intake";
import { runPipeline } from "@/lib/pipeline";
import { listApplications, toIncoming, type IncomingFile } from "@/lib/repo";
import { verifyHuman, trustedCaller } from "@/lib/turnstile";
import type { DocSlot, EntityType } from "@/lib/types";

export const maxDuration = 300;

const ENTITY_TYPES: EntityType[] = ["private_limited", "public_limited", "llp", "partnership", "proprietorship"];

export async function GET() {
  return Response.json(await listApplications());
}

/** Vendor portal submission. */
export async function POST(req: Request) {
  const data = await req.formData();
  const human = await verifyHuman(req, data.get("cf-turnstile-response") as string | null);
  if (human) return bad(human, 403);

  let form: Record<string, unknown>;
  try {
    form = JSON.parse(String(data.get("form") ?? "{}"));
  } catch {
    return bad("Malformed form payload");
  }
  if (!String(form.legal_name ?? "").trim()) return bad("Legal name is required");
  if (!ENTITY_TYPES.includes(form.entity_type as EntityType)) return bad("Choose an entity type");
  if (!/^\S+@\S+\.\S+$/.test(String(form.contact_email ?? ""))) return bad("A valid contact email is required");

  const files: [DocSlot, IncomingFile][] = [];
  for (const slot of SLOTS) {
    const f = data.get(slot);
    if (f instanceof File && f.size > 0) {
      const err = validateFile(f);
      if (err) return bad(err);
      files.push([slot, await toIncoming(f)]);
    }
  }

  // Importing historical vendors (trusted scripts only): recorded and checked, but nobody is emailed.
  const quiet = data.get("quiet") === "true" && trustedCaller(req);
  const result = await intakeStructured({
    source: "portal", form, files, scenario: (data.get("scenario") as string) || null, meta: quiet ? { quiet: true } : undefined,
  });
  const base = appUrl(req);
  after(() => runPipeline(result.runId!, base));
  return Response.json({ id: result.id, runId: result.runId }, { status: 201 });
}
