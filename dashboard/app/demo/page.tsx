import { connection } from "next/server";
import { demoDataNow } from "@/lib/demoData";
import DevicesView from "@/components/views/DevicesView";

export default async function DemoDevicesPage() {
  await connection();
  return <DevicesView data={demoDataNow()} basePath="/demo" demo />;
}
