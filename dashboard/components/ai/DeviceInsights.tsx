"use client";

import { deviceInsights } from "@/app/actions/ai";
import Icon from "@/components/Icon";
import { AiError, AiLabel, Thinking, useAi } from "@/components/ai/useAi";

const KIND = {
  pattern: { icon: "clock", tone: "text-[var(--idle)]" },
  tip: { icon: "bolt", tone: "text-[var(--idle)]" },
  caution: { icon: "alert", tone: "text-[var(--amber)]" },
} as const;

/** AI summary of when this device is idle and what would add more usable time. */
export default function DeviceInsights({ deviceId, demo = false }: { deviceId: string; demo?: boolean }) {
  const { data, error, off, pending, run } = useAi((mode) => deviceInsights(deviceId, mode, demo));
  if (off) return null;
  const insights = data?.value;

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title flex items-center gap-2"><Icon name="spark" size={16} className="text-[var(--idle)]" /> Insights</h2>
          <p className="card-sub">What this device&apos;s last 7 days say, and what could add more usable idle time.</p>
        </div>
        {insights ? (
          !demo && <button type="button" className="btn btn-sm" disabled={pending} onClick={() => run("refresh")}>{pending ? "Updating…" : "Refresh"}</button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => run("generate")}>
            <Icon name="spark" size={14} /> {pending ? "Analysing…" : "Analyse my week"}
          </button>
        )}
      </div>

      {pending && !insights && <Thinking text="Reading this device's week…" />}
      {insights && (
        <div className={pending ? "opacity-60 transition-opacity" : ""}>
          <p className="text-[15px] font-medium">{insights.headline}</p>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {insights.insights.slice(0, 4).map((item, i) => (
              <li key={i} className="flex gap-3 rounded-lg border border-[var(--line)] p-3">
                <Icon name={KIND[item.kind]?.icon ?? "spark"} size={16} className={`mt-0.5 shrink-0 ${KIND[item.kind]?.tone ?? ""}`} />
                <div>
                  <p className="text-[13px] font-medium">{item.title}</p>
                  <p className="mt-0.5 text-[13px] text-[var(--mut)]">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px]"><span className="text-[var(--mut)]">Most reliable idle window: </span>{insights.best_window}</p>
          <div className="mt-4 border-t border-[var(--line)] pt-3"><AiLabel createdAt={data!.createdAt} /></div>
        </div>
      )}
      {!insights && !pending && !error && (
        <p className="text-sm text-[var(--mut)]">
          Get a plain-English read of this device&apos;s idle pattern, written by AI from the numbers on this page.
        </p>
      )}
      {error && <AiError text={error} />}
    </section>
  );
}
