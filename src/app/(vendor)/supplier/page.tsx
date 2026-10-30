import { ArrowRight, BadgeCheck, CheckCircle2, FileSpreadsheet, FileText, Globe, Mail, MailQuestion, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { channels } from "@/lib/channels";

export const metadata: Metadata = { title: "Become a supplier · Acme Manufacturing" };

/** Public landing page that procurement shares (link, email, WhatsApp, printed QR code on RFQs and POs). */
export default async function SupplierPage() {
  const h = await headers();
  const base = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const ch = channels(base);
  // QR codes stay dark-on-white in both themes so every phone camera can read them.
  const qr = (url: string) => QRCode.toString(url, { type: "svg", margin: 1, width: 122, color: { dark: "#0f172a", light: "#ffffff" } });
  const [portalQr, formQr] = await Promise.all([qr(ch.portal_url), ch.google_form_url ? qr(ch.google_form_url) : Promise.resolve(null)]);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">Become a supplier to Acme Manufacturing</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-2">
          Registration takes about 10 minutes. Your documents are checked automatically, so most suppliers hear back within minutes, not days.
          Choose whichever way suits you below.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Way icon={Globe} title="Online form" badge="Recommended" text="Fill in your details and upload your documents. You'll see what's needed for your type of business." qr={portalQr} qrLabel="Scan to open the form">
          <a href={ch.portal_url} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[14px] font-medium text-white hover:bg-brand-2">Start registration <ArrowRight className="h-4 w-4" /></a>
        </Way>
        <Way icon={Mail} title="Email" text="Just email your documents. We read them, fill in the form for you and send a link to check the details.">
          {ch.intake_email ? (
            <div className="space-y-2">
              <a href={`mailto:${ch.intake_email}?subject=Supplier registration`} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-ink hover:bg-line-2"><Mail className="h-4 w-4 shrink-0" /><span className="break-all">{ch.intake_email}</span></a>
              <p className="text-[12.5px] text-ink-3">Attach the documents listed below. Use a subject like &ldquo;Supplier registration – your company name&rdquo;.</p>
            </div>
          ) : <p className="text-[13px] text-ink-3">Ask your Acme contact for the onboarding email address.</p>}
        </Way>
        <Way icon={FileSpreadsheet} title="Google Form" text="Prefer Google Forms? Same questions, same checks. Uploading files needs a Google account." qr={formQr} qrLabel="Scan to open the Google Form">
          {ch.google_form_url
            ? <a href={ch.google_form_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-[14px] font-medium text-ink hover:bg-line-2">Open the Google Form <ArrowRight className="h-4 w-4" /></a>
            : <p className="text-[13px] text-ink-3">Not available yet.</p>}
        </Way>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><FileText className="h-4 w-4 text-ink-3" />Documents you&apos;ll need</h2>
          <ul className="mt-3 space-y-2 text-[14px] text-ink-2">
            {[
              ["GST registration certificate (REG-06)", "everyone"],
              ["PAN card of the business", "everyone"],
              ["Cancelled cheque or bank letter", "everyone — the account the payments go to"],
              ["Certificate of Incorporation", "companies and LLPs only"],
              ["Udyam certificate", "only if you are a registered MSME"],
            ].map(([doc, who]) => (
              <li key={doc} className="flex gap-2.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good-ink" /><span><span className="font-medium text-ink">{doc}</span> <span className="text-ink-3">· {who}</span></span></li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] text-ink-3">PDF, PNG or JPG. Clear phone photos are fine.</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><ShieldCheck className="h-4 w-4 text-ink-3" />What happens next</h2>
          <ol className="mt-3 space-y-3 text-[14px] text-ink-2">
            {[
              [BadgeCheck, "We check everything automatically", "GSTIN, PAN, bank IFSC and names are checked against your documents and official registries."],
              [MailQuestion, "If something's missing, we tell you exactly what", "You get one email listing what to fix, with a link to upload it. No forms to start again."],
              [CheckCircle2, "You're approved", "You're set up for purchase orders and payments. Registered MSMEs are paid within 45 days, as the law requires."],
            ].map(([Icon, t, d]) => {
              const I = Icon as React.ElementType;
              return (
                <li key={t as string} className="flex gap-3">
                  <I className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <span><span className="font-medium text-ink">{t as string}</span><br /><span className="text-ink-3">{d as string}</span></span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <p className="text-center text-[12.5px] text-ink-3">Procurement teams: share this page&apos;s link, or print it (Ctrl + P) — the QR codes work on paper, posters and purchase orders.</p>
    </div>
  );
}

function Way({ icon: Icon, title, badge, text, qr, qrLabel, children }: {
  icon: React.ElementType; title: string; badge?: string; text: string; qr?: string | null; qrLabel?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold text-ink"><Icon className="h-4 w-4 text-ink-3" />{title}</h2>
        {badge && <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[12px] font-medium text-brand-2">{badge}</span>}
      </div>
      <p className="mt-1.5 text-[13.5px] leading-snug text-ink-2">{text}</p>
      {qr && (
        <figure className="mt-4 flex items-center gap-3">
          <div className="h-[132px] w-[132px] shrink-0 overflow-hidden rounded-lg border border-line bg-white p-1" dangerouslySetInnerHTML={{ __html: qr }} />
          <figcaption className="text-[12.5px] text-ink-3">{qrLabel}</figcaption>
        </figure>
      )}
      <div className="mt-auto pt-4">{children}</div>
    </div>
  );
}
