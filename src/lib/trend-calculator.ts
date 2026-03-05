import type { Bug } from "@/generated/prisma/client";
import type { TrendComparison } from "@/types/analysis";

function computePercentages(
  bugs: Bug[],
  field: "module" | "productCategory" | "resolution"
): Record<string, number> {
  const total = bugs.length;
  if (total === 0) return {};

  const counts: Record<string, number> = {};
  for (const bug of bugs) {
    const value = (bug[field] as string) || "Unknown";
    counts[value] = (counts[value] || 0) + 1;
  }

  const result: Record<string, number> = {};
  for (const [key, count] of Object.entries(counts)) {
    result[key] = Math.round((count / total) * 10000) / 100;
  }
  return result;
}

export function compareTrends(
  previousBugs: Bug[],
  currentBugs: Bug[],
  field: "module" | "productCategory" | "resolution"
): TrendComparison[] {
  const previous = computePercentages(previousBugs, field);
  const current = computePercentages(currentBugs, field);

  // Combine all categories from both periods
  const allCategories = new Set([
    ...Object.keys(previous),
    ...Object.keys(current),
  ]);

  const trends: TrendComparison[] = [];
  for (const category of allCategories) {
    const prevPercent = previous[category] || 0;
    const currPercent = current[category] || 0;
    trends.push({
      category,
      previousPercent: prevPercent,
      currentPercent: currPercent,
      delta: Math.round((currPercent - prevPercent) * 100) / 100,
    });
  }

  return trends.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function identifyHotspots(
  trends: TrendComparison[],
  threshold: number = 3
): { growing: TrendComparison[]; shrinking: TrendComparison[] } {
  return {
    growing: trends.filter((t) => t.delta >= threshold),
    shrinking: trends.filter((t) => t.delta <= -threshold),
  };
}
