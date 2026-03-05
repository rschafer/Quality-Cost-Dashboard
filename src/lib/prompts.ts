import type { ComputedStats } from "@/types/analysis";

export function buildSummaryAnalysisPrompt(stats: ComputedStats): string {
  const resolutionLines = Object.entries(stats.resolutionBreakdown)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([key, val]) => `  - ${key}: ${val.count} (${val.percent}%)`)
    .join("\n");

  const moduleLines = Object.entries(stats.moduleDistribution)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 15)
    .map(([key, val]) => `  - ${key}: ${val.count} (${val.percent}%)`)
    .join("\n");

  const categoryLines = Object.entries(stats.categoryDistribution)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 15)
    .map(([key, val]) => `  - ${key}: ${val.count} (${val.percent}%)`)
    .join("\n");

  const topCategoryLines = stats.topCategories
    .map((c) => `  - ${c.name}: ${c.count} bugs (${c.percent}%)`)
    .join("\n");

  const sampleBugLines = stats.topBugSummaries
    .map(
      (b) =>
        `  - "${b.summary}" | Resolution: ${b.resolution || "N/A"} | Category: ${b.productCategory || "N/A"}`
    )
    .join("\n");

  let trendSection = "";
  if (stats.trendData) {
    const growingLines = stats.trendData.growing
      .slice(0, 5)
      .map((t) => `  - ${t.name}: +${t.delta}%`)
      .join("\n");
    const shrinkingLines = stats.trendData.shrinking
      .slice(0, 5)
      .map((t) => `  - ${t.name}: ${t.delta}%`)
      .join("\n");
    trendSection = `
TREND DATA (comparison between periods):
Growing categories:
${growingLines || "  (none)"}
Shrinking categories:
${shrinkingLines || "  (none)"}
`;
  }

  return `You are a senior quality engineering analyst specializing in software bug analysis and process improvement. Analyze the following bug data from a Jira project and provide structured insights.

BUG DATA SUMMARY:
- Total Bugs: ${stats.totalBugs}
- Date Range: ${stats.dateRange}
- Code Change Resolution Rate: ${stats.codeChangePercent}%
- Total Estimated Engineering Cost: $${stats.totalEstimatedCost.toLocaleString()}

RESOLUTION BREAKDOWN:
${resolutionLines}

MODULE DISTRIBUTION:
${moduleLines}

PRODUCT CATEGORY DISTRIBUTION:
${categoryLines}

TOP CATEGORIES BY VOLUME:
${topCategoryLines}

SAMPLE BUG SUMMARIES (first 20):
${sampleBugLines}
${trendSection}
Analyze this data and return a JSON object with exactly this structure:

{
  "keyFindings": [
    {
      "title": "string - short finding title",
      "description": "string - detailed explanation of the finding",
      "severity": "critical" | "warning" | "info",
      "category": "pattern" | "anomaly" | "trend" | "efficiency"
    }
  ],
  "rootCausePatterns": [
    {
      "pattern": "string - name of the root cause pattern",
      "description": "string - description of why this pattern exists",
      "affectedArea": "string - which module, category, or process area is affected",
      "suggestedAction": "string - specific action to address this root cause"
    }
  ],
  "processRecommendations": [
    {
      "title": "string - recommendation title",
      "description": "string - detailed description with specific steps",
      "impact": "high" | "medium" | "low",
      "effort": "high" | "medium" | "low"
    }
  ],
  "trackingRecommendations": [
    {
      "field": "string - the Jira field name",
      "currentIssue": "string - what is wrong with current usage",
      "suggestion": "string - how to improve usage of this field"
    }
  ]
}

Guidelines for your analysis:
- Identify 4-8 key findings, prioritizing critical patterns and anomalies
- Identify 3-6 root cause patterns based on the data distributions
- Provide 4-8 process recommendations, focusing on high-impact/low-effort items first
- Provide 3-6 tracking recommendations for improving Jira data quality
- Base severity on the scale of impact: critical = affects >30% of bugs or has major cost implications, warning = notable pattern worth addressing, info = useful observation
- Be specific and actionable - reference actual categories, modules, and percentages from the data
- Consider the code change percentage as an indicator of preventable bugs vs. configuration/environment issues

Return ONLY the JSON object, no other text or markdown formatting.`;
}

export function buildRecommendationsPrompt(stats: ComputedStats): string {
  const resolutionLines = Object.entries(stats.resolutionBreakdown)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([key, val]) => `  - ${key}: ${val.count} (${val.percent}%)`)
    .join("\n");

  const categoryLines = Object.entries(stats.categoryDistribution)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 15)
    .map(([key, val]) => `  - ${key}: ${val.count} (${val.percent}%)`)
    .join("\n");

  const moduleLines = Object.entries(stats.moduleDistribution)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 15)
    .map(([key, val]) => `  - ${key}: ${val.count} (${val.percent}%)`)
    .join("\n");

  const unknownResolutions = stats.resolutionBreakdown["Unknown"];
  const unknownCategories = stats.categoryDistribution["Unknown"];
  const unknownModules = stats.moduleDistribution["Unknown"];

  return `You are a Jira process consultant specializing in bug tracking optimization. Based on the following bug data, provide specific recommendations for improving the Jira workflow, field usage, and categorization.

PROJECT STATISTICS:
- Total Bugs: ${stats.totalBugs}
- Date Range: ${stats.dateRange}
- Code Change Rate: ${stats.codeChangePercent}%
- Estimated Cost: $${stats.totalEstimatedCost.toLocaleString()}

RESOLUTION TYPES:
${resolutionLines}

PRODUCT CATEGORIES:
${categoryLines}

MODULE DISTRIBUTION:
${moduleLines}

DATA QUALITY OBSERVATIONS:
- Bugs with "Unknown" resolution: ${unknownResolutions ? `${unknownResolutions.count} (${unknownResolutions.percent}%)` : "0"}
- Bugs with "Unknown" category: ${unknownCategories ? `${unknownCategories.count} (${unknownCategories.percent}%)` : "0"}
- Bugs with "Unknown" module: ${unknownModules ? `${unknownModules.count} (${unknownModules.percent}%)` : "0"}

Focus your analysis on these areas:

1. JIRA PROCESS IMPROVEMENTS: How can the bug filing, triage, and resolution workflow be improved? Consider mandatory fields, workflow transitions, and automation rules.

2. FIELD USAGE OPTIMIZATION: Which fields are underutilized or inconsistently filled? How can field options be consolidated or clarified?

3. CATEGORIZATION IMPROVEMENTS: Are there too many categories? Are categories overlapping? Should categories be restructured?

4. RESOLUTION STANDARDIZATION: Are resolution types clear and consistently used? Should any be merged or renamed?

Return a JSON object with this structure:

{
  "processRecommendations": [
    {
      "title": "string",
      "description": "string - detailed description with specific implementation steps",
      "impact": "high" | "medium" | "low",
      "effort": "high" | "medium" | "low"
    }
  ],
  "trackingRecommendations": [
    {
      "field": "string - Jira field name",
      "currentIssue": "string - what is wrong with current usage",
      "suggestion": "string - specific improvement suggestion"
    }
  ]
}

Guidelines:
- Provide 5-10 process recommendations ordered by impact
- Provide 4-8 tracking recommendations covering key Jira fields
- Be specific: reference actual category names, resolution types, and percentages
- Focus on practical changes that a Jira admin or team lead can implement
- Consider the cost of poor categorization in terms of missed patterns and wasted analysis time

Return ONLY the JSON object, no other text or markdown formatting.`;
}
