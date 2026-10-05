-- Enable Supabase Realtime change notifications for the devices table
-- (RLS still applies: a client only receives change events for rows it
-- could otherwise SELECT). Run via the Supabase SQL editor.

alter publication supabase_realtime add table public.devices;
