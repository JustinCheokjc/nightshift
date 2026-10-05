import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/dal";
import Reveal from "@/components/Reveal";
import { setUserRole } from "@/app/actions/admin";

export default async function TeamPage() {
  const me = await getProfile();
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,email,role,created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold">Team</h2>
        <p className="text-sm text-[var(--mut)]">
          Everyone who has signed in to Nightshift. Admins can see the
          operator dashboard and manage the fleet.
        </p>
      </div>

      <Reveal className="card">
        {!profiles?.length ? (
          <p className="text-sm text-[var(--mut)]">No accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--mut)]">
                  <th className="border-b border-[var(--line)] py-2 font-medium">
                    Email
                  </th>
                  <th className="border-b border-[var(--line)] py-2 font-medium">
                    Role
                  </th>
                  <th className="border-b border-[var(--line)] py-2 font-medium">
                    Joined
                  </th>
                  <th className="border-b border-[var(--line)] py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const isAdmin = p.role === "admin";
                  const nextRole = isAdmin ? "contributor" : "admin";
                  return (
                    <tr key={p.id}>
                      <td className="border-b border-[var(--line)] py-2">
                        {p.email}
                        {p.id === me?.id && (
                          <span className="ml-2 text-xs text-[var(--mut)]">
                            (you)
                          </span>
                        )}
                      </td>
                      <td className="border-b border-[var(--line)] py-2">
                        <span className={`pill ${isAdmin ? "i" : ""}`}>
                          {p.role}
                        </span>
                      </td>
                      <td className="border-b border-[var(--line)] py-2 text-xs text-[var(--mut)]">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className="border-b border-[var(--line)] py-2 text-right">
                        <form action={setUserRole.bind(null, p.id, nextRole)}>
                          <button
                            type="submit"
                            className="rounded-lg border border-[var(--line)] px-3 py-1 text-xs"
                          >
                            {isAdmin ? "Demote" : "Make admin"}
                          </button>
                        </form>
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
