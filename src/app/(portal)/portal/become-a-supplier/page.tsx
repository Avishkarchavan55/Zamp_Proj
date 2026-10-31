import type { Metadata } from "next";
import { SupplierContent } from "@/components/supplier-content";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Become a supplier · Acme Manufacturing" };

/** For a signed-in supplier who wants to register another business, or point a colleague to the right place. */
export default function BecomeASupplier() {
  return (
    <div>
      <PageHeader title="Become a supplier" subtitle="Register another business with Acme Manufacturing, in whichever way suits you." />
      <SupplierContent intro={false} />
    </div>
  );
}
