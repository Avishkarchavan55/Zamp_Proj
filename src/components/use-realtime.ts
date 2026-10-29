"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

let client: SupabaseClient | null | undefined;

function browserClient() {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}

/**
 * Subscribes to a Supabase Realtime broadcast topic and calls `onUpdate` on every push. The payload
 * is only a "something changed" signal; data is always refetched through the authenticated API.
 * Returns whether the live connection is up (callers fall back to polling when it isn't).
 */
export function useRealtime(topic: string | null, onUpdate: () => void) {
  const [live, setLive] = useState(false);
  useEffect(() => {
    const sb = browserClient();
    if (!sb || !topic) return;
    const channel = sb
      .channel(topic)
      .on("broadcast", { event: "update" }, () => onUpdate())
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      setLive(false);
      void sb.removeChannel(channel);
    };
  }, [topic, onUpdate]);
  return live;
}
