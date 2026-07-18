"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
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
  const data = metrics.map((p: Point) => ({ ...p, label: label(p.date) }));

  return (
    <section className="aura-panel aura-transition flex flex-col rounded-3xl p-5 shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-[0.18em] text-aura-muted uppercase">
          7-day trend
        </h2>
        <div className="flex items-center gap-4 text-xs text-aura-muted">
          <Legend color={PAIN} text="Pain" />
          <Legend color={SLEEP} text="Sleep (h)" />
        </div>
      </header>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 6"
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
              contentStyle={{
                borderRadius: 14,
                border: "1px solid var(--aura-panel-border)",
                background: "rgba(255,255,255,0.92)",
                boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
                fontSize: 12,
              }}
              labelStyle={{ color: "#0f2a4a", fontWeight: 600 }}
            />
            <Line
              type="monotone"
              dataKey="pain_level"
              name="Pain"
              stroke={PAIN}
              strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 0, fill: PAIN }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="sleep_hours"
              name="Sleep (h)"
              stroke={SLEEP}
              strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 0, fill: SLEEP }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {text}
    </span>
  );
}
