"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

interface ProductCategoryBarProps {
  data: Array<{ name: string; count: number; percent: number }>;
}

export default function ProductCategoryBar({ data }: ProductCategoryBarProps) {
  const sorted = [...data].sort((a, b) => b.count - a.count);

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, sorted.length * 40)}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 120, right: 40, top: 10, bottom: 10 }}>
        <XAxis type="number" />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          formatter={(value: number | undefined) => [
            `${value ?? 0} bugs`,
            "Count",
          ]}
        />
        <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={24}>
          {sorted.map((_, index) => (
            <Cell key={`cell-${index}`} fill="#2563eb" />
          ))}
          <LabelList dataKey="count" position="right" fontSize={12} fill="#374151" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
