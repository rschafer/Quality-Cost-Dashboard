import { readFileSync } from "fs";
import { resolve } from "path";
import { parseCSVFile, DEFAULT_COLUMN_MAPPING } from "../src/lib/csv-parser";
import { computeStats } from "../src/lib/stats";
import { generateDashboardSuggestions } from "../src/lib/suggestions";
import type { BugLike } from "../src/lib/cost-calculator";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx scripts/bug-analysis.ts <path-to-csv>");
  process.exit(1);
}

// Parse CSV
const csv = readFileSync(resolve(filePath), "utf-8");
const { bugs: parsedBugs, errors } = parseCSVFile(csv, DEFAULT_COLUMN_MAPPING);

if (parsedBugs.length === 0) {
  console.error("No bugs found in file.");
  if (errors.length) console.error("Errors:", errors.slice(0, 5).join("\n"));
  process.exit(1);
}

const bugs: BugLike[] = parsedBugs.map((b, i) => ({
  id: b.jiraKey || `bug-${i}`,
  jiraKey: b.jiraKey,
  summary: b.summary,
  resolution: b.resolution,
  priority: b.priority,
  module: b.module,
  productCategory: b.productCategory,
  assignee: b.assignee,
  storyPoints: b.storyPoints,
  timeEstimateHours: b.timeEstimateHours,
  timeSpentHours: b.timeSpentHours,
  createdAt: b.createdAt,
  resolvedAt: b.resolvedAt,
}));

const stats = computeStats(bugs);

const pad = (s: string, w: number) => s.padEnd(w);
const padL = (s: string, w: number) => s.padStart(w);

// ── Overview ──────────────────────────────────────────────

console.log("\n╔══════════════════════════════════════════════╗");
console.log("║           BUG ANALYSIS REPORT                ║");
console.log("╚══════════════════════════════════════════════╝\n");

const overviewRows = [
  ["Total Tickets", String(stats.totalBugs)],
  ["Date Range", stats.dateRange],
  ["Avg Resolution", `${stats.avgResolutionDays} days`],
  ["Median Resolution", `${stats.medianResolutionDays} days`],
  ["Critical", String(stats.criticalCount)],
  ["High", String(stats.highCount)],
  ["Code Change Rate", `${stats.codeChangePercent}%`],
  ["Noise Rate", `${stats.noisePercent}% (${stats.noiseCount} tickets)`],
];

console.log("┌─────────────────────┬──────────────────────────┐");
console.log("│ Metric              │ Value                    │");
console.log("├─────────────────────┼──────────────────────────┤");
for (const [metric, value] of overviewRows) {
  console.log(`│ ${pad(metric, 19)} │ ${pad(value, 24)} │`);
}
console.log("└─────────────────────┴──────────────────────────┘\n");

// ── Bugs by Category ─────────────────────────────────────

const catEntries = Object.entries(stats.categoryDistribution)
  .sort((a, b) => b[1].count - a[1].count);

if (catEntries.length > 0) {
  console.log("BUGS BY CATEGORY");
  console.log("┌────────────────────────┬─────────┬────────┐");
  console.log("│ Category               │ Tickets │ %      │");
  console.log("├────────────────────────┼─────────┼────────┤");
  for (const [name, { count, percent }] of catEntries.slice(0, 10)) {
    console.log(`│ ${pad(name.slice(0, 22), 22)} │ ${padL(String(count), 7)} │ ${padL(percent.toFixed(1) + "%", 6)} │`);
  }
  console.log("└────────────────────────┴─────────┴────────┘\n");
}

// ── Bugs by Module ───────────────────────────────────────

const modEntries = Object.entries(stats.moduleDistribution)
  .sort((a, b) => b[1].count - a[1].count);

if (modEntries.length > 0) {
  console.log("BUGS BY MODULE");
  console.log("┌────────────────────────┬─────────┬────────┐");
  console.log("│ Module                 │ Tickets │ %      │");
  console.log("├────────────────────────┼─────────┼────────┤");
  for (const [name, { count, percent }] of modEntries.slice(0, 10)) {
    console.log(`│ ${pad(name.slice(0, 22), 22)} │ ${padL(String(count), 7)} │ ${padL(percent.toFixed(1) + "%", 6)} │`);
  }
  console.log("└────────────────────────┴─────────┴────────┘\n");
}

// ── Priority Distribution ────────────────────────────────

const priorityMap: Record<string, { count: number; percent: number }> = {};
for (const bug of bugs) {
  const pri = bug.priority || "Unknown";
  if (!priorityMap[pri]) priorityMap[pri] = { count: 0, percent: 0 };
  priorityMap[pri].count++;
}
for (const entry of Object.values(priorityMap)) {
  entry.percent = Math.round((entry.count / bugs.length) * 1000) / 10;
}
const priorityOrder = ["Critical", "High", "Medium", "Low", "Unknown"];
const priEntries = Object.entries(priorityMap)
  .sort((a, b) => priorityOrder.indexOf(a[0]) - priorityOrder.indexOf(b[0]));

if (priEntries.length > 0) {
  console.log("PRIORITY DISTRIBUTION");
  console.log("┌────────────────────────┬───────┬────────┐");
  console.log("│ Priority               │ Count │ %      │");
  console.log("├────────────────────────┼───────┼────────┤");
  for (const [name, { count, percent }] of priEntries) {
    console.log(`│ ${pad(name.slice(0, 22), 22)} │ ${padL(String(count), 5)} │ ${padL(percent.toFixed(1) + "%", 6)} │`);
  }
  console.log("└────────────────────────┴───────┴────────┘\n");
}

// ── Resolution Breakdown ─────────────────────────────────

const resEntries = Object.entries(stats.resolutionBreakdown)
  .sort((a, b) => b[1].count - a[1].count);

if (resEntries.length > 0) {
  console.log("RESOLUTION BREAKDOWN");
  console.log("┌────────────────────────┬───────┬────────┐");
  console.log("│ Resolution             │ Count │ %      │");
  console.log("├────────────────────────┼───────┼────────┤");
  for (const [name, { count, percent }] of resEntries) {
    console.log(`│ ${pad(name.slice(0, 22), 22)} │ ${padL(String(count), 5)} │ ${padL(percent.toFixed(1) + "%", 6)} │`);
  }
  console.log("└────────────────────────┴───────┴────────┘\n");
}

// ── Monthly Trend ────────────────────────────────────────

const monthlyMap: Record<string, number> = {};
for (const bug of bugs) {
  if (bug.createdAt) {
    const d = new Date(bug.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap[key] = (monthlyMap[key] || 0) + 1;
  }
}

const monthEntries = Object.entries(monthlyMap).sort((a, b) => a[0].localeCompare(b[0]));

if (monthEntries.length > 1) {
  const maxCount = Math.max(...monthEntries.map(([, c]) => c));
  const barWidth = 30;

  console.log("MONTHLY TREND");
  console.log("┌─────────┬───────┬─────────────────────────────────┐");
  console.log("│ Month   │ Count │ Distribution                    │");
  console.log("├─────────┼───────┼─────────────────────────────────┤");
  for (const [month, count] of monthEntries) {
    const barLen = maxCount > 0 ? Math.round((count / maxCount) * barWidth) : 0;
    const bar = "█".repeat(barLen) + "░".repeat(barWidth - barLen);
    console.log(`│ ${pad(month, 7)} │ ${padL(String(count), 5)} │ ${bar} │`);
  }
  console.log("└─────────┴───────┴─────────────────────────────────┘\n");

  // Trend direction
  if (monthEntries.length >= 3) {
    const recent3 = monthEntries.slice(-3).map(([, c]) => c);
    const earlier3 = monthEntries.slice(0, Math.min(3, monthEntries.length - 3)).map(([, c]) => c);
    const recentAvg = recent3.reduce((a, b) => a + b, 0) / recent3.length;
    const earlierAvg = earlier3.length > 0 ? earlier3.reduce((a, b) => a + b, 0) / earlier3.length : recentAvg;
    const change = earlierAvg > 0 ? Math.round(((recentAvg - earlierAvg) / earlierAvg) * 100) : 0;
    if (change > 10) {
      console.log(`  Trend: Bug volume is INCREASING (+${change}% recent vs earlier months)\n`);
    } else if (change < -10) {
      console.log(`  Trend: Bug volume is DECREASING (${change}% recent vs earlier months)\n`);
    } else {
      console.log(`  Trend: Bug volume is STABLE (${change > 0 ? "+" : ""}${change}% change)\n`);
    }
  }
}

// ── Bug Themes ───────────────────────────────────────────

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
  { pattern: /\bcrash/i, theme: "crashes" },
  { pattern: /\bui|display|visual|layout/i, theme: "UI/display" },
  { pattern: /\bnotif/i, theme: "notifications" },
  { pattern: /\bemail/i, theme: "email" },
  { pattern: /\bapi\b/i, theme: "API" },
  { pattern: /\bintegrat/i, theme: "integrations" },
  { pattern: /\breport/i, theme: "reporting" },
  { pattern: /\bsearch/i, theme: "search" },
];

const themeCounts: Record<string, number> = {};
for (const bug of bugs) {
  if (!bug.summary) continue;
  for (const { pattern, theme } of themePatterns) {
    if (pattern.test(bug.summary)) {
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    }
  }
}

const themes = Object.entries(themeCounts)
  .filter(([, count]) => count >= 2)
  .sort((a, b) => b[1] - a[1]);

if (themes.length > 0) {
  console.log("BUG THEMES (recurring patterns in summaries)");
  console.log("┌────────────────────────┬───────┬────────┐");
  console.log("│ Theme                  │ Count │ %      │");
  console.log("├────────────────────────┼───────┼────────┤");
  for (const [theme, count] of themes.slice(0, 15)) {
    const pct = ((count / bugs.length) * 100).toFixed(1);
    console.log(`│ ${pad(theme.slice(0, 22), 22)} │ ${padL(String(count), 5)} │ ${padL(pct + "%", 6)} │`);
  }
  console.log("└────────────────────────┴───────┴────────┘\n");
}

// ── Assignee Distribution ────────────────────────────────

const assigneeEntries = Object.entries(stats.assigneeBreakdown)
  .sort((a, b) => b[1].count - a[1].count);

if (assigneeEntries.length > 1) {
  console.log("TOP ASSIGNEES");
  console.log("┌────────────────────────┬───────┬────────┐");
  console.log("│ Assignee               │ Count │ %      │");
  console.log("├────────────────────────┼───────┼────────┤");
  for (const [name, { count, percent }] of assigneeEntries.slice(0, 10)) {
    console.log(`│ ${pad(name.slice(0, 22), 22)} │ ${padL(String(count), 5)} │ ${padL(percent.toFixed(1) + "%", 6)} │`);
  }
  console.log("└────────────────────────┴───────┴────────┘\n");
}

// ── Focus Areas & Suggestions ────────────────────────────

const suggestions = generateDashboardSuggestions(stats);

// Strip cost/dollar references from suggestions — this report is cost-free
function stripCostRefs(text: string): string {
  return text
    .replace(/\s*to save \$[\d,]+\.?/g, ".")
    .replace(/\s*at \$[\d,]+\s*\(\d+% of total\)/g, "")
    .replace(/\s*costing \$[\d,]+/g, "")
    .replace(/\s*\$[\d,]+\s*\(\d+% of total\)/g, "")
    .replace(/\d+% of total bug cost/g, "a large share of bugs")
    .replace(/most expensive category/g, "highest-volume category")
    .replace(/\.\./g, ".");
}

if (suggestions.length > 0) {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║         FOCUS AREAS & SUGGESTIONS            ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i];
    const impactLabel = s.impact === "high" ? "[HIGH]" : s.impact === "medium" ? "[MED] " : "[LOW] ";
    console.log(`  ${i + 1}. ${impactLabel} ${s.title}`);
    const desc = stripCostRefs(s.description);
    // Wrap description at ~70 chars
    const words = desc.split(" ");
    let line = "     ";
    for (const word of words) {
      if (line.length + word.length > 75) {
        console.log(line);
        line = "     " + word;
      } else {
        line += (line.trim() ? " " : "") + word;
      }
    }
    if (line.trim()) console.log(line);
    console.log();
  }
}

// ── Summary ──────────────────────────────────────────────

const topCat = catEntries[0];
const topMod = modEntries[0];
const lines: string[] = [];

lines.push(`Analyzed ${stats.totalBugs} tickets spanning ${stats.dateRange}.`);

if (topCat) {
  lines.push(`"${topCat[0]}" is the top bug category with ${topCat[1].count} tickets (${topCat[1].percent.toFixed(1)}%).`);
}
if (topMod && topMod[0] !== topCat?.[0]) {
  lines.push(`"${topMod[0]}" is the most affected module with ${topMod[1].count} tickets.`);
}

const critHighTotal = stats.criticalCount + stats.highCount;
const critHighPct = stats.totalBugs > 0 ? Math.round((critHighTotal / stats.totalBugs) * 100) : 0;
if (critHighPct > 30) {
  lines.push(`${critHighPct}% of bugs are Critical or High priority — significant quality pressure.`);
}

if (stats.noisePercent > 15) {
  lines.push(`${stats.noisePercent}% of tickets are noise (duplicates, not reproducible, etc.) — triage improvements would help.`);
}

if (stats.avgResolutionDays > 7) {
  lines.push(`Average resolution of ${stats.avgResolutionDays} days suggests room for faster triage and fixes.`);
}

console.log("SUMMARY");
console.log(lines.join(" ") + "\n");
