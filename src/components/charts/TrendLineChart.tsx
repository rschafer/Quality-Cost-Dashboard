"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TrendLineChartProps {
  data: Array<{
    category: string;
    previousPercent: number;
    currentPercent: number;
    delta: number;
  }>;
}

export default function TrendLineChart({ data }: TrendLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
        <XAxis
          dataKey="category"
          tick={{ fontSize: 11 }}
          angle={-30}
          textAnchor="end"
          height={80}
        />
        <YAxis
          tickFormatter={(value: number) => `${value}%`}
        />
        <Tooltip
          formatter={(value: number | undefined, name: string | undefined) => [
            `${value ?? 0}%`,
            name === "previousPercent" ? "Previous" : "Current",
          ]}
        />
        <Legend
          formatter={(value: string) =>
            value === "previousPercent" ? "Previous Period" : "Current Period"
          }
        />
        <Bar
          dataKey="previousPercent"
          fill="#9ca3af"
          name="previousPercent"
          radius={[4, 4, 0, 0]}
          barSize={20}
        />
        <Bar
          dataKey="currentPercent"
          fill="#2563eb"
          name="currentPercent"
          radius={[4, 4, 0, 0]}
          barSize={20}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
