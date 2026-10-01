-- Nightshift Phase 1 schema: contributor/operator/security dashboards.
-- Run via the Supabase SQL editor or `supabase db push`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'contributor' check (role in ('contributor', 'admin')),
  electricity_rate numeric not null default 0.31,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Auto-create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- devices
-- ---------------------------------------------------------------------------
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  os text not null,
  cpu_model text,
  cores int,
  gpu_model text,
  vram_gb numeric,
  ram_gb numeric,
  benchmark_score numeric,
  agent_version text,
  status text not null default 'offline' check (status in ('online', 'idle', 'in_use', 'asleep', 'offline')),
  enrolled_at timestamptz not null default now()
);

create index devices_user_id_idx on public.devices (user_id);

-- ---------------------------------------------------------------------------
-- telemetry (raw samples; demo-scale table, not a time-series store)
-- ---------------------------------------------------------------------------
create table public.telemetry (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices (id) on delete cascade,
  ts timestamptz not null default now(),
  awake boolean,
  plugged_in boolean,
  input_idle_sec int,
  cpu_pct numeric,
  gpu_pct numeric,
  ram_pct numeric,
  net_type text,
  usable_idle boolean
);

create index telemetry_device_id_ts_idx on public.telemetry (device_id, ts desc);

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
create table public.sessions (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices (id) on delete cascade,
  start_ts timestamptz not null,
  end_ts timestamptz,
  type text not null check (type in ('usable_idle', 'in_use', 'asleep', 'offline'))
);

create index sessions_device_id_idx on public.sessions (device_id);

-- ---------------------------------------------------------------------------
-- daily_summary
-- ---------------------------------------------------------------------------
create table public.daily_summary (
  device_id uuid not null references public.devices (id) on delete cascade,
  date date not null,
  usable_idle_hours numeric not null default 0,
  core_hours numeric not null default 0,
  uptime_hours numeric not null default 0,
  primary key (device_id, date)
);

-- ---------------------------------------------------------------------------
-- fleet_hourly (fleet-wide aggregate, admin-only)
-- ---------------------------------------------------------------------------
create table public.fleet_hourly (
  ts timestamptz primary key,
  devices_online int not null default 0,
  devices_usable int not null default 0,
  core_hours_available numeric not null default 0
);

-- ---------------------------------------------------------------------------
-- device_settings
-- ---------------------------------------------------------------------------
create table public.device_settings (
  device_id uuid primary key references public.devices (id) on delete cascade,
  idle_threshold_min int not null default 5,
  cpu_threshold_pct int not null default 20,
  blackout_windows jsonb not null default '[]'::jsonb
);

-- ---------------------------------------------------------------------------
-- consent_log
-- ---------------------------------------------------------------------------
create table public.consent_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  version text not null,
  accepted_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- security_flags
-- ---------------------------------------------------------------------------
create table public.security_flags (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices (id) on delete cascade,
  category text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  detail text,
  first_seen timestamptz not null default now(),
  resolved_at timestamptz,
  status text not null default 'open' check (status in ('open', 'resolved'))
);

create index security_flags_device_id_idx on public.security_flags (device_id);

-- ---------------------------------------------------------------------------
-- device_posture
-- ---------------------------------------------------------------------------
create table public.device_posture (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices (id) on delete cascade,
  ts timestamptz not null default now(),
  os_patch_age_days int,
  firewall_on boolean,
  antivirus_on boolean,
  disk_encrypted boolean,
  agent_hash_ok boolean,
  is_vm boolean
);

create index device_posture_device_id_idx on public.device_posture (device_id);

-- ---------------------------------------------------------------------------
-- audit_log (admin-only)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor text not null,
  action text not null,
  target text,
  ts timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- wallet_accounts / ledger_entries
-- ---------------------------------------------------------------------------
create table public.wallet_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade
);

create table public.ledger_entries (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.wallet_accounts (user_id) on delete cascade,
  type text not null,
  amount numeric not null,
  status text not null check (status in ('pending', 'available', 'processing', 'paid', 'reversed')),
  related_job_id uuid,
  created_at timestamptz not null default now()
);

create index ledger_entries_account_id_idx on public.ledger_entries (account_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.telemetry enable row level security;
alter table public.sessions enable row level security;
alter table public.daily_summary enable row level security;
alter table public.fleet_hourly enable row level security;
alter table public.device_settings enable row level security;
alter table public.consent_log enable row level security;
alter table public.security_flags enable row level security;
alter table public.device_posture enable row level security;
alter table public.audit_log enable row level security;
alter table public.wallet_accounts enable row level security;
alter table public.ledger_entries enable row level security;

-- profiles
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- devices
create policy "devices_all_own_or_admin_select" on public.devices
  for select using (user_id = auth.uid() or public.is_admin());
create policy "devices_insert_own" on public.devices
  for insert with check (user_id = auth.uid());
create policy "devices_update_own" on public.devices
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "devices_delete_own" on public.devices
  for delete using (user_id = auth.uid());

-- telemetry (join to devices)
create policy "telemetry_select_own_or_admin" on public.telemetry
  for select using (
    public.is_admin() or exists (
      select 1 from public.devices d where d.id = telemetry.device_id and d.user_id = auth.uid()
    )
  );
create policy "telemetry_insert_own" on public.telemetry
  for insert with check (
    exists (select 1 from public.devices d where d.id = telemetry.device_id and d.user_id = auth.uid())
  );

-- sessions
create policy "sessions_select_own_or_admin" on public.sessions
  for select using (
    public.is_admin() or exists (
      select 1 from public.devices d where d.id = sessions.device_id and d.user_id = auth.uid()
    )
  );
create policy "sessions_insert_own" on public.sessions
  for insert with check (
    exists (select 1 from public.devices d where d.id = sessions.device_id and d.user_id = auth.uid())
  );

-- daily_summary
create policy "daily_summary_select_own_or_admin" on public.daily_summary
  for select using (
    public.is_admin() or exists (
      select 1 from public.devices d where d.id = daily_summary.device_id and d.user_id = auth.uid()
    )
  );
create policy "daily_summary_insert_own" on public.daily_summary
  for insert with check (
    exists (select 1 from public.devices d where d.id = daily_summary.device_id and d.user_id = auth.uid())
  );

-- fleet_hourly: admin only
create policy "fleet_hourly_admin_only" on public.fleet_hourly
  for select using (public.is_admin());

-- device_settings
create policy "device_settings_all_own_or_admin_select" on public.device_settings
  for select using (
    public.is_admin() or exists (
      select 1 from public.devices d where d.id = device_settings.device_id and d.user_id = auth.uid()
    )
  );
create policy "device_settings_insert_own" on public.device_settings
  for insert with check (
    exists (select 1 from public.devices d where d.id = device_settings.device_id and d.user_id = auth.uid())
  );
create policy "device_settings_update_own" on public.device_settings
  for update using (
    exists (select 1 from public.devices d where d.id = device_settings.device_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.devices d where d.id = device_settings.device_id and d.user_id = auth.uid())
  );

-- consent_log
create policy "consent_log_select_own" on public.consent_log
  for select using (user_id = auth.uid());
create policy "consent_log_insert_own" on public.consent_log
  for insert with check (user_id = auth.uid());

-- security_flags
create policy "security_flags_select_own_or_admin" on public.security_flags
  for select using (
    public.is_admin() or exists (
      select 1 from public.devices d where d.id = security_flags.device_id and d.user_id = auth.uid()
    )
  );
create policy "security_flags_insert_own_or_admin" on public.security_flags
  for insert with check (
    public.is_admin() or exists (
      select 1 from public.devices d where d.id = security_flags.device_id and d.user_id = auth.uid()
    )
  );
create policy "security_flags_update_admin" on public.security_flags
  for update using (public.is_admin()) with check (public.is_admin());

-- device_posture
create policy "device_posture_select_own_or_admin" on public.device_posture
  for select using (
    public.is_admin() or exists (
      select 1 from public.devices d where d.id = device_posture.device_id and d.user_id = auth.uid()
    )
  );
create policy "device_posture_insert_own" on public.device_posture
  for insert with check (
    exists (select 1 from public.devices d where d.id = device_posture.device_id and d.user_id = auth.uid())
  );

-- audit_log: admin only
create policy "audit_log_admin_only" on public.audit_log
  for select using (public.is_admin());
create policy "audit_log_insert_admin" on public.audit_log
  for insert with check (public.is_admin());

-- wallet_accounts
create policy "wallet_accounts_select_own_or_admin" on public.wallet_accounts
  for select using (user_id = auth.uid() or public.is_admin());
create policy "wallet_accounts_insert_own" on public.wallet_accounts
  for insert with check (user_id = auth.uid());

-- ledger_entries
create policy "ledger_entries_select_own_or_admin" on public.ledger_entries
  for select using (account_id = auth.uid() or public.is_admin());
create policy "ledger_entries_insert_own" on public.ledger_entries
  for insert with check (account_id = auth.uid());
