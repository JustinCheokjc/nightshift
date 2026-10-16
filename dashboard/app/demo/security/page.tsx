import { connection } from "next/server";
import { demoDataNow, demoFlagsNow } from "@/lib/demoData";
import SecurityView from "@/components/views/SecurityView";

export default async function DemoSecurityPage() {
  await connection();
  const { devices } = demoDataNow();
  return (
    <SecurityView
      flags={demoFlagsNow()}
      deviceNames={new Map(devices.map((d) => [d.id, d.name]))}
      deviceCount={devices.length}
      deviceOs={new Map(devices.map((d) => [d.id, d.os]))}
      checkedCount={devices.length}
      lastCheckedAgo="2 h ago"
    />
  );
}
