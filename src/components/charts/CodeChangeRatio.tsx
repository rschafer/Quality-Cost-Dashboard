"use client";

interface CodeChangeRatioProps {
  codeChangePercent: number;
  trend?: number;
}

export default function CodeChangeRatio({
  codeChangePercent,
  trend,
}: CodeChangeRatioProps) {
  const nonCodePercent = Math.round((100 - codeChangePercent) * 100) / 100;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold font-mono text-purple-600">
          {codeChangePercent}%
        </span>
        <span className="text-sm text-muted-foreground">code changes</span>
        {trend !== undefined && trend !== 0 && (
          <span
            className={`text-sm font-medium ${
              trend > 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            {trend > 0 ? "+" : ""}
            {trend}%
          </span>
        )}
      </div>

      <div className="w-full h-6 rounded-full overflow-hidden flex bg-muted">
        <div
          className="h-full bg-purple-600 transition-all duration-500"
          style={{ width: `${codeChangePercent}%` }}
        />
        <div
          className="h-full bg-teal-500 transition-all duration-500"
          style={{ width: `${nonCodePercent}%` }}
        />
      </div>

      <div className="flex justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-purple-600" />
          Code Change ({codeChangePercent}%)
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-teal-500" />
          Non-Code ({nonCodePercent}%)
        </div>
      </div>
    </div>
  );
}
