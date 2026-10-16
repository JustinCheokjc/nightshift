// Placeholder shaped like a dashboard page while server data loads.
export default function PageSkeleton({ kpis = 4, blocks = ["h-64", "h-48"] }: { kpis?: number; blocks?: string[] }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <div className="skeleton h-7 w-40" />
        <div className="skeleton h-4 w-80 max-w-full" />
      </div>
      {kpis > 0 && (
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${kpis > 4 ? "xl:grid-cols-6" : "xl:grid-cols-4"}`}>
          {Array.from({ length: kpis }, (_, i) => (
            <div key={i} className="card flex flex-col gap-3">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-7 w-20" />
            </div>
          ))}
        </div>
      )}
      {blocks.map((h, i) => <div key={i} className={`card ${h}`}><div className="skeleton h-4 w-32" /></div>)}
    </div>
  );
}
