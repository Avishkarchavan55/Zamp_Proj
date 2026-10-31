import { ArrowRight, FileSpreadsheet, Globe, Mail } from "@/components/icons";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { channels } from "@/lib/channels";

/** The base URL of this deployment, for links and QR codes. */
export async function siteUrl() {
  const h = await headers();
  return process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

/**
 * "Become a supplier": the three ways to apply (with QR codes), documents needed and what happens next.
 * Public at /supplier (what procurement shares) and inside the console at /share.
 */
export async function SupplierContent({ intro = true }: { intro?: boolean }) {
  const base = await siteUrl();
  const ch = channels(base);
  // QR codes stay dark-on-white in both themes so every phone camera can read them.
  const qr = (url: string) => QRCode.toString(url, { type: "svg", margin: 1, width: 122, color: { dark: "#161616", light: "#ffffff" } });
  const [portalQr, formQr] = await Promise.all([qr(ch.portal_url), ch.google_form_url ? qr(ch.google_form_url) : Promise.resolve(null)]);

  return (
    <div className="space-y-6">
      {intro && <section>
        <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.01em] text-ink">Become a supplier to Acme Manufacturing</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-5 text-ink-2">
          Registration takes about 10 minutes. Your documents are checked automatically, so most suppliers hear back within minutes, not days.
          Choose whichever way suits you below.
        </p>
      </section>}

      <section className="grid gap-4 md:grid-cols-3">
        <Way icon={Globe} title="Online form" badge="Recommended" text="Fill in your details and upload your documents. You'll see what's needed for your type of business." qr={portalQr} qrLabel="Scan to open the form">
          <a href={ch.portal_url} className="btn inline-flex h-10 items-center gap-2 rounded-md bg-action px-4 text-[14px] font-medium text-white transition-colors duration-150 hover:bg-action-2">Start registration <ArrowRight className="h-4 w-4" /></a>
        </Way>
        <Way icon={Mail} title="Email" text="Just email your documents. We read them, fill in the form for you and send a link to check the details.">
          {ch.intake_email ? (
            <div className="space-y-2">
              <a href={`mailto:${ch.intake_email}?subject=Supplier registration`} className="btn flex h-10 items-center rounded-md border border-line-strong px-3 text-[13px] font-medium text-ink transition-colors duration-150 hover:bg-line-2"><span className="truncate" title={ch.intake_email}>{ch.intake_email}</span></a>
              <p className="text-[12px] text-ink-3">Attach the documents listed below. Use a subject such as &ldquo;Supplier registration, your company name&rdquo;.</p>
            </div>
          ) : <p className="text-[13px] text-ink-3">Ask your Acme contact for the onboarding email address.</p>}
        </Way>
        <Way icon={FileSpreadsheet} title="Google Form" text="Prefer Google Forms? Same questions, same checks. Uploading files needs a Google account." qr={formQr} qrLabel="Scan to open the Google Form">
          {ch.google_form_url
            ? <a href={ch.google_form_url} target="_blank" rel="noreferrer" className="btn inline-flex h-10 items-center gap-2 rounded-md border border-line-strong px-4 text-[14px] font-medium text-ink transition-colors duration-150 hover:bg-line-2">Open the Google Form <ArrowRight className="h-4 w-4" /></a>
            : <p className="text-[13px] text-ink-3">Not available yet.</p>}
        </Way>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-md border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-3 text-[14px] font-semibold text-ink">Documents you&apos;ll need</h2>
          <ul className="divide-y divide-line px-5 text-[14px]">
            {[
              ["GST registration certificate (REG-06)", "Everyone"],
              ["PAN card of the business", "Everyone"],
              ["Cancelled cheque or bank letter", "Everyone: the account payments go to"],
              ["Certificate of Incorporation", "Companies and LLPs only"],
              ["Udyam certificate", "Only registered MSMEs"],
            ].map(([doc, who]) => (
              <li key={doc} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2.5">
                <span className="font-medium text-ink">{doc}</span>
                <span className="text-[13px] text-ink-3">{who}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-5 py-3 text-[12px] text-ink-3">PDF, PNG or JPG. Clear phone photos are fine.</p>
        </div>
        <div className="rounded-md border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-3 text-[14px] font-semibold text-ink">What happens next</h2>
          <ol className="divide-y divide-line px-5 text-[14px]">
            {[
              ["We check everything automatically", "GSTIN, PAN, bank IFSC and names are checked against your documents and official registries."],
              ["If something is missing, we tell you exactly what", "You get one email listing what to fix, with a link to upload it. There is no form to start again."],
              ["You are approved", "You are set up for purchase orders and payments. Registered MSMEs are paid within 45 days, as the law requires."],
            ].map(([t, d], n) => (
              <li key={t} className="flex gap-3 py-3">
                <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-line text-[12px] font-semibold text-ink-2">{n + 1}</span>
                <span><span className="block font-medium text-ink">{t}</span><span className="block text-[13px] leading-5 text-ink-3">{d}</span></span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}

function Way({ icon: Icon, title, badge, text, qr, qrLabel, children }: {
  icon: React.ElementType; title: string; badge?: string; text: string; qr?: string | null; qrLabel?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-md border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold text-ink"><Icon className="h-4 w-4 text-ink-3" />{title}</h2>
        {badge && <span className="inline-flex h-5 items-center rounded-full bg-brand-soft px-2 text-[12px] font-medium text-brand-2">{badge}</span>}
      </div>
      <p className="mt-1.5 text-[13px] leading-snug text-ink-2">{text}</p>
      {qr && (
        <figure className="mt-4 flex items-center gap-3">
          <div className="h-[132px] w-[132px] shrink-0 overflow-hidden rounded-sm border border-line bg-white p-1" dangerouslySetInnerHTML={{ __html: qr }} />
          <figcaption className="text-[12px] text-ink-3">{qrLabel}</figcaption>
        </figure>
      )}
      <div className="mt-auto pt-4">{children}</div>
    </div>
  );
}
