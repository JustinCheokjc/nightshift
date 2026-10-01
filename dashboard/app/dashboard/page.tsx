import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { buildDayStrip, sumBy } from "@/lib/strip";
import { seedDemoData } from "@/app/actions/seed";
import {
  toggleDevicePause,
  updateIdleThreshold,
  updateElectricityRate,
  deleteMyData,
} from "@/app/actions/controls";
import Kpi from "@/components/Kpi";
import Reveal from "@/components/Reveal";
import WeeklyTrendChart from "@/components/WeeklyTrendChart";

const EARNING_RATE_PER_CORE_HOUR = 0.07; // S$, placeholder until the pilot provides measured data
const IDLE_POWER_DRAW_KW = 0.08;
const BTN = "transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]";

export default async function DashboardPage() {
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: devices } = await supabase
    .from("devices")
    .select("*")
    .eq("user_id", profile!.id)
    .order("enrolled_at");

  const deviceIds = (devices ?? []).map((d) => d.id);
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [{ data: settings }, { data: summaries }, { data: sessions }] =
    deviceIds.length
      ? await Promise.all([
          supabase
            .from("device_settings")
            .select("*")
            .in("device_id", deviceIds),
          supabase
            .from("daily_summary")
            .select("*")
            .in("device_id", deviceIds)
            .gte("date", weekAgo),
          supabase
            .from("sessions")
            .select("*")
            .in("device_id", deviceIds)
            // end_ts (not start_ts) so sessions that started before the
            // 24h window but are still ongoing within it are included.
            .or(`end_ts.gte.${dayAgo},end_ts.is.null`),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const settingsByDevice = new Map(
    (settings ?? []).map((s) => [s.device_id, s])
  );
  const todaySummaries = (summaries ?? []).filter((s) => s.date === today);
  const usableIdleToday = sumBy(todaySummaries, (s) => s.usable_idle_hours);
  const coreHoursWeek = sumBy(summaries ?? [], (s) => s.core_hours);
  const usableIdleWeek = sumBy(summaries ?? [], (s) => s.usable_idle_hours);
  const estEarnings = Math.round(
    coreHoursWeek * EARNING_RATE_PER_CORE_HOUR * 100
  ) / 100;
  const estElectricity = Math.round(
    usableIdleWeek * IDLE_POWER_DRAW_KW * (profile?.electricity_rate ?? 0.31) * 100
  ) / 100;

  const trendByDate = new Map<string, number>();
  for (const s of summaries ?? []) {
    trendByDate.set(s.date, (trendByDate.get(s.date) ?? 0) + s.usable_idle_hours);
  }
  const trendData = [...trendByDate.entries()].map(([date, hours]) => ({
    date,
    hours,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold">Your devices</h2>
        <p className="text-sm text-[var(--mut)]">
          Each row shows the last 24 hours: what your laptop was doing, hour
          by hour.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi value={usableIdleToday} decimals={1} suffix=" h" label="Usable idle today" />
        <Kpi value={coreHoursWeek} suffix=" core-h" label="Capacity this week" />
        <Kpi value={estEarnings} decimals={2} prefix="S$" label="Est. potential earnings" />
        <Kpi value={estElectricity} decimals={2} prefix="S$" label="Est. electricity cost" />
      </div>
      <p className="-mt-4 text-xs text-[var(--mut)]">
        Capacity estimate only. Real earnings depend on demand and are not
        guaranteed.
      </p>

      {trendData.length > 1 && (
        <Reveal className="card">
          <h3 className="mb-2 text-sm font-bold">Usable idle hours this week</h3>
          <WeeklyTrendChart data={trendData} />
        </Reveal>
      )}

      {!devices?.length ? (
        <Reveal className="card">
          <p className="mb-3 text-sm text-[var(--mut)]">
            No devices yet — Phase 1 has no real desktop agent reporting in
            yet.
            {process.env.NODE_ENV !== "production" &&
              " Load demo data to see the dashboard in action."}
          </p>
          {process.env.NODE_ENV !== "production" && (
            <form action={seedDemoData}>
              <button
                type="submit"
                className={`rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--bg)] ${BTN}`}
              >
                Load demo data
              </button>
            </form>
          )}
        </Reveal>
      ) : (
        <>
          <Reveal className="card">
            <h3 className="mb-3 text-sm font-bold">Your devices</h3>
            <div className="flex flex-col gap-4">
              {devices.map((device, i) => {
                const deviceSessions = (sessions ?? []).filter(
                  (s) => s.device_id === device.id
                );
                const strip = buildDayStrip(deviceSessions);
                const paused = device.status === "offline";
                return (
                  <Reveal
                    key={device.id}
                    delay={i * 0.06}
                    className="flex flex-col gap-2 border-b border-[var(--line)] pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-[140px]">
                      <p className="font-medium">{device.name}</p>
                      <p className="text-xs text-[var(--mut)]">{device.os}</p>
                    </div>
                    <span
                      className={`pill ${
                        device.status === "idle"
                          ? "i"
                          : device.status === "offline"
                            ? ""
                            : "w"
                      }`}
                    >
                      {device.status}
                    </span>
                    <div className="strip flex-1">
                      {strip.map((c, i) => (
                        <i key={i} className={c} />
                      ))}
                    </div>
                    <form action={toggleDevicePause.bind(null, device.id, !paused)}>
                      <button
                        type="submit"
                        className={`rounded-lg border border-[var(--line)] px-3 py-1 text-xs ${BTN}`}
                      >
                        {paused ? "Resume" : "Pause"}
                      </button>
                    </form>
                  </Reveal>
                );
              })}
            </div>
            <div className="key mt-3 flex flex-wrap gap-4 text-xs text-[var(--mut)]">
              <span>
                <s className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[var(--idle)] no-underline align-[-1px]" />
                Usable idle
              </span>
              <span>
                <s className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[var(--use)] no-underline align-[-1px]" />
                In use
              </span>
              <span>
                <s className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[var(--sleep)] no-underline align-[-1px]" />
                Asleep or off
              </span>
            </div>
          </Reveal>

          <div className="grid gap-3 sm:grid-cols-2">
            <Reveal className="card">
              <h3 className="mb-3 text-sm font-bold">Controls</h3>
              {devices.map((device) => (
                <form
                  key={device.id}
                  action={updateIdleThreshold.bind(null, device.id)}
                  className="mb-3 flex items-end gap-2"
                >
                  <div className="flex-1">
                    <label className="block text-xs text-[var(--mut)]">
                      {device.name}: idle after (minutes)
                    </label>
                    <input
                      name="minutes"
                      type="number"
                      min={1}
                      max={30}
                      defaultValue={
                        settingsByDevice.get(device.id)?.idle_threshold_min ?? 5
                      }
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--surf)] px-2 py-1 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className={`rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs ${BTN}`}
                  >
                    Save
                  </button>
                </form>
              ))}
              <form action={deleteMyData}>
                <button
                  type="submit"
                  className={`mt-2 rounded-lg border border-[var(--bad)] px-3 py-1.5 text-xs text-[var(--bad)] ${BTN}`}
                >
                  Delete my data
                </button>
              </form>
            </Reveal>
            <Reveal delay={0.08} className="card">
              <h3 className="mb-3 text-sm font-bold">Electricity rate</h3>
              <form action={updateElectricityRate} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-[var(--mut)]">
                    Your rate (S$ per kWh)
                  </label>
                  <input
                    name="rate"
                    type="text"
                    inputMode="decimal"
                    defaultValue={profile?.electricity_rate ?? 0.31}
                    className="w-full rounded-lg border border-[var(--line)] bg-[var(--surf)] px-2 py-1 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className={`rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs ${BTN}`}
                >
                  Save
                </button>
              </form>
              <p className="mt-3 text-xs text-[var(--mut)]">
                Used to estimate what running your laptop while idle costs you
                each month.
              </p>
            </Reveal>
          </div>
        </>
      )}
    </div>
  );
}
