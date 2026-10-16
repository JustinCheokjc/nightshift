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
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-[var(--mut)]">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={() => retry()}
        className="btn btn-primary"
      >
        Try again
      </button>
    </div>
  );
}
