import type { Bug } from "@/generated/prisma/client";
import type { ComputedStats } from "@/types/analysis";
import { estimateBugCost, DEFAULT_HOURLY_RATE } from "./cost-calculator";

function computeBreakdown(
  bugs: Bug[],
  field: keyof Bug
): Record<string, { count: number; percent: number }> {
  const total = bugs.length;
  const counts: Record<string, number> = {};

  for (const bug of bugs) {
    const value = (bug[field] as string) || "Unknown";
    counts[value] = (counts[value] || 0) + 1;
  }

  const result: Record<string, { count: number; percent: number }> = {};
  for (const [key, count] of Object.entries(counts)) {
    result[key] = {
      count,
      percent: Math.round((count / total) * 10000) / 100,
    };
  }
  return result;
}

const CODE_CHANGE_RESOLUTIONS = [
  "Code Change",
  "Codefix",
  "Codefix / Prevention",
  "Code Fix",
  "Fixed",
  "Done",
];

const NOISE_RESOLUTIONS = [
  "Duplicate",
  "Not Reproducible",
  "Product Explanation",
  "Feature Request",
  "Feature Flag Update",
];

export interface EnrichedStats extends ComputedStats {
  noisePercent: number;
  noiseCount: number;
  noiseCost: number;
  avgResolutionDays: number;
  medianResolutionDays: number;
  criticalCount: number;
  highCount: number;
  costByCategory: Array<{ name: string; cost: number; count: number }>;
  costByModule: Array<{ name: string; cost: number; count: number }>;
  assigneeBreakdown: Record<string, { count: number; percent: number }>;
  repeatOffenders: Array<{ name: string; count: number; percent: number; cost: number }>;
}

export function computeStats(
  bugs: Bug[],
  hourlyRate: number = DEFAULT_HOURLY_RATE
): EnrichedStats {
  const total = bugs.length;

  const resolutionBreakdown = computeBreakdown(bugs, "resolution");
  const moduleDistribution = computeBreakdown(bugs, "module");
  const categoryDistribution = computeBreakdown(bugs, "productCategory");
  const assigneeBreakdown = computeBreakdown(bugs, "assignee");

  // Code change percentage
  const codeChangeBugs = bugs.filter((b) =>
    CODE_CHANGE_RESOLUTIONS.some(
      (r) => b.resolution?.toLowerCase() === r.toLowerCase()
    )
  );
  const codeChangePercent =
    total > 0 ? Math.round((codeChangeBugs.length / total) * 10000) / 100 : 0;

  // Noise: tickets that didn't need real engineering work
  const noiseBugs = bugs.filter((b) =>
    NOISE_RESOLUTIONS.some(
      (r) => b.resolution?.toLowerCase() === r.toLowerCase()
    )
  );
  const noisePercent =
    total > 0 ? Math.round((noiseBugs.length / total) * 10000) / 100 : 0;
  const noiseCost = noiseBugs.reduce((sum, bug) => {
    return sum + estimateBugCost(bug, hourlyRate).estimatedCost;
  }, 0);

  // Time to resolution (days)
  const resolutionDays = bugs
    .filter((b) => b.createdAt && b.resolvedAt)
    .map((b) => {
      const created = new Date(b.createdAt).getTime();
      const resolved = new Date(b.resolvedAt!).getTime();
      return (resolved - created) / (1000 * 60 * 60 * 24);
    })
    .filter((d) => d >= 0);

  const avgResolutionDays =
    resolutionDays.length > 0
      ? Math.round(
          (resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length) * 10
        ) / 10
      : 0;

  const sortedDays = [...resolutionDays].sort((a, b) => a - b);
  const medianResolutionDays =
    sortedDays.length > 0
      ? Math.round(sortedDays[Math.floor(sortedDays.length / 2)] * 10) / 10
      : 0;

  // Priority counts
  const criticalCount = bugs.filter((b) => b.priority === "Critical").length;
  const highCount = bugs.filter((b) => b.priority === "High").length;

  // Top categories by count
  const topCategories = Object.entries(categoryDistribution)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top bug summaries for AI
  const topBugSummaries = bugs.slice(0, 20).map((b) => ({
    summary: b.summary,
    resolution: b.resolution,
    productCategory: b.productCategory,
  }));

  // Per-bug cost estimates
  const bugCosts = bugs.map((bug) => ({
    bug,
    estimate: estimateBugCost(bug, hourlyRate),
  }));
  const totalEstimatedCost = bugCosts.reduce(
    (sum, { estimate }) => sum + estimate.estimatedCost,
    0
  );

  // Cost by category
  const costByCategoryMap: Record<string, { cost: number; count: number }> = {};
  for (const { bug, estimate } of bugCosts) {
    const cat = bug.productCategory || "Unknown";
    if (!costByCategoryMap[cat]) costByCategoryMap[cat] = { cost: 0, count: 0 };
    costByCategoryMap[cat].cost += estimate.estimatedCost;
    costByCategoryMap[cat].count += 1;
  }
  const costByCategory = Object.entries(costByCategoryMap)
    .map(([name, { cost, count }]) => ({ name, cost: Math.round(cost), count }))
    .sort((a, b) => b.cost - a.cost);

  // Cost by module
  const costByModuleMap: Record<string, { cost: number; count: number }> = {};
  for (const { bug, estimate } of bugCosts) {
    const mod = bug.module || "Unknown";
    if (!costByModuleMap[mod]) costByModuleMap[mod] = { cost: 0, count: 0 };
    costByModuleMap[mod].cost += estimate.estimatedCost;
    costByModuleMap[mod].count += 1;
  }
  const costByModule = Object.entries(costByModuleMap)
    .map(([name, { cost, count }]) => ({ name, cost: Math.round(cost), count }))
    .sort((a, b) => b.cost - a.cost);

  // Repeat offenders: top areas by cost
  const repeatOffenders = Object.entries(categoryDistribution)
    .map(([name, data]) => ({
      name,
      count: data.count,
      percent: data.percent,
      cost: costByCategoryMap[name]?.cost ? Math.round(costByCategoryMap[name].cost) : 0,
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);

  // Date range
  const dates = bugs
    .map((b) => b.createdAt)
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const dateRange =
    dates.length > 0
      ? `${dates[0].toISOString().split("T")[0]} to ${dates[dates.length - 1].toISOString().split("T")[0]}`
      : "N/A";

  return {
    totalBugs: total,
    dateRange,
    resolutionBreakdown,
    moduleDistribution,
    categoryDistribution,
    codeChangePercent,
    topCategories,
    topBugSummaries,
    totalEstimatedCost: Math.round(totalEstimatedCost),
    noisePercent,
    noiseCount: noiseBugs.length,
    noiseCost: Math.round(noiseCost),
    avgResolutionDays,
    medianResolutionDays,
    criticalCount,
    highCount,
    costByCategory,
    costByModule,
    assigneeBreakdown,
    repeatOffenders,
  };
}
