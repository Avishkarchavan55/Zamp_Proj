/** How a request for missing documents is followed up. Shown in a dialog on the Emails page and on Info. */
export function FollowUpSteps({ waitMinutes, maxReminders }: { waitMinutes?: number; maxReminders?: number }) {
  const steps = [
    { t: "Request written", d: "VendorIQ writes one email listing exactly what is missing, with a link to upload it." },
    { t: "Sent from the onboarding inbox", d: "The supplier also gets a short notice of it in their supplier portal. Delivery is confirmed back to us." },
    { t: `Wait ${waitMinutes ?? "a set time"}${waitMinutes ? " min" : ""}`, d: "Then a reminder, if there is no reply. In real use this is 1 to 2 days." },
    { t: "Supplier replied?", d: "If they upload or reply, the reminders stop and every check runs again." },
    { t: `Up to ${maxReminders ?? "a few"} reminders`, d: "Still silent? The supplier is flagged \"No reply\" and appears under Needs attention." },
  ];
  return (
    <ol className="divide-y divide-line">
      {steps.map((s, i) => (
        <li key={s.t} className="flex gap-3 py-3">
          <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-line text-[12px] font-semibold text-ink-2">{i + 1}</span>
          <span>
            <span className="block text-[14px] font-medium text-ink">{s.t}</span>
            <span className="block text-[13px] leading-5 text-ink-3">{s.d}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
