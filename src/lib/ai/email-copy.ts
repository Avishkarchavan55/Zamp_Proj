import "server-only";
import { z } from "zod";
import type { RequestedItem } from "../types";
import { geminiJson } from "./gemini";

/**
 * AI-worded opening paragraph for vendor emails. The list of requested items is always rendered by
 * code; the model only writes the friendly framing. Output is rejected (and the template used) if it
 * introduces numbers, links or is the wrong length - the model must not invent facts.
 */

const Out = z.object({ intro: z.string() });

export async function aiIntro(opts: {
  vendor: string;
  contact: string;
  buyer: string;
  items: RequestedItem[];
  reminderNo: number;
  channel: string;
}): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY || process.env.AI_EMAIL_COPY === "off") return null;
  const prompt = `Write the opening paragraph (2–3 sentences, plain text, no greeting line, no sign-off) of an email from
${opts.buyer}'s vendor onboarding team to ${opts.contact} at ${opts.vendor}.
Context: ${opts.reminderNo ? `this is reminder number ${opts.reminderNo}; they have not responded yet` : `they applied via ${opts.channel} to become a supplier`}.
We need these items (the list itself is shown separately below your paragraph, do not repeat it):
${opts.items.map((i) => `- ${i.title}`).join("\n")}
Tone: warm, specific, professional, Indian business English. Explain briefly why we need it (to complete verification
before we can pay them). Do not include any numbers, IDs, dates, links or promises about timelines.`;
  try {
    const raw = await geminiJson({
      model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
      parts: [{ text: prompt }],
      schema: { type: "OBJECT", properties: { intro: { type: "STRING" } }, required: ["intro"] },
      temperature: 0.4,
      timeoutMs: 12_000,
    });
    const intro = Out.parse(raw).intro.trim();
    if (intro.length < 60 || intro.length > 600) return null;
    if (/\d{3,}|https?:|www\./i.test(intro)) return null;
    return intro;
  } catch {
    return null;
  }
}
