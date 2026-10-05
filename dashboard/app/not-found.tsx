import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-5xl font-bold">404</h1>
      <p className="max-w-sm text-sm text-[var(--mut)]">
        We couldn&apos;t find that page.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--bg)]"
      >
        Back home
      </Link>
    </div>
  );
}
