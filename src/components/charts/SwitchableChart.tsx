"use client";

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const DEFAULT_COLORS = [
  "#2563eb", "#8b5cf6", "#ef4444", "#f59e0b", "#0d9488",
  "#ec4899", "#84cc16", "#6b7280", "#f97316", "#7c3aed",
];

type ChartView = "pie" | "bar" | "table";

interface ChartDataItem {
  name: string;
  count: number;
  percent: number;
}

interface SwitchableChartProps {
  data: ChartDataItem[];
  colors?: string[];
  defaultView?: ChartView;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataItem }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium">{d.name}</p>
      <p className="text-muted-foreground">{d.count} bugs ({d.percent}%)</p>
    </div>
  );
}

export default function SwitchableChart({
  data,
  colors = DEFAULT_COLORS,
  defaultView = "pie",
}: SwitchableChartProps) {
  const [view, setView] = useState<ChartView>(defaultView);
  const sorted = [...data].sort((a, b) => b.count - a.count);

  return (
    <div>
      {/* View toggle */}
      <div className="flex gap-0.5 mb-3 bg-muted rounded-md p-0.5 w-fit">
        {(["pie", "bar", "table"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-2.5 py-1 text-xs rounded-sm transition-colors capitalize ${
              view === v
                ? "bg-background text-foreground shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Pie view */}
      {view === "pie" && (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={sorted}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius="90%"
              innerRadius="45%"
            >
              {sorted.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <RechartsTooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      )}

      {/* Bar view */}
      {view === "bar" && (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={sorted} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={90}
              tick={{ fontSize: 11 }}
            />
            <RechartsTooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {sorted.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Table view */}
      {view === "table" && (
        <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
          {sorted.map((item, i) => (
            <div key={item.name} className="flex items-center gap-2 text-sm">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: colors[i % colors.length] }}
              />
              <span className="truncate">{item.name}</span>
              <span className="ml-auto text-xs text-muted-foreground font-mono whitespace-nowrap">
                {item.count} ({item.percent}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
