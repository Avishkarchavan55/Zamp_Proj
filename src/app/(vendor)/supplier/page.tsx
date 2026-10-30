import type { Metadata } from "next";
import { SupplierContent } from "@/components/supplier-content";

export const metadata: Metadata = { title: "Become a supplier · Acme Manufacturing" };

/** Public landing page that procurement shares (link, email, WhatsApp, printed QR code on RFQs and POs). */
export default function SupplierPage() {
  return <SupplierContent />;
}
