import { requireStaff } from "@/lib/auth";
import { composeInformationRequest, dispatch } from "@/lib/comms";
import { ROLE_LABEL, can } from "@/lib/session";
import { json, query } from "@/lib/db";
import { appUrl, bad } from "@/lib/http";
import { audit, getApplication } from "@/lib/repo";
import type { Decision, RequestedItem } from "@/lib/types";

/**
 * Human decisions. A reviewer can approve (override), reject, or ask the vendor for something specific.
 * A note is mandatory: the audit trail must say why a person overrode or confirmed the engine.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/applications/[id]/review">) {
  const staff = await requireStaff(can.decide);
  if (staff instanceof Response) return staff;
  const { id } = await ctx.params;
  const app = await getApplication(id);
  if (!app) return bad("Not found", 404);
  if (app.status === "processing") return bad("Wait for the current run to finish", 409);

  const body = (await req.json()) as {
    action: "approve" | "reject" | "request_info";
    note?: string;
    items?: { title: string; instruction: string; kind?: "document" | "field"; slot?: RequestedItem["slot"] }[];
  };
  // Identity comes from the signed session - never from the request body.
  const reviewer = `${staff.name} (${ROLE_LABEL[staff.role]})`;
  const note = body.note?.trim() ?? "";
  if (!note) return bad("A note explaining the decision is required");

  const prev = app.decision;
  const base: Decision = prev ?? {
    outcome: "in_review", headline: "", summary: "", reasons: [], next_actions: [], conditions: [], requested_items: [],
    rule_trace: [], counts: { passed: 0, failed: 0, warning: 0, unverified: 0, skipped: 0 }, decided_by: "policy_engine",
  };

  // Segregation of duties: only a Finance Controller can reverse a rejection.
  if (app.status === "rejected" && body.action !== "reject" && !can.overrideRejection(staff.role)) {
    return bad("Only a Finance Controller can override a rejection.", 403);
  }

  if (body.action === "approve" || body.action === "reject") {
    const outcome = body.action === "approve" ? "approved" : "rejected";
    const decision: Decision = {
      ...base,
      outcome,
      headline: outcome === "approved"
        ? `Approved by ${reviewer}${prev?.outcome !== "approved" ? " (override)" : ""}`
        : `Rejected by ${reviewer}`,
      summary: note,
      next_actions: outcome === "approved"
        ? ["Create the vendor master record in the ERP.", ...base.conditions.map((c) => `Condition: ${c}`)]
        : ["Do not create the vendor or release payments.", "Inform the vendor of the outcome."],
      decided_by: reviewer,
    };
    await query(`update applications set status=$2, decision=$3::jsonb, decided_at=now(), decided_by=$4, updated_at=now() where id=$1`, [
      id, outcome, json(decision), reviewer,
    ]);
    await audit(id, reviewer, outcome === "approved" ? "review_approved" : "review_rejected", {
      note, previous_outcome: prev?.outcome, override: prev?.outcome !== outcome,
    });
    return Response.json({ ok: true });
  }

  if (body.action === "request_info") {
    const items: RequestedItem[] = (body.items ?? [])
      .filter((i) => i.title?.trim())
      .map((i, n) => ({
        code: `review.${n}`, kind: i.kind ?? (i.slot ? "document" : "field"), slot: i.slot, title: i.title.trim(),
        instruction: i.instruction?.trim() || i.title.trim(),
      }));
    if (!items.length) return bad("Add at least one item to request");
    const decision: Decision = {
      ...base, outcome: "awaiting_vendor",
      headline: `Awaiting vendor - clarification requested by ${reviewer}`,
      summary: note, requested_items: items, decided_by: reviewer,
      next_actions: ["Vendor has been emailed with a resubmission link.", "Application re-runs automatically on resubmission."],
    };
    await query(`update applications set status='awaiting_vendor', decision=$2::jsonb, decided_at=now(), decided_by=$3, updated_at=now() where id=$1`, [
      id, json(decision), reviewer,
    ]);
    const fresh = (await getApplication(id))!;
    const url = appUrl(req);
    const comm = await dispatch({
      app: fresh, runId: fresh.latest_run_id, kind: "reviewer_request", to: fresh.contact_email,
      content: await composeInformationRequest(fresh, items, url), appUrl: url, reminders: true, meta: { items, reviewer, note },
    });
    await audit(id, reviewer, "clarification_requested", { note, items: items.map((i) => i.title), communication_id: comm.id });
    return Response.json({ ok: true, communication: comm });
  }
  return bad("Unknown action");
}
