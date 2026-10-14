"use client";

import { Suspense, useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SITE = "https://nightshift-sg.vercel.app";
const RESEND_SECONDS = 60;

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
  signin: "Sign-in didn't finish. The email link may have expired or been used already. Request a new one below.",
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
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendLink() {
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
    setCooldown(RESEND_SECONDS);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    sendLink();
  }

  const alert = status === "error" ? error : status === "idle" ? callbackError : null;

  return (
    <main className="grid min-h-screen flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <BrandPanel />

      <section className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <a href={SITE} className="flex items-center gap-2.5 lg:hidden" aria-label="Nightshift home">
            <LogoMark className="h-8 w-8" />
            <span className="text-[15px] font-semibold tracking-tight">Nightshift</span>
          </a>
          <a href={SITE} className="text-sm text-[var(--mut)] transition-colors hover:text-[var(--ink)]">
            Back to site
          </a>
        </div>

        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-12">
          {status === "sent" ? (
            <div>
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--idle)_14%,transparent)] text-[var(--idle)]">
                <MailIcon className="h-6 w-6" />
              </div>
              <h1 className="text-[28px] font-semibold tracking-tight">Check your inbox</h1>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--mut)]">
                We sent a sign-in link to{" "}
                <span className="font-medium text-[var(--ink)]">{email}</span>. Open it on this
                device to continue.
              </p>

              <ul className="mt-6 space-y-2.5 rounded-xl border border-[var(--line)] bg-[var(--surf)] p-4 text-sm text-[var(--mut)]">
                <li className="flex gap-2.5"><Dot />It can take a minute to arrive.</li>
                <li className="flex gap-2.5"><Dot />Not there? Check your spam or promotions folder.</li>
                <li className="flex gap-2.5"><Dot />Each link works once.</li>
              </ul>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={sendLink}
                  disabled={cooldown > 0}
                  className="h-11 rounded-lg border border-[var(--line)] bg-[var(--surf)] text-sm font-medium transition-colors hover:border-[var(--idle)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-[var(--line)]"
                >
                  {cooldown > 0 ? `Resend link in ${cooldown}s` : "Resend link"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatus("idle");
                    setCooldown(0);
                  }}
                  className="text-sm text-[var(--mut)] underline-offset-4 transition-colors hover:text-[var(--ink)] hover:underline"
                >
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight">Sign in to Nightshift</h1>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--mut)]">
                Enter your email and we&apos;ll send you a secure sign-in link. No password needed.
              </p>

              {alert && (
                <div
                  role="alert"
                  className="mt-6 flex gap-2.5 rounded-lg border border-[color-mix(in_srgb,var(--bad)_35%,transparent)] bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] px-3.5 py-3 text-sm text-[var(--bad)]"
                >
                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{alert}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" htmlFor="email">
                    Email address
                  </label>
                  <div className="relative">
                    <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--mut)]" />
                    <input
                      id="email"
                      type="email"
                      required
                      autoFocus
                      autoComplete="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surf)] pl-10 pr-3 text-[15px] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--mut)] placeholder:opacity-70 focus:border-[var(--idle)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--idle)_22%,transparent)]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="group flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--idle)] text-[15px] font-semibold text-[var(--on)] shadow-sm transition-[filter,transform] hover:brightness-110 active:scale-[.99] disabled:cursor-wait disabled:opacity-70"
                >
                  {status === "sending" ? (
                    <>
                      <Spinner />
                      Sending link
                    </>
                  ) : (
                    <>
                      Continue with email
                      <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-[var(--mut)]">
                <LockIcon className="h-3.5 w-3.5" />
                Passwordless sign-in. Each link works once.
              </p>

              <div className="mt-8 border-t border-[var(--line)] pt-6 text-center text-sm text-[var(--mut)]">
                New to Nightshift?{" "}
                <a href={`${SITE}/join/`} className="font-medium text-[var(--idle)] underline-offset-4 hover:underline">
                  Join the pilot
                </a>
              </div>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[var(--mut)]">
          <a href={`${SITE}/trust/`} className="hover:text-[var(--ink)]">Trust and safety</a>
          <a href={`${SITE}/about/`} className="hover:text-[var(--ink)]">Privacy</a>
          <a href="mailto:justincheok@hotmail.com" className="hover:text-[var(--ink)]">Contact</a>
        </footer>
      </section>
    </main>
  );
}

// Always-dark brand panel, shown beside the form on large screens.
function BrandPanel() {
  // A sample 24-hour strip: in use by day, idle overnight.
  const hours = Array.from({ length: 24 }, (_, h) => (h >= 23 || h < 7 ? "idle" : h === 12 ? "idle" : "use"));
  return (
    <aside className="relative hidden overflow-hidden bg-[#08161b] p-12 text-[#e4eef0] lg:flex lg:flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_20%_0%,rgba(20,163,148,.28),transparent_70%),radial-gradient(50%_45%_at_100%_100%,rgba(20,163,148,.14),transparent_70%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[.07]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(80% 70% at 30% 30%,#000,transparent)",
        }}
      />

      <a href={SITE} className="relative flex items-center gap-3" aria-label="Nightshift home">
        <LogoMark className="h-9 w-9" />
        <span className="text-lg font-semibold tracking-tight">Nightshift</span>
      </a>

      <div className="relative my-auto max-w-[460px] py-12">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#3cbfae]">Contributor dashboard</p>
        <h2 className="mt-4 text-[40px] font-semibold leading-[1.1] tracking-tight">
          Idle hours,
          <br />
          <span className="text-[#3cbfae]">put to work.</span>
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-[#8fa8b2]">
          See how much usable idle time your devices have, and what it could be worth.
        </p>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[.04] p-5 backdrop-blur-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-[#8fa8b2]">Usable idle today</span>
            <span className="text-2xl font-semibold tabular-nums">5.8 h</span>
          </div>
          <div className="mt-4 flex gap-[3px]" aria-hidden="true">
            {hours.map((s, i) => (
              <span
                key={i}
                className={`h-8 flex-1 rounded-[3px] ${s === "idle" ? "bg-[#3cbfae]" : "bg-white/10"}`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-[#8fa8b2]">
            <span>00:00</span>
            <span>12:00</span>
            <span>23:59</span>
          </div>
          <p className="mt-3 text-[11px] text-[#8fa8b2]/80">Sample data</p>
        </div>

        <ul className="mt-10 space-y-3.5 text-sm text-[#c9d8dc]">
          <Point>Only device state is shared. Never your files.</Point>
          <Point>Pause or delete your data any time.</Point>
          <Point>No passwords to remember or leak.</Point>
        </ul>
      </div>

      <p className="relative text-xs text-[#8fa8b2]">Student-led idle compute pilot · Singapore</p>
    </aside>
  );
}

function Point({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3cbfae]/15 text-[#3cbfae]">
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </span>
      {children}
    </li>
  );
}

function Dot() {
  return <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--idle)]" />;
}

function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14A394" />
          <stop offset="1" stopColor="#0A5E55" />
        </linearGradient>
        <mask id={`m${id}`}>
          <rect width="48" height="48" fill="#fff" />
          <circle cx="31" cy="19" r="10" fill="#000" />
        </mask>
      </defs>
      <rect width="48" height="48" rx="12" fill={`url(#g${id})`} />
      <circle cx="22" cy="26" r="12" fill="#fff" mask={`url(#m${id})`} />
      <circle cx="34.5" cy="13.5" r="2.4" fill="#BFF3EA" />
    </svg>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function MailIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps} strokeWidth={2} className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps} strokeWidth={2} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4.5M12 16h.01" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
