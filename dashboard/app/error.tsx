"use client";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-xl font-bold">Something went wrong</h2>
      <p className="max-w-sm text-sm text-[var(--mut)]">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={() => retry()}
        className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--bg)]"
      >
        Try again
      </button>
    </div>
  );
}
