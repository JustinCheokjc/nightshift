import { notFound } from "next/navigation";
import { connection } from "next/server";
import { demoDataNow } from "@/lib/demoData";
import DeviceDetailView from "@/components/views/DeviceDetailView";

export default async function DemoDevicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const all = demoDataNow();
  const devices = all.devices.filter((d) => d.id === id);
  if (!devices.length) notFound();
  return <DeviceDetailView data={{ ...all, devices }} basePath="/demo" demo />;
}
