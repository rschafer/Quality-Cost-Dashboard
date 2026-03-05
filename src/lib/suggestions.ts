import type { EnrichedStats } from "./stats";

export interface Suggestion {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
}

export interface CategoryDetail {
  name: string;
  cost: number;
  count: number;
  resolutionBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  avgResolutionDays: number;
  sampleSummaries: string[];
  suggestions: Suggestion[];
}

/**
 * Generate dashboard-level suggestions from overall stats.
 */
export function generateDashboardSuggestions(stats: EnrichedStats): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // High noise ratio
  if (stats.noisePercent > 20) {
    suggestions.push({
      title: "Reduce ticket noise",
      description: `${stats.noisePercent}% of tickets (${stats.noiseCount}) are noise — duplicates, not reproducible, or product explanations. Implement better triage, duplicate detection, and self-service docs to save ${fmt(stats.noiseCost)}.`,
      impact: "high",
    });
  } else if (stats.noisePercent > 10) {
    suggestions.push({
      title: "Improve ticket triage",
      description: `${stats.noisePercent}% of tickets are noise. A lightweight triage checklist could reduce wasted effort by ${fmt(stats.noiseCost)}.`,
      impact: "medium",
    });
  }

  // Top cost category
  if (stats.costByCategory.length > 0) {
    const top = stats.costByCategory[0];
    const pct = stats.totalEstimatedCost > 0
      ? Math.round((top.cost / stats.totalEstimatedCost) * 100)
      : 0;
    suggestions.push({
      title: `Prioritize "${top.name}" bugs`,
      description: `"${top.name}" is your most expensive category at ${fmt(top.cost)} (${pct}% of total). Focus automated testing and code reviews on this area to prevent recurrence.`,
      impact: "high",
    });
  }

  // High duplicate rate
  const dupEntry = stats.resolutionBreakdown["Duplicate"];
  if (dupEntry && dupEntry.percent > 8) {
    suggestions.push({
      title: "Implement duplicate detection",
      description: `${dupEntry.percent}% of tickets are duplicates. Add a similar-ticket search in your bug reporting flow to catch duplicates before they're filed.`,
      impact: "medium",
    });
  }

  // Long resolution times
  if (stats.avgResolutionDays > 10) {
    suggestions.push({
      title: "Speed up resolution times",
      description: `Average resolution is ${stats.avgResolutionDays} days. Consider breaking complex bugs into smaller tasks, setting SLAs by priority, and doing regular bug triage standups.`,
      impact: "high",
    });
  } else if (stats.avgResolutionDays > 7) {
    suggestions.push({
      title: "Improve resolution cadence",
      description: `Average resolution is ${stats.avgResolutionDays} days. Weekly bug bashes or dedicated fix sprints could bring this down.`,
      impact: "medium",
    });
  }

  // Many critical/high bugs
  const critHighTotal = stats.criticalCount + stats.highCount;
  const critHighPct = stats.totalBugs > 0
    ? Math.round((critHighTotal / stats.totalBugs) * 100)
    : 0;
  if (critHighPct > 40) {
    suggestions.push({
      title: "Address critical/high bug backlog",
      description: `${critHighPct}% of bugs are Critical or High priority (${critHighTotal} tickets). This suggests systemic quality issues — invest in code review gates and integration tests.`,
      impact: "high",
    });
  }

  // Concentration in one module
  if (stats.costByModule.length > 1) {
    const topMod = stats.costByModule[0];
    const modPct = stats.totalEstimatedCost > 0
      ? Math.round((topMod.cost / stats.totalEstimatedCost) * 100)
      : 0;
    if (modPct > 50) {
      suggestions.push({
        title: `Stabilize the "${topMod.name}" module`,
        description: `"${topMod.name}" accounts for ${modPct}% of total bug cost. Consider a dedicated refactoring effort, better test coverage, or architectural review for this module.`,
        impact: "high",
      });
    }
  }

  // Not reproducible rate
  const nrEntry = stats.resolutionBreakdown["Not Reproducible"];
  if (nrEntry && nrEntry.percent > 5) {
    suggestions.push({
      title: "Improve bug reporting quality",
      description: `${nrEntry.percent}% of tickets are not reproducible. Add required fields for steps-to-reproduce, environment info, and screenshots in your bug template.`,
      impact: "medium",
    });
  }

  const impactOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);
  return suggestions.slice(0, 5);
}

/**
 * Extract recurring keyword themes from bug summaries.
 * Returns top themes with their frequency.
 */
function extractSummaryThemes(summaries: string[]): Array<{ theme: string; count: number }> {
  // Common keywords to look for in bug summaries
  const themePatterns: Array<{ pattern: RegExp; theme: string }> = [
    { pattern: /\bexport\b/i, theme: "export" },
    { pattern: /\bimport\b/i, theme: "import" },
    { pattern: /\bfilter/i, theme: "filtering" },
    { pattern: /\bfield\b/i, theme: "field handling" },
    { pattern: /\bsave|saving\b/i, theme: "save operations" },
    { pattern: /\bload|loading\b/i, theme: "loading" },
    { pattern: /\bperformance|slow|timeout|hang/i, theme: "performance" },
    { pattern: /\bpermission|access|auth/i, theme: "permissions" },
    { pattern: /\bvalidat/i, theme: "validation" },
    { pattern: /\bformat/i, theme: "formatting" },
    { pattern: /\bsort/i, theme: "sorting" },
    { pattern: /\bsync/i, theme: "syncing" },
    { pattern: /\bmapping|map\b/i, theme: "data mapping" },
    { pattern: /\bduplicate/i, theme: "duplicates" },
    { pattern: /\bcustom field/i, theme: "custom fields" },
    { pattern: /\bbulk/i, theme: "bulk operations" },
    { pattern: /\bupgrade|update|migration/i, theme: "upgrades/migrations" },
    { pattern: /\bmissing/i, theme: "missing data" },
    { pattern: /\bwrong|incorrect/i, theme: "incorrect behavior" },
    { pattern: /\bbroken|fail|error/i, theme: "failures/errors" },
  ];

  const counts: Record<string, number> = {};
  for (const summary of summaries) {
    for (const { pattern, theme } of themePatterns) {
      if (pattern.test(summary)) {
        counts[theme] = (counts[theme] || 0) + 1;
      }
    }
  }

  return Object.entries(counts)
    .map(([theme, count]) => ({ theme, count }))
    .filter((t) => t.count >= 2) // only themes appearing 2+ times
    .sort((a, b) => b.count - a.count);
}

/**
 * Generate per-category suggestions from category-specific bug data.
 * Analyzes bug summaries and resolution patterns for deeper insights.
 */
export function generateCategorySuggestions(detail: {
  name: string;
  count: number;
  cost: number;
  resolutionBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  avgResolutionDays: number;
  totalBugs: number;
  totalCost: number;
  summaries?: string[];
  resolutionSummaries?: Record<string, string[]>;
}): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const { name, count, cost, resolutionBreakdown, priorityBreakdown, avgResolutionDays, totalBugs, totalCost, summaries, resolutionSummaries } = detail;

  const costPct = totalCost > 0 ? Math.round((cost / totalCost) * 100) : 0;
  const countPct = totalBugs > 0 ? Math.round((count / totalBugs) * 100) : 0;

  // Analyze summary themes for pattern-based suggestions
  if (summaries && summaries.length > 0) {
    const themes = extractSummaryThemes(summaries);
    if (themes.length > 0) {
      const topThemes = themes.slice(0, 3);
      const themePct = Math.round((topThemes[0].count / count) * 100);
      if (themePct >= 30) {
        suggestions.push({
          title: `Recurring pattern: ${topThemes[0].theme}`,
          description: `${topThemes[0].count} of ${count} bugs (${themePct}%) involve "${topThemes[0].theme}". ${topThemes.length > 1 ? `Other common themes: ${topThemes.slice(1).map(t => `${t.theme} (${t.count})`).join(", ")}.` : ""} Target these specific areas with focused code reviews and test coverage.`,
          impact: "high",
        });
      }
    }
  }

  // Analyze resolution-grouped summaries for fix-pattern insights
  if (resolutionSummaries) {
    const codeChangeSummaries = resolutionSummaries["Code Change"] || resolutionSummaries["Fixed"] || [];
    if (codeChangeSummaries.length >= 3) {
      const themes = extractSummaryThemes(codeChangeSummaries);
      if (themes.length > 0 && themes[0].count >= 2) {
        suggestions.push({
          title: `Code fixes cluster around "${themes[0].theme}"`,
          description: `${themes[0].count} code-change resolutions relate to "${themes[0].theme}". This subsystem likely needs a targeted refactor or better test coverage to prevent repeat issues.`,
          impact: "high",
        });
      }
    }

    // Check if noise resolutions have patterns
    const noiseSummaries = [
      ...(resolutionSummaries["Duplicate"] || []),
      ...(resolutionSummaries["Not Reproducible"] || []),
      ...(resolutionSummaries["Product Explanation"] || []),
    ];
    if (noiseSummaries.length >= 2) {
      const themes = extractSummaryThemes(noiseSummaries);
      if (themes.length > 0) {
        suggestions.push({
          title: `Noise tickets often mention "${themes[0].theme}"`,
          description: `${themes[0].count} noise tickets (duplicates, not reproducible, explanations) involve "${themes[0].theme}". Consider adding documentation or FAQ entries for this area to reduce repeat filings.`,
          impact: "medium",
        });
      }
    }
  }

  // High cost concentration
  if (costPct > 15) {
    suggestions.push({
      title: `Invest in automated testing for "${name}"`,
      description: `This category represents ${costPct}% of total bug cost. Adding targeted unit and integration tests could prevent many of these ${count} bugs from recurring.`,
      impact: "high",
    });
  }

  // Duplicates within category
  const dupCount = resolutionBreakdown["Duplicate"] || 0;
  if (dupCount > 0 && count > 0 && (dupCount / count) > 0.1) {
    suggestions.push({
      title: "Reduce duplicate filings",
      description: `${dupCount} of ${count} tickets in "${name}" are duplicates (${Math.round((dupCount / count) * 100)}%). Better search and a known-issues page would help.`,
      impact: "medium",
    });
  }

  // High priority ratio
  const critHigh = (priorityBreakdown["Critical"] || 0) + (priorityBreakdown["High"] || 0);
  if (critHigh > 0 && count > 0 && (critHigh / count) > 0.5) {
    suggestions.push({
      title: "Address severity concentration",
      description: `${Math.round((critHigh / count) * 100)}% of "${name}" bugs are Critical or High. This pattern often indicates a fragile subsystem that needs architectural attention.`,
      impact: "high",
    });
  }

  // Slow resolution
  if (avgResolutionDays > 10) {
    suggestions.push({
      title: "Reduce time-to-fix",
      description: `Average resolution for "${name}" is ${avgResolutionDays} days. Consider dedicated ownership or time-boxed fix sprints for this category.`,
      impact: "medium",
    });
  }

  // High volume
  if (countPct > 20) {
    suggestions.push({
      title: "Investigate root cause",
      description: `"${name}" accounts for ${countPct}% of all bugs. A root-cause analysis session focused on this area could yield systemic improvements.`,
      impact: "high",
    });
  }

  // Fallback
  if (suggestions.length === 0) {
    suggestions.push({
      title: "Monitor and maintain",
      description: `"${name}" has ${count} bugs costing ${fmt(cost)}. Continue monitoring for emerging patterns and consider adding regression tests.`,
      impact: "low",
    });
  }

  const impactOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);
  return suggestions.slice(0, 5);
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
