"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Supabase error messages, rewritten so people know what to do next.
function friendly(message: string) {
  const m = message.toLowerCase();
  if (m.includes("rate limit"))
    return "Too many sign-in emails have been sent. Try again in an hour.";
  if (m.includes("security purposes"))
    return "A link was just sent. Wait a minute before asking for another one.";
  if (m.includes("invalid") && m.includes("email"))
    return "That email address doesn't look right. Check it and try again.";
  return message;
}

const CALLBACK_ERRORS: Record<string, string> = {
  signin: "Sign-in didn't finish. The email link may have expired or been used already. Try again below.",
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const callbackError = CALLBACK_ERRORS[useSearchParams().get("error") ?? ""];
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setError(friendly(error.message));
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-bold">Nightshift</h1>
        <p className="mt-1 text-sm text-[var(--mut)]">
          Sign in to your contributor dashboard.
        </p>
        <p className="mt-1 text-sm text-[var(--mut)]">
          New to Nightshift?{" "}
          <a href="https://nightshift-sg.vercel.app/contributors/" className="text-[var(--idle)] underline">
            See how the pilot works
          </a>
        </p>
      </div>

      {status === "sent" ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surf)] p-4 text-sm">
          Check <strong>{email}</strong> for a sign-in link. It can take a
          minute to arrive; check your spam folder too.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="text-sm text-[var(--mut)]" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="rounded-lg border border-[var(--line)] bg-[var(--surf)] px-3 py-2 text-sm outline-none focus:border-[var(--idle)]"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--bg)] disabled:opacity-60"
            >
              {status === "sending" ? "Sending..." : "Email me a sign-in link"}
            </button>
          </form>
          {(status === "error" ? error : callbackError) && (
            <p role="alert" className="text-sm text-[var(--bad)]">
              {status === "error" ? error : callbackError}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
