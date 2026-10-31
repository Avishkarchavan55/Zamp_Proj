import { ExternalLink } from "@/components/icons";
import { CopyLink } from "@/components/copy-link";
import { SupplierContent, siteUrl } from "@/components/supplier-content";
import { PageHeader } from "@/components/ui";

/** What new suppliers see on the public "Become a supplier" page, shown inside the console for sharing. */
export default async function SharePage() {
  const url = `${await siteUrl()}/supplier`;
  return (
    <div>
      <PageHeader
        title="Become a supplier"
        subtitle="Send this page to new suppliers - by email, WhatsApp or printed on RFQs and purchase orders. The QR codes work on paper."
        right={
          <>
            <CopyLink url={url} />
            <a href="/supplier" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink hover:bg-line-2">
              <ExternalLink className="h-4 w-4" /> Open as suppliers see it
            </a>
          </>
        }
      />
      <SupplierContent intro={false} />
    </div>
  );
}
