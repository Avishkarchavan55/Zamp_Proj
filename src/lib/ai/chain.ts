import "server-only";
import { KEY_FIELDS, THRESHOLDS } from "../policy";
import type { DocSlot, Extraction } from "../types";
import { ProviderError } from "./errors";
import { geminiJson } from "./gemini";
import { chatJsonWithImages } from "./openai-compat";
import { inspectPdf, renderPdfPages, type PdfInfo } from "./pdf";
import { extractWithRegex } from "./regex";
import { ExtractionSchema, GEMINI_RESPONSE_SCHEMA, ID_FIELDS, extractionPrompt } from "./schema";

/**
 * Document-reading fallback chain. Providers are tried in order; each failure is recorded so the UI
 * can show exactly which model read a document and why earlier ones were skipped.
 *
 *   Gemini Flash → Gemini Flash-Lite → OpenRouter free vision → Cloudflare Workers AI → PDF text + regex
 *
 * If every provider fails the caller marks the document as unreadable and a human takes over.
 */

export interface Attempt {
  provider: string;
  ok: boolean;
  ms: number;
  error?: string;
  skipped?: boolean;
}

export interface ChainResult {
  extraction: Extraction;
  provider: string;
  attempts: Attempt[];
  pdf: Omit<PdfInfo, "text"> | null;
}

interface Input {
  mime: string;
  b64: string;
  bytes: Uint8Array;
}

interface Provider {
  id: string;
  configured: () => boolean;
  /** Pdf-only providers (regex) are skipped for images. */
  needsTextLayer?: boolean;
  run: (slot: DocSlot | null, input: Input, ctx: { pdf: PdfInfo | null; images: () => Promise<{ mime: string; b64: string }[]> }) => Promise<Extraction>;
}

// Fast model first; the stronger model is the fallback and the second opinion on uncertain fields.
const GEMINI_MODEL = () => process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const GEMINI_FALLBACK = () => process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.5-flash";
const OPENROUTER_MODELS = () => (process.env.OPENROUTER_MODELS ?? "google/gemma-4-31b-it:free,nvidia/nemotron-3.5-super-vl:free").split(",").map((s) => s.trim()).filter(Boolean);
const WORKERS_MODEL = () => process.env.WORKERS_AI_MODEL ?? "@cf/meta/llama-4-scout-17b-16e-instruct";

function validate(raw: unknown, who: string): Extraction {
  const parsed = ExtractionSchema.safeParse(raw);
  if (!parsed.success) throw new ProviderError(`${who} returned an unexpected shape`, true, "invalid_output");
  return parsed.data as Extraction;
}

const gemini = (id: string, model: () => string): Provider => ({
  id,
  configured: () => !!process.env.GEMINI_API_KEY,
  run: async (slot, input) =>
    validate(
      await geminiJson({
        model: model(),
        parts: [{ inline_data: { mime_type: input.mime, data: input.b64 } }, { text: extractionPrompt(slot, false) }],
        schema: GEMINI_RESPONSE_SCHEMA,
      }),
      model(),
    ),
});

const openrouter: Provider = {
  id: "openrouter",
  configured: () => !!process.env.OPENROUTER_API_KEY,
  run: async (slot, _input, ctx) => {
    const images = await ctx.images();
    let last: unknown;
    for (const model of OPENROUTER_MODELS()) {
      try {
        const { json } = await chatJsonWithImages({
          url: "https://openrouter.ai/api/v1/chat/completions",
          apiKey: process.env.OPENROUTER_API_KEY!,
          model,
          prompt: extractionPrompt(slot, true),
          images,
          jsonMode: true,
          extraHeaders: { "HTTP-Referer": process.env.APP_URL ?? "https://vendoriq.app", "X-Title": "VendorIQ" },
        });
        return validate(json, model);
      } catch (err) {
        last = err;
      }
    }
    throw last instanceof ProviderError ? last : new ProviderError(String(last), true, "http_error");
  },
};

const workersAi: Provider = {
  id: "workers-ai",
  configured: () => !!(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN),
  run: async (slot, _input, ctx) => {
    const { json } = await chatJsonWithImages({
      url: `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/v1/chat/completions`,
      apiKey: process.env.CF_API_TOKEN!,
      model: WORKERS_MODEL(),
      prompt: extractionPrompt(slot, true),
      images: (await ctx.images()).slice(0, 1),
    });
    return validate(json, WORKERS_MODEL());
  },
};

const regex: Provider = {
  id: "pdf-text-regex",
  configured: () => true,
  needsTextLayer: true,
  run: async (_slot, _input, ctx) => extractWithRegex(ctx.pdf!.text),
};

const ALL: Record<string, Provider> = {
  gemini: gemini("gemini", GEMINI_MODEL),
  "gemini-lite": gemini("gemini-lite", GEMINI_FALLBACK),
  openrouter,
  "workers-ai": workersAi,
  regex,
};

export function providerOrder(): Provider[] {
  const order = (process.env.AI_PROVIDERS ?? "gemini,gemini-lite,openrouter,workers-ai,regex").split(",").map((s) => s.trim());
  return order.map((id) => ALL[id]).filter(Boolean);
}

export function providerLabel(id: string) {
  if (id === "gemini") return GEMINI_MODEL();
  if (id === "gemini-lite") return GEMINI_FALLBACK();
  if (id === "openrouter") return `OpenRouter (${OPENROUTER_MODELS()[0]})`;
  if (id === "workers-ai") return `Workers AI (${WORKERS_MODEL().replace("@cf/", "")})`;
  if (id === "pdf-text-regex") return "PDF text + rules (no AI)";
  return id;
}

export function chainSummary() {
  return providerOrder().map((p) => ({ id: p.id, label: providerLabel(p.id), configured: p.configured() }));
}

// ---- circuit breaker: skip a provider for a while after it rate-limits us --------------------------
const breaker = new Map<string, number>();
const OPEN_MS = 90_000;
const isOpen = (id: string) => (breaker.get(id) ?? 0) > Date.now();

export async function readDocument(slot: DocSlot | null, input: Input): Promise<ChainResult> {
  const isPdf = input.mime === "application/pdf";
  const pdf = isPdf ? await inspectPdf(input.bytes).catch(() => null) : null;
  let rendered: { mime: string; b64: string }[] | null = null;
  const images = async () => {
    if (rendered) return rendered;
    rendered = isPdf ? (await renderPdfPages(input.bytes)).map((b64) => ({ mime: "image/png", b64 })) : [{ mime: input.mime, b64: input.b64 }];
    return rendered;
  };
  const ctx = { pdf, images };
  const attempts: Attempt[] = [];
  const providers = providerOrder();

  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    if (!p.configured()) {
      attempts.push({ provider: p.id, ok: false, ms: 0, skipped: true, error: "not configured" });
      continue;
    }
    if (p.needsTextLayer && !pdf?.hasTextLayer) {
      attempts.push({ provider: p.id, ok: false, ms: 0, skipped: true, error: isPdf ? "scanned PDF has no text layer" : "image — no text layer" });
      continue;
    }
    if (isOpen(p.id)) {
      attempts.push({ provider: p.id, ok: false, ms: 0, skipped: true, error: "rate-limited recently (circuit open)" });
      continue;
    }
    const t0 = Date.now();
    try {
      let extraction = await p.run(slot, input, ctx);
      attempts.push({ provider: p.id, ok: true, ms: Date.now() - t0 });
      if (pdf?.hasTextLayer && p.id !== "pdf-text-regex") extraction = confirmAgainstText(extraction, pdf.text);
      if (slot) extraction = await secondOpinion(extraction, slot, providers.slice(i + 1), input, ctx, attempts);
      return { extraction, provider: p.id, attempts, pdf: pdf && strip(pdf) };
    } catch (err) {
      const e = err as ProviderError;
      if (e.kind === "rate_limited") breaker.set(p.id, Date.now() + OPEN_MS);
      attempts.push({ provider: p.id, ok: false, ms: Date.now() - t0, error: e.message.slice(0, 200) });
    }
  }
  const error = new Error("No provider could read this document") as Error & { attempts: Attempt[]; pdf: unknown };
  error.attempts = attempts;
  error.pdf = pdf && strip(pdf);
  throw error;
}

function strip(p: PdfInfo): Omit<PdfInfo, "text"> {
  const copy: Partial<PdfInfo> = { ...p };
  delete copy.text;
  return copy as Omit<PdfInfo, "text">;
}
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Anti-hallucination: an identifier the model "read" from a digital PDF must literally exist in the
 * PDF's text layer. Confirmed values gain confidence; values that are not there lose it.
 */
function confirmAgainstText(ex: Extraction, text: string): Extraction {
  const hay = norm(text);
  return {
    ...ex,
    fields: ex.fields.map((f) => {
      const needle = norm(f.value);
      if (!needle || needle.length < 4) return f;
      const found = hay.includes(needle);
      if (ID_FIELDS.has(f.key)) {
        return found
          ? { ...f, confidence: Math.max(f.confidence, 0.97), verified_by: [...(f.verified_by ?? []), "text_layer"] }
          : { ...f, confidence: Math.min(f.confidence, 0.5) };
      }
      return found ? { ...f, verified_by: [...(f.verified_by ?? []), "text_layer"] } : f;
    }),
  };
}

/** Low-confidence key fields get re-read by the next available model; agreement raises confidence. */
async function secondOpinion(
  ex: Extraction, slot: DocSlot, rest: Provider[], input: Input,
  ctx: { pdf: PdfInfo | null; images: () => Promise<{ mime: string; b64: string }[]> }, attempts: Attempt[],
): Promise<Extraction> {
  const weak = ex.fields.filter((f) => KEY_FIELDS[slot]?.includes(f.key) && f.confidence < THRESHOLDS.fieldConfidence);
  if (!weak.length) return ex;
  const next = rest.find((p) => p.configured() && !p.needsTextLayer && !isOpen(p.id));
  if (!next) return ex;
  const t0 = Date.now();
  try {
    const other = await next.run(slot, input, ctx);
    attempts.push({ provider: `${next.id} (second opinion)`, ok: true, ms: Date.now() - t0 });
    return {
      ...ex,
      fields: ex.fields.map((f) => {
        if (!weak.includes(f)) return f;
        const o = other.fields.find((x) => x.key === f.key);
        if (!o) return { ...f, second_opinion: { provider: next.id, value: "", agrees: false } };
        const agrees = norm(o.value) === norm(f.value);
        return {
          ...f,
          confidence: agrees ? Math.max(f.confidence, 0.85) : f.confidence,
          verified_by: agrees ? [...(f.verified_by ?? []), next.id] : f.verified_by,
          second_opinion: { provider: next.id, value: o.value, agrees },
        };
      }),
    };
  } catch (err) {
    attempts.push({ provider: `${next.id} (second opinion)`, ok: false, ms: Date.now() - t0, error: (err as Error).message.slice(0, 160) });
    return ex;
  }
}
