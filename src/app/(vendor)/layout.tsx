import { Factory, Lock } from "lucide-react";

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-white"><Factory className="h-5 w-5" /></div>
            <div className="leading-tight">
              <div className="text-[15px] font-semibold text-ink">Acme Manufacturing</div>
              <div className="text-xs text-ink-3">Supplier registration portal</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-3"><Lock className="h-3.5 w-3.5" /> Secure submission</div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</main>
      <footer className="pb-8 text-center text-xs text-ink-3">Verification powered by VendorIQ</footer>
    </div>
  );
}
