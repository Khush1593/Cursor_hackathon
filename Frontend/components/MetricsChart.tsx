"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuraStore, type Point } from "@/store/aura.store";

const PAIN = "#ef4444";
const SLEEP = "#2563eb";

function label(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

/** 7-day trend of pain_level + sleep_hours. Nulls are skipped, never zeroed. */
export function MetricsChart() {
  const metrics = useAuraStore((s) => s.metrics);
  const data = completeWeek(metrics);
  const measured = metrics.filter(
    (point) => point.pain_level !== null || point.sleep_hours !== null,
  );
  const latestPain =
    metrics.findLast((point) => point.pain_level !== null)?.pain_level ?? undefined;
  const latestSleep =
    metrics.findLast((point) => point.sleep_hours !== null)?.sleep_hours ?? undefined;
  const hasData = measured.length > 0;
  const hasSleep = latestSleep !== undefined;

  return (
    <section className="aura-panel aura-transition flex flex-col rounded-3xl p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-aura-ink">7-day wellbeing</h2>
          <p className="mt-0.5 text-xs text-aura-muted">
            Pain and sleep captured from your check-ins
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-aura-muted">
          <Legend color={PAIN} text="Pain" />
          <Legend color={SLEEP} text="Sleep" />
        </div>
      </header>

      {hasData ? (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <MetricSummary
              label="Latest pain"
              value={latestPain === undefined ? "—" : `${latestPain}/10`}
              color={PAIN}
              helper={latestPain === undefined ? "Not logged yet" : painLabel(latestPain)}
            />
            <MetricSummary
              label="Latest sleep"
              value={latestSleep === undefined ? "—" : `${latestSleep}h`}
              color={SLEEP}
              helper={
                latestSleep === undefined ? "Mention sleep to Aura" : "Last reported"
              }
            />
          </div>
          <div className="relative h-60 w-full overflow-hidden rounded-2xl border border-[var(--aura-panel-border)] bg-white/35 px-1 pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data}
                margin={{ top: 10, right: 12, left: -16, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="painBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 7"
                  stroke="var(--aura-panel-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--aura-muted)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 10]}
                  tick={{ fill: "var(--aura-muted)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  cursor={{ fill: "var(--aura-accent-soft)", radius: 10 }}
                  contentStyle={{
                    borderRadius: 14,
                    border: "1px solid var(--aura-panel-border)",
                    background: "rgba(255,255,255,0.96)",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#0f2a4a", fontWeight: 600 }}
                  formatter={(value, name) => [
                    `${value}${name === "Sleep" ? "h" : "/10"}`,
                    name,
                  ]}
                />
                <Bar
                  dataKey="pain_level"
                  name="Pain"
                  fill="url(#painBar)"
                  radius={[8, 8, 4, 4]}
                  maxBarSize={24}
                />
                {hasSleep && (
                  <Line
                    type="monotone"
                    dataKey="sleep_hours"
                    name="Sleep"
                    stroke={SLEEP}
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      strokeWidth: 3,
                      stroke: "#ffffff",
                      fill: SLEEP,
                    }}
                    activeDot={{ r: 6, strokeWidth: 3, stroke: "#ffffff" }}
                    connectNulls={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
            {measured.length === 1 && (
              <div className="pointer-events-none absolute top-3 right-3 rounded-full border border-[var(--aura-panel-border)] bg-white/85 px-3 py-1 text-[10px] font-medium text-aura-muted shadow-sm">
                First check-in · keep logging to form a trend
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--aura-panel-border)] bg-white/35 px-6 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-aura-accent-soft text-aura-accent">
            <TrendIcon />
          </span>
          <p className="mt-3 text-sm font-medium text-aura-ink">Your trend starts here</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-aura-muted">
            Mention pain, sleep, or energy during a check-in. Aura will build this view
            without inventing missing data.
          </p>
          <div className="mt-4 flex w-full max-w-xs items-end gap-2 opacity-45">
            {[34, 52, 43, 64, 48, 72, 60].map((height, index) => (
              <span
                key={index}
                className="flex-1 rounded-t-md bg-aura-accent-soft"
                style={{ height }}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function completeWeek(metrics: Point[]) {
  const byDate = new Map(metrics.map((point) => [point.date, point]));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const iso = date.toISOString().slice(0, 10);
    const point = byDate.get(iso);
    return {
      date: iso,
      pain_level: point?.pain_level ?? null,
      sleep_hours: point?.sleep_hours ?? null,
      label: label(iso),
    };
  });
}

function MetricSummary({
  label: title,
  value,
  color,
  helper,
}: {
  label: string;
  value: string;
  color: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--aura-panel-border)] bg-white/55 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-[10px] font-semibold tracking-wider text-aura-muted uppercase">
          {title}
        </p>
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-xl font-semibold" style={{ color }}>
          {value}
        </p>
        <p className="pb-0.5 text-[10px] text-aura-muted">{helper}</p>
      </div>
    </div>
  );
}

function painLabel(value: number): string {
  if (value >= 7) return "High — seek care if needed";
  if (value >= 4) return "Moderate";
  return "Low";
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {text}
    </span>
  );
}

function TrendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 17 5-5 4 4 8-9" />
      <path d="M15 7h5v5" />
    </svg>
  );
}
