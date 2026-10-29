"use client";

import { ArrowRight, CheckCircle2, Clock3 } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import type { AppListRow } from "@/components/api-types";
import { Button, Card, Empty, PageHeader, Skeleton, ago } from "@/components/ui";
import { ENTITY_SHORT, issueTitle } from "@/lib/ui-meta";

export default function ReviewQueue() {
  const { data } = useSWR<AppListRow[]>("/api/applications", { refreshInterval: 4000 });
  // Oldest first: whoever has waited longest is reviewed first.
  const review = (data ?? []).filter((a) => a.status === "in_review").sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  const waitingOnVendor = (data ?? []).filter((a) => a.status === "awaiting_vendor").length;

  return (
    <div>
      <PageHeader
        title="Needs your decision"
        subtitle={
          !data ? "…" : review.length
            ? `${review.length} vendor${review.length === 1 ? "" : "s"} where the documents don't add up. Oldest first.`
            : "Nothing to decide — every vendor was handled automatically."
        }
      />

      {!data ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : review.length === 0 ? (
        <Card><Empty icon={CheckCircle2} title="You're all caught up">New cases appear here only when documents disagree.</Empty></Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {review.map((a) => {
            const issues = (a.reasons ?? []).map((r) => issueTitle(r.code));
            const unique = [...new Set(issues)];
            return (
              <Link key={a.id} href={`/applications/${a.id}`} className="group flex flex-col gap-3 px-5 py-4 transition-colors duration-150 hover:bg-line-2/60 sm:flex-row sm:items-center sm:gap-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[15.5px] font-semibold text-ink">{a.legal_name}</span>
                    <span className="text-[13px] text-ink-3">{ENTITY_SHORT[a.entity_type]} · {a.city}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {unique.map((t) => (
                      <span key={t} className="inline-flex items-center rounded-md bg-serious-soft px-2 py-0.5 text-[13px] font-medium text-serious-ink">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="flex items-center gap-1.5 text-[13px] text-ink-3"><Clock3 className="h-3.5 w-3.5" />waiting {ago(a.updated_at).replace(" ago", "")}</span>
                  <Button size="sm" tabIndex={-1} className="pointer-events-none">Review <ArrowRight className="h-4 w-4" /></Button>
                </div>
              </Link>
            );
          })}
        </Card>
      )}

      {data && waitingOnVendor > 0 && (
        <p className="mt-5 text-[14px] text-ink-3">
          {waitingOnVendor} other vendor{waitingOnVendor === 1 ? " is" : "s are"} waiting to fix something — they&apos;re emailed and reminded automatically.{" "}
          <Link href="/applications?status=awaiting_vendor" className="font-medium text-brand hover:underline">See them</Link>
        </p>
      )}
    </div>
  );
}
