import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import SecurityView, { type Flag } from "@/components/views/SecurityView";

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
    .select("id, name")
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

  return (
    <SecurityView
      flags={((flags ?? []) as Flag[]).slice(0, PAGE_SIZE)}
      hasNext={(flags ?? []).length > PAGE_SIZE}
      page={page}
      deviceNames={new Map((devices ?? []).map((d) => [d.id, d.name]))}
      deviceCount={deviceIds.length}
    />
  );
}
