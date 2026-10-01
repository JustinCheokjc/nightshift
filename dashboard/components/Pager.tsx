import Link from "next/link";

export default function Pager({
  page,
  hasNext,
  basePath,
  paramName = "page",
}: {
  page: number;
  hasNext: boolean;
  basePath: string;
  paramName?: string;
}) {
  if (page === 1 && !hasNext) return null;

  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      {page > 1 ? (
        <Link
          href={`${basePath}?${paramName}=${page - 1}`}
          className="rounded-lg border border-[var(--line)] px-3 py-1.5"
        >
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-[var(--mut)]">Page {page}</span>
      {hasNext ? (
        <Link
          href={`${basePath}?${paramName}=${page + 1}`}
          className="rounded-lg border border-[var(--line)] px-3 py-1.5"
        >
          Next
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
