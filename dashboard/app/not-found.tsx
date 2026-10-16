import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-5xl font-semibold tracking-tight">404</h1>
      <p className="max-w-sm text-sm text-[var(--mut)]">
        We couldn&apos;t find that page.
      </p>
      <Link
        href="/"
        className="btn btn-primary"
      >
        Back home
      </Link>
    </div>
  );
}
