import "server-only";

/** Where vendors can apply. Public information: shown on the portal and the "Become a supplier" page. */
export function channels(baseUrl: string) {
  return {
    portal_url: `${baseUrl.replace(/\/$/, "")}/apply`,
    intake_email: firstEmail(process.env.INTAKE_EMAIL, process.env.NEXT_PUBLIC_INTAKE_EMAIL, process.env.SMTP_USER),
    google_form_url: process.env.NEXT_PUBLIC_GOOGLE_FORM_URL || null,
  };
}

export type Channels = ReturnType<typeof channels>;

/** First value that is a plain email address (ignores blanks and malformed values). */
function firstEmail(...values: (string | undefined)[]) {
  for (const v of values) {
    const m = v?.trim().match(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i);
    if (m) return m[0];
  }
  return null;
}
