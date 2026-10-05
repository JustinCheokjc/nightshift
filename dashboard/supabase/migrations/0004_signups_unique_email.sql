-- Prevent duplicate-spam sign-ups from the same email (case-insensitive).
-- Run via the Supabase SQL editor.

create unique index signups_email_unique on public.signups (lower(email));
