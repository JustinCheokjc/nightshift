import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/dal";
import Reveal from "@/components/Reveal";
import { setUserRole } from "@/app/actions/admin";
import PageHeader from "@/components/PageHeader";

export default async function TeamPage() {
  const me = await getProfile();
  const supabase = await createClient();

  const [{ data: profiles }, { data: devices }] = await Promise.all([
    supabase.from("profiles").select("id,email,role,created_at").order("created_at", { ascending: false }),
    supabase.from("devices").select("user_id"),
  ]);
  const deviceCount = new Map<string, number>();
  for (const d of devices ?? []) deviceCount.set(d.user_id, (deviceCount.get(d.user_id) ?? 0) + 1);
  const admins = (profiles ?? []).filter((p) => p.role === "admin").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Team" description="Everyone who has signed in to Nightshift. Admins can see the operator console and manage the fleet." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {([["People", profiles?.length ?? 0], ["Admins", admins], ["With a device", deviceCount.size]] as [string, number][]).map(([l, v]) => (
          <div key={l} className="card p-4"><span className="text-xs font-medium text-[var(--mut)]">{l}</span><b className="mt-1 block text-[22px] font-semibold tabular-nums">{v}</b></div>
        ))}
      </div>

      <Reveal className="card">
        {!profiles?.length ? (
          <p className="text-sm text-[var(--mut)]">No accounts yet.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="table table-sm min-w-[560px] whitespace-nowrap">
              <thead><tr><th>Person</th><th>Role</th><th className="text-right">Devices</th><th>Joined</th><th className="text-right"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {profiles.map((p) => {
                  const isAdmin = p.role === "admin";
                  const isMe = p.id === me?.id;
                  return (
                    <tr key={p.id}>
                      <td>
                        <span className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--idle)_16%,transparent)] text-xs font-semibold text-[var(--idle)]">
                            {(p.email?.[0] ?? "?").toUpperCase()}
                          </span>
                          <span className="font-medium">{p.email}</span>
                          {isMe && <span className="badge">You</span>}
                        </span>
                      </td>
                      <td><span className={`badge ${isAdmin ? "ok" : ""}`}>{isAdmin ? "Admin" : "Contributor"}</span></td>
                      <td className="text-right tabular-nums">{deviceCount.get(p.id) ?? 0}</td>
                      <td className="text-[var(--mut)]">{new Date(p.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Singapore" })}</td>
                      <td className="text-right">
                        {isMe ? (
                          <span className="text-xs text-[var(--mut)]">—</span>
                        ) : (
                          <form action={setUserRole.bind(null, p.id, isAdmin ? "contributor" : "admin")}>
                            <button type="submit" className="btn btn-sm">{isAdmin ? "Remove admin" : "Make admin"}</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Reveal>
    </div>
  );
}
