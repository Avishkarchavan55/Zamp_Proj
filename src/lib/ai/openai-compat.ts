import "server-only";
import { ProviderError } from "./errors";
import { parseJsonLoose } from "./schema";

/**
 * OpenAI-compatible chat completions with image input. Used for two free fallbacks that speak the
 * same protocol: OpenRouter (free vision models) and Cloudflare Workers AI.
 */
export async function chatJsonWithImages(opts: {
  url: string;
  apiKey: string;
  model: string;
  prompt: string;
  images: { mime: string; b64: string }[];
  jsonMode?: boolean;
  timeoutMs?: number;
  extraHeaders?: Record<string, string>;
}): Promise<{ json: unknown; model: string }> {
  const content = [
    { type: "text", text: opts.prompt },
    ...opts.images.map((i) => ({ type: "image_url", image_url: { url: `data:${i.mime};base64,${i.b64}` } })),
  ];
  let res: Response;
  try {
    res = await fetch(opts.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}`, ...opts.extraHeaders },
      body: JSON.stringify({
        model: opts.model,
        temperature: 0,
        max_tokens: 2000,
        messages: [{ role: "user", content }],
        ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 40_000),
    });
  } catch (err) {
    throw new ProviderError(`${opts.model} request failed: ${(err as Error).message}`, true, "timeout");
  }
  if (!res.ok) {
    const body = (await res.text()).slice(0, 240);
    throw new ProviderError(`${opts.model} ${res.status}: ${body}`, res.status === 429 || res.status >= 500, res.status === 429 ? "rate_limited" : "http_error");
  }
  const data = await res.json();
  if (data?.error) throw new ProviderError(`${opts.model}: ${JSON.stringify(data.error).slice(0, 240)}`, true, "http_error");
  const text: string | undefined = data?.choices?.[0]?.message?.content ?? data?.result?.response;
  if (!text) throw new ProviderError(`${opts.model} returned no content`, true, "empty");
  try {
    return { json: parseJsonLoose(text), model: data?.model ?? opts.model };
  } catch {
    throw new ProviderError(`${opts.model} did not return JSON`, true, "invalid_output");
  }
}
