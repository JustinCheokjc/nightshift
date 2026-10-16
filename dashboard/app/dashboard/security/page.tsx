import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import SecurityView, { type Flag } from "@/components/views/SecurityView";
import { agoText } from "@/lib/time";

const PAGE_SIZE = 10;

export default async function ContributorSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const profile = await getProfile();
  const supabase = await createClient();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { data: devices } = await supabase
    .from("devices")
    .select("id, name, os")
    .eq("user_id", profile!.id);
  const deviceIds = (devices ?? []).map((d) => d.id);

  const { data: flags } = deviceIds.length
    ? await supabase
        .from("security_flags")
        .select("*")
        .in("device_id", deviceIds)
        .eq("status", "open")
        .order("first_seen", { ascending: false })
        .range(offset, offset + PAGE_SIZE)
    : { data: [] };

  // Most recent safety check per device (agent 0.4.0+).
  const { data: checks } = deviceIds.length
    ? await supabase.from("device_posture").select("device_id, ts").in("device_id", deviceIds).order("ts", { ascending: false }).limit(200)
    : { data: [] };
  const checked = new Set((checks ?? []).map((c) => c.device_id));
  const latest = checks?.[0]?.ts ?? null;

  return (
    <SecurityView
      deviceOs={new Map((devices ?? []).map((d) => [d.id, d.os]))}
      checkedCount={checked.size}
      lastCheckedAgo={latest ? agoText(latest) : null}
      flags={((flags ?? []) as Flag[]).slice(0, PAGE_SIZE)}
      hasNext={(flags ?? []).length > PAGE_SIZE}
      page={page}
      deviceNames={new Map((devices ?? []).map((d) => [d.id, d.name]))}
      deviceCount={deviceIds.length}
    />
  );
}
