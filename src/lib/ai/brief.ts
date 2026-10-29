import "server-only";
import { z } from "zod";
import type { Check } from "../checks";
import { geminiJson } from "./gemini";

/**
 * Reviewer brief: a plain-English explanation of a "Needs review" case for a non-technical reviewer.
 * Built only from the check results (never the raw documents) and stored beside the decision —
 * it cannot change the outcome. Returns null when no model is available.
 */

const BriefSchema = z.object({
  summary: z.string(),
  likely_benign: z.string(),
  likely_risk: z.string(),
  ask_vendor: z.array(z.object({ title: z.string(), instruction: z.string() })).max(3),
});

export type ReviewerBrief = z.infer<typeof BriefSchema> & { model: string };

const SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    likely_benign: { type: "STRING" },
    likely_risk: { type: "STRING" },
    ask_vendor: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { title: { type: "STRING" }, instruction: { type: "STRING" } }, required: ["title", "instruction"] },
    },
  },
  required: ["summary", "likely_benign", "likely_risk", "ask_vendor"],
};

export async function reviewerBrief(vendorName: string, checks: Check[]): Promise<ReviewerBrief | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  const issues = checks
    .filter((c) => (c.status === "failed" || c.status === "warning") && c.route !== "none")
    .map((c) => ({ check: c.label, finding: c.message, evidence: c.evidence ?? null, rule: c.rule }));
  if (!issues.length) return null;
  const prompt = `You help a procurement reviewer at an Indian manufacturer decide on a vendor application.
Vendor: ${vendorName}
Automated checks flagged these issues (JSON):
${JSON.stringify(issues, null, 1)}

Write for a busy, non-technical reviewer. Use only the facts above; do not invent documents, names or numbers.
- summary: 2 sentences — what does not add up, in plain words.
- likely_benign: 1 sentence — the most plausible innocent explanation.
- likely_risk: 1 sentence — what could go wrong (fraud, tax or payment risk) if it is not innocent.
- ask_vendor: 1–3 specific things to ask the vendor for that would resolve it (title + one-sentence instruction addressed to the vendor).`;
  for (const model of [process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite", process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.5-flash"]) {
    try {
      const raw = await geminiJson({ model, parts: [{ text: prompt }], schema: SCHEMA, temperature: 0.2, timeoutMs: 20_000 });
      const parsed = BriefSchema.safeParse(raw);
      if (parsed.success) return { ...parsed.data, model };
    } catch {
      // try the next model
    }
  }
  return null;
}
