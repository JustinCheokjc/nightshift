-- AI features (device insights, security help, fleet briefing, website help chat).
-- Both tables are written only by the server's service-role client: RLS is on
-- with no policies, so no signed-in user can read or change them directly.

-- Cached AI answers, so the same question isn't paid for twice.
create table public.ai_cache (
  key text primary key,
  kind text not null,
  content jsonb not null,
  model text not null,
  created_at timestamptz not null default now()
);

-- One row per AI request, for rate limits. `subject` is a user id or a hashed
-- IP address (never the raw IP), and no question text is stored.
create table public.ai_usage (
  id bigint generated always as identity primary key,
  kind text not null,
  subject text not null,
  created_at timestamptz not null default now()
);

create index ai_usage_subject_idx on public.ai_usage (kind, subject, created_at desc);

alter table public.ai_cache enable row level security;
alter table public.ai_usage enable row level security;
