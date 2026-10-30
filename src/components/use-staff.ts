"use client";

import useSWR from "swr";

/** True when the visitor is signed in to the console. Staff-only helpers on public pages use it. */
export function useIsStaff() {
  const { data } = useSWR<{ name: string }>("/api/auth/me", { shouldRetryOnError: false, revalidateOnFocus: false });
  return !!data?.name;
}
