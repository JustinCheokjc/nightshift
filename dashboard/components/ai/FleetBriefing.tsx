"use client";

import { fleetBriefing } from "@/app/actions/ai";
import Icon from "@/components/Icon";
import { AiError, AiLabel, Thinking, useAi } from "@/components/ai/useAi";

/** Operator console: an AI daily briefing written from the fleet numbers on this page. */
export default function FleetBriefing() {
  const { data, error, off, pending, run } = useAi(fleetBriefing);
  if (off) return null;
  const b = data?.value;

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title flex items-center gap-2"><Icon name="spark" size={16} className="text-[var(--idle)]" /> Daily briefing</h2>
          <p className="card-sub">Capacity, risks and next steps, written from the numbers below. Device names only; owner emails are never sent.</p>
        </div>
        <button type="button" className={`btn btn-sm ${b ? "" : "btn-primary"}`} disabled={pending} onClick={() => run(b ? "refresh" : "generate")}>
          <Icon name="spark" size={14} /> {pending ? "Writing…" : b ? "Refresh" : "Write today's briefing"}
        </button>
      </div>

      {pending && !b && <Thinking text="Reading the fleet…" />}
      {b && (
        <div className={pending ? "opacity-60 transition-opacity" : ""}>
          <p className="text-[15px] font-medium">{b.headline}</p>
          <p className="mt-2 text-[13px] text-[var(--mut)]">{b.capacity}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--mut)]">Risks</h3>
              {b.risks.length ? (
                <ul className="flex flex-col gap-2 text-[13px]">
                  {b.risks.slice(0, 5).map((r, i) => <li key={i} className="flex gap-2"><Icon name="alert" size={14} className="mt-0.5 shrink-0 text-[var(--amber)]" />{r}</li>)}
                </ul>
              ) : <p className="text-[13px] text-[var(--mut)]">None flagged.</p>}
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--mut)]">Next steps</h3>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-[13px]">
                {b.actions.slice(0, 5).map((a, i) => <li key={i}>{a}</li>)}
              </ol>
            </div>
          </div>
          <p className="mt-4 text-xs text-[var(--mut)]">{b.data_quality}</p>
          <div className="mt-3 border-t border-[var(--line)] pt-3"><AiLabel createdAt={data!.createdAt} /></div>
        </div>
      )}
      {error && <AiError text={error} />}
    </section>
  );
}
