// Skeleton in the shape of the Devices page while server data loads.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-7 w-40" />
          <div className="skeleton h-4 w-80 max-w-full" />
        </div>
        <div className="skeleton h-8 w-28" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card flex flex-col gap-3">
            <div className="skeleton h-4 w-28" />
            <div className="skeleton h-7 w-20" />
            <div className="skeleton h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="card flex flex-col gap-4">
        <div className="skeleton h-4 w-32" />
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="skeleton h-9 w-9" />
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-5 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
