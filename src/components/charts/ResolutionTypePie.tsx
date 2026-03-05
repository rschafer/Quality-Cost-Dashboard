"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#2563eb", "#8b5cf6", "#ef4444", "#6b7280", "#1d4ed8", "#f59e0b", "#0d9488"];

interface ResolutionTypePieProps {
  data: Array<{ name: string; count: number; percent: number }>;
}

export default function ResolutionTypePie({ data }: ResolutionTypePieProps) {
  const sorted = [...data].sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col lg:flex-row items-center gap-6">
      <ResponsiveContainer width="100%" height={280} className="max-w-[300px]">
        <PieChart>
          <Pie
            data={sorted}
            dataKey="count"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={120}
            innerRadius={50}
          >
            {sorted.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number | undefined, name: string | undefined) => [`${value ?? 0} bugs`, name ?? "Unknown"]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1.5">
        {sorted.map((item, i) => (
          <div key={item.name} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-muted-foreground">{item.name}</span>
            <span className="font-mono font-medium ml-auto pl-4">
              {item.count} ({item.percent}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
