"use client";

import Icon from "@/components/Icon";

// Shown inside the dashboard layout, so the sidebar stays usable.
export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--bad)_14%,transparent)] text-[var(--bad)]">
        <Icon name="alert" size={22} />
      </span>
      <h1 className="text-lg font-semibold">This page couldn&apos;t load</h1>
      <p className="max-w-md text-sm text-[var(--mut)]">
        Something went wrong while loading your data. Your devices keep reporting in the meantime.
        {error.digest && <span className="mt-1 block text-xs">Reference {error.digest}</span>}
      </p>
      <div className="mt-2 flex gap-2">
        <button onClick={() => retry()} className="btn btn-primary">Try again</button>
        <a href="/dashboard" className="btn">Back to Devices</a>
      </div>
    </div>
  );
}
