-- Public landing-page sign-ups (unauthenticated "Join the pilot" form).
-- Run via the Supabase SQL editor or `supabase db push`.

create table public.signups (
  id bigint generated always as identity primary key,
  email text not null,
  role text not null check (role in ('contributor', 'buyer')),
  os text,
  consent_version text not null default 'v1',
  created_at timestamptz not null default now()
);

alter table public.signups enable row level security;

create policy "signups_insert_public" on public.signups
  for insert with check (true);

create policy "signups_select_admin" on public.signups
  for select using (public.is_admin());
