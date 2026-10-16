"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";

export async function setUserRole(userId: string, role: "contributor" | "admin") {
  const me = await requireAdmin();
  // Never let an admin remove their own access (they could be the only admin).
  if (me?.id === userId && role !== "admin") return;
  const admin = createAdminClient();
  await admin.from("profiles").update({ role }).eq("id", userId);
  revalidatePath("/admin/team");
}
