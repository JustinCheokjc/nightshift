import { getProfile } from "@/lib/dal";
import { loadDevicesData } from "@/lib/devicesData";
import RealtimeDevices from "@/components/RealtimeDevices";
import DevicesView from "@/components/views/DevicesView";

export default async function DashboardPage() {
  const profile = await getProfile();
  const data = await loadDevicesData(profile!.id, profile?.electricity_rate ?? null);
  return (
    <>
      <RealtimeDevices userId={profile!.id} />
      <DevicesView data={data} basePath="/dashboard" />
    </>
  );
}
