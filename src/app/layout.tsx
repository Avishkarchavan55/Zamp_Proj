import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "VendorIQ — Vendor onboarding",
  description: "Vendor onboarding from submission to decision: document AI, rule-based verification, explainable decisions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plex.variable} ${plexMono.variable} antialiased`}>
      <body className="min-h-screen font-sans text-[15px] leading-normal">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
