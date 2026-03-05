import type { Bug } from "@/generated/prisma/client";
import type { CostEstimate, CostBreakdown } from "@/types/bug";

// ~$140K/year national average software engineer salary
// $140,000 / 2,080 standard work hours = ~$67/hour
const DEFAULT_HOURLY_RATE = 67;

// Story point to hours conversion (1 SP ≈ 4 hours)
const STORY_POINT_HOURS = 4;

// Priority-based hour estimates (fallback)
const PRIORITY_HOURS: Record<string, number> = {
  Critical: 16, // ~2 days
  Highest: 16,
  High: 8, // ~1 day
  Medium: 4, // ~half day
  Low: 2, // ~2 hours
  Lowest: 1,
};

export function estimateBugCost(
  bug: Bug,
  hourlyRate: number = DEFAULT_HOURLY_RATE
): CostEstimate {
  // Priority 1: Use actual time spent from Jira (highest confidence)
  if (bug.timeSpentHours && bug.timeSpentHours > 0) {
    return {
      bugId: bug.id,
      jiraKey: bug.jiraKey,
      summary: bug.summary,
      estimatedHours: bug.timeSpentHours,
      estimatedCost: Math.round(bug.timeSpentHours * hourlyRate * 100) / 100,
      methodology: "time_tracking",
      confidence: "high",
    };
  }

  // Priority 2: Use original estimate from Jira
  if (bug.timeEstimateHours && bug.timeEstimateHours > 0) {
    return {
      bugId: bug.id,
      jiraKey: bug.jiraKey,
      summary: bug.summary,
      estimatedHours: bug.timeEstimateHours,
      estimatedCost:
        Math.round(bug.timeEstimateHours * hourlyRate * 100) / 100,
      methodology: "time_tracking",
      confidence: "medium",
    };
  }

  // Priority 3: Convert story points to hours
  if (bug.storyPoints && bug.storyPoints > 0) {
    const hours = bug.storyPoints * STORY_POINT_HOURS;
    return {
      bugId: bug.id,
      jiraKey: bug.jiraKey,
      summary: bug.summary,
      estimatedHours: hours,
      estimatedCost: Math.round(hours * hourlyRate * 100) / 100,
      methodology: "story_points",
      confidence: "medium",
    };
  }

  // Priority 4: Estimate from priority (fallback)
  const hours = PRIORITY_HOURS[bug.priority || "Medium"] || 4;
  return {
    bugId: bug.id,
    jiraKey: bug.jiraKey,
    summary: bug.summary,
    estimatedHours: hours,
    estimatedCost: Math.round(hours * hourlyRate * 100) / 100,
    methodology: "priority_based",
    confidence: "low",
  };
}

export function calculateCostBreakdown(
  bugs: Bug[],
  groupBy: "module" | "productCategory" | "resolution",
  hourlyRate: number = DEFAULT_HOURLY_RATE
): CostBreakdown[] {
  const groups: Record<string, { totalCost: number; bugCount: number }> = {};

  for (const bug of bugs) {
    const key = bug[groupBy] || "Unknown";
    const estimate = estimateBugCost(bug, hourlyRate);

    if (!groups[key]) {
      groups[key] = { totalCost: 0, bugCount: 0 };
    }
    groups[key].totalCost += estimate.estimatedCost;
    groups[key].bugCount += 1;
  }

  return Object.entries(groups)
    .map(([category, data]) => ({
      category,
      totalCost: Math.round(data.totalCost * 100) / 100,
      bugCount: data.bugCount,
      avgCostPerBug:
        Math.round((data.totalCost / data.bugCount) * 100) / 100,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

export { DEFAULT_HOURLY_RATE };
