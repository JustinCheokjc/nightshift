"use server";

import { headers } from "next/headers";
import { requireUser } from "@/lib/dal";
import { createSetupKey } from "@/lib/agentAuth";

// The key carries this dashboard's address, so the agent knows where to report.
export async function createAgentSetupKey() {
  const user = await requireUser();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return createSetupKey(user.id, `${proto}://${host}`);
}
