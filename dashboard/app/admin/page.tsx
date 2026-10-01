import { createClient } from "@/lib/supabase/server";
import { sumBy } from "@/lib/strip";
import Kpi from "@/components/Kpi";
import Reveal from "@/components/Reveal";
import ForecastChart from "@/components/ForecastChart";
import HardwareMixChart from "@/components/HardwareMixChart";
import EconomicsPanel from "@/components/EconomicsPanel";

export default async function OperatorPage() {
  const supabase = await createClient();

  const { data: devices } = await supabase.from("devices").select("*");
  const { data: fleetHourly } = await supabase
    .from("fleet_hourly")
    .select("*")
    .order("ts", { ascending: true });

  const rows = fleetHourly ?? [];
  const latest = rows[rows.length - 1];
  const coreHoursForecast = sumBy(rows, (r) => r.core_hours_available);
  const coreHoursPerDay = coreHoursForecast; // 24 rows == one day of forecast

  const devicesEnrolled = devices?.length ?? 0;
  const offlineCount = (devices ?? []).filter((d) => d.status === "offline").length;

  const hardwareMix = new Map<string, number>();
  for (const d of devices ?? []) {
    const key = `${d.cores ?? "?"} cores`;
    hardwareMix.set(key, (hardwareMix.get(key) ?? 0) + 1);
  }
  const hardwareMixData = [...hardwareMix.entries()].map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold">Fleet</h2>
        <p className="text-sm text-[var(--mut)]">
          Answers one question: how many usable core-hours can we promise a
          buyer?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi value={devicesEnrolled} label="Devices enrolled" />
        <Kpi value={latest?.devices_online ?? 0} label="Online now" />
        <Kpi value={latest?.devices_usable ?? 0} label="Usable idle now" />
        <Kpi value={coreHoursForecast} label="Core-hours forecast, next 24 h" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Reveal className="card">
          <h3 className="mb-3 text-sm font-bold">
            Forecast: usable devices by hour of day
          </h3>
          {!rows.length ? (
            <p className="text-sm text-[var(--mut)]">
              No fleet data yet. Load demo data from the contributor
              dashboard.
            </p>
          ) : (
            <>
              <ForecastChart rows={rows} />
              <p className="mt-2 text-xs text-[var(--mut)]">
                Today&apos;s snapshot. Replace with a 30-day median once the
                pilot has enough history.
              </p>
            </>
          )}
        </Reveal>

        <Reveal delay={0.08} className="card">
          <h3 className="mb-3 text-sm font-bold">Hardware mix</h3>
          {!hardwareMixData.length ? (
            <p className="text-sm text-[var(--mut)]">No devices enrolled yet.</p>
          ) : (
            <HardwareMixChart data={hardwareMixData} />
          )}
        </Reveal>
      </div>

      <Reveal delay={0.12}>
        <EconomicsPanel coreHoursPerDay={coreHoursPerDay} devicesEnrolled={devicesEnrolled} />
      </Reveal>

      <Reveal delay={0.16} className="card">
        <h3 className="mb-3 text-sm font-bold">Attention</h3>
        {offlineCount ? (
          <p className="text-sm">
            <span className="pill w">{offlineCount} devices</span> paused or
            not reporting
          </p>
        ) : (
          <p className="text-sm text-[var(--mut)]">
            No devices currently paused or offline.
          </p>
        )}
      </Reveal>
    </div>
  );
}
