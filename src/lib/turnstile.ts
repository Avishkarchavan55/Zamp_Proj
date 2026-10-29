import "server-only";

/**
 * Cloudflare Turnstile (free, invisible captcha) for the public vendor portal. Skipped when not
 * configured, and for trusted server-to-server callers (seed script, Apps Script) holding the intake secret.
 */
export async function verifyHuman(req: Request, token: string | null): Promise<string | null> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return null;
  if (trustedCaller(req)) return null;
  if (!token) return "Please complete the human verification.";
  const body = new URLSearchParams({ secret, response: token });
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0];
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(6000) });
    const data = (await res.json()) as { success: boolean };
    return data.success ? null : "Human verification failed — please try again.";
  } catch {
    // Fail open on Cloudflare outages: submissions are still verified by the pipeline.
    return null;
  }
}

/** Server-to-server callers. Without a configured secret this is open in development only. */
export function trustedCaller(req: Request) {
  const secret = process.env.INTAKE_SHARED_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-vendoriq-secret") === secret;
}
