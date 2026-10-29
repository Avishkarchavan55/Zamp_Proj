import "server-only";
import { ProviderError } from "./errors";

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

/**
 * One Gemini generateContent call returning parsed JSON, constrained by `schema` when given.
 * Throws ProviderError with `retryable` set for rate limits, timeouts and 5xx.
 */
export async function geminiJson(opts: {
  model: string;
  parts: Part[];
  schema?: unknown;
  temperature?: number;
  timeoutMs?: number;
}): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ProviderError("GEMINI_API_KEY not set", false, "not_configured");
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: opts.parts }],
        generationConfig: {
          temperature: opts.temperature ?? 0,
          responseMimeType: "application/json",
          ...(opts.schema ? { responseSchema: opts.schema } : {}),
        },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
    });
  } catch (err) {
    throw new ProviderError(`Gemini request failed: ${(err as Error).message}`, true, "timeout");
  }
  if (!res.ok) {
    const body = (await res.text()).slice(0, 240);
    throw new ProviderError(`Gemini ${res.status}: ${body}`, res.status === 429 || res.status >= 500, res.status === 429 ? "rate_limited" : "http_error");
  }
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text;
  if (!text) throw new ProviderError(`Gemini returned no content (${data?.candidates?.[0]?.finishReason ?? "unknown"})`, true, "empty");
  return JSON.parse(text);
}
