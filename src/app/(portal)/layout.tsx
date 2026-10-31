import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { getSupplier } from "@/lib/supplier";

/** Everything under /portal needs a supplier sign-in (application reference + contact email). */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supplier = await getSupplier();
  if (!supplier) redirect("/login?portal=supplier");
  return <PortalShell email={supplier.email}>{children}</PortalShell>;
}
