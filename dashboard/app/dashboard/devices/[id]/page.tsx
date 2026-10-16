import { notFound } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { loadDevicesData } from "@/lib/devicesData";
import DeviceDetailView from "@/components/views/DeviceDetailView";

export default async function DevicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile();
  // Scoped to the signed-in user, so another person's device id finds nothing.
  const data = await loadDevicesData(profile!.id, profile?.electricity_rate ?? null, id);
  if (!data.devices.length) notFound();
  return <DeviceDetailView data={data} basePath="/dashboard" />;
}
