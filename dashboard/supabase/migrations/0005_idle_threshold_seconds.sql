-- Idle threshold in seconds, so devices can count as idle sooner than one
-- minute (minimum 30 s). idle_threshold_min is kept for older code.
-- Run via the Supabase SQL editor.

alter table public.device_settings
  add column if not exists idle_threshold_sec int
  check (idle_threshold_sec between 30 and 1800);
