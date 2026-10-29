"use client";

import { SWRConfig } from "swr";
import { ToastProvider } from "./toast";

export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
  return res.json();
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: true, dedupingInterval: 500 }}>
      <ToastProvider>{children}</ToastProvider>
    </SWRConfig>
  );
}
