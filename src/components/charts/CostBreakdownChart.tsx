"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import type { Props as LabelListProps } from "recharts/types/component/Label";

interface CostBreakdownChartProps {
  data: Array<{ category: string; totalCost: number; bugCount: number }>;
  title: string;
}

function formatDollars(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value.toFixed(0)}`;
}

export default function CostBreakdownChart({ data, title }: CostBreakdownChartProps) {
  const sorted = [...data].sort((a, b) => b.totalCost - a.totalCost);

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={Math.max(300, sorted.length * 50)}>
        <BarChart data={sorted} margin={{ left: 20, right: 60, top: 10, bottom: 10 }}>
          <XAxis
            dataKey="category"
            tick={{ fontSize: 11 }}
            angle={-30}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tickFormatter={(value: number) => formatDollars(value)}
          />
          <Tooltip
            formatter={(value: number | undefined) => [
              `$${(value ?? 0).toLocaleString()}`,
              "Total Cost",
            ]}
          />
          <Bar dataKey="totalCost" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={32}>
            <LabelList
              dataKey="totalCost"
              position="top"
              fontSize={11}
              fill="#374151"
              formatter={((value: LabelListProps["value"]) =>
                formatDollars(Number(value ?? 0))) as LabelListProps["formatter"]}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
