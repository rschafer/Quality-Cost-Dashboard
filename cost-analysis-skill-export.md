# Cost Analysis CLI Skill for Claude Code

This skill adds a `/cost-analysis` command to Claude Code that analyzes Jira CSV/JSON exports and displays a cost breakdown in the terminal.

## Setup

Place the two files below in your project:

---

## File 1: `.claude/skills/cost-analysis.md`

```markdown
---
name: cost-analysis
description: Analyze a Jira CSV/JSON export and display a cost breakdown table in the CLI
user_invocable: true
---

# Cost Analysis CLI Skill

When the user runs `/cost-analysis`, do the following:

## 1. Find the data file

- Check if the user provided a file path as an argument (e.g., `/cost-analysis path/to/file.csv`)
- If no argument, look for CSV/JSON files in the project root or `public/` directory
- If multiple candidates exist, ask the user which file to analyze
- Also check for a reference rate file at `.claude/cost-config.json` — if it exists, read the `hourlyRate` from it. Otherwise default to $67/hr.

## 2. Parse the data

Use a Bash command to run a Node.js script inline that:
- Reads the CSV using the project's parser at `src/lib/csv-parser.ts`
- Computes stats using `src/lib/stats.ts`
- Computes cost breakdowns using `src/lib/cost-calculator.ts`

**Important**: Since these are TypeScript files with path aliases, use `npx tsx` to execute them.

## 3. Display results as formatted tables

Output the analysis directly as markdown tables. Include these sections:

### Overview
| Metric | Value |
|--------|-------|
| Total Tickets | N |
| Date Range | start – end |
| Total Estimated Cost | $X |
| Noise Cost (wasted) | $X (N%) |
| Avg Resolution | N days |

### Cost by Category (top 10)
| Category | Tickets | Cost | % of Total |
|----------|---------|------|------------|
| ... | ... | ... | ... |

### Cost by Module (top 10)
| Module | Tickets | Cost | % of Total |
|--------|---------|------|------------|
| ... | ... | ... | ... |

### Resolution Breakdown
| Resolution | Count | % |
|------------|-------|---|
| ... | ... | ... |

### Summary
Write 2-3 plain-language sentences summarizing the key takeaways, focused on resolution patterns and the biggest problem areas (not cost).

## Implementation approach

Write and execute a single `npx tsx` script that imports from the project's existing libs. Example structure:

\`\`\`typescript
import { parseCSVFile, DEFAULT_COLUMN_MAPPING } from './src/lib/csv-parser';
import { computeStats } from './src/lib/stats';
import { readFileSync } from 'fs';

const csv = readFileSync('PATH', 'utf-8');
const { bugs } = parseCSVFile(csv, DEFAULT_COLUMN_MAPPING);
const bugLikes = bugs.map((b, i) => ({ id: b.jiraKey || `bug-${i}`, ...b }));
const stats = computeStats(bugLikes, RATE);
// ... format and print tables
\`\`\`

Use `console.log` to output the formatted markdown tables. The user will see the output directly in their terminal.
```

---

## File 2: `scripts/cost-analysis.ts`

```typescript
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseCSVFile, DEFAULT_COLUMN_MAPPING } from "../src/lib/csv-parser";
import { computeStats } from "../src/lib/stats";
import { estimateBugCost } from "../src/lib/cost-calculator";
import type { BugLike } from "../src/lib/cost-calculator";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx scripts/cost-analysis.ts <path-to-csv>");
  process.exit(1);
}

// Read config
let hourlyRate = 67;
try {
  const config = JSON.parse(readFileSync(resolve(__dirname, "../.claude/cost-config.json"), "utf-8"));
  if (config.hourlyRate) hourlyRate = config.hourlyRate;
} catch {}

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

const stats = computeStats(bugs, hourlyRate);

const fmt = (n: number) => "$" + n.toLocaleString("en-US");
const pad = (s: string, w: number) => s.padEnd(w);
const padL = (s: string, w: number) => s.padStart(w);

// Overview
console.log("\n╔══════════════════════════════════════════════╗");
console.log("║           COST ANALYSIS REPORT               ║");
console.log("╚══════════════════════════════════════════════╝\n");
console.log(`  Rate: $${hourlyRate}/hr\n`);

const overviewRows = [
  ["Total Tickets", String(stats.totalBugs)],
  ["Date Range", stats.dateRange],
  ["Total Estimated Cost", fmt(stats.totalEstimatedCost)],
  ["Noise Cost (wasted)", `${fmt(stats.noiseCost)} (${stats.noisePercent}%)`],
  ["Avg Resolution", `${stats.avgResolutionDays} days`],
  ["Median Resolution", `${stats.medianResolutionDays} days`],
  ["Critical + High", `${stats.criticalCount + stats.highCount}`],
];

console.log("┌─────────────────────┬──────────────────────────┐");
console.log("│ Metric              │ Value                    │");
console.log("├─────────────────────┼──────────────────────────┤");
for (const [metric, value] of overviewRows) {
  console.log(`│ ${pad(metric, 19)} │ ${pad(value, 24)} │`);
}
console.log("└─────────────────────┴──────────────────────────┘\n");

// Cost by Category
if (stats.costByCategory.length > 0) {
  console.log("COST BY CATEGORY");
  console.log("┌────────────────────┬─────────┬────────────┬────────┐");
  console.log("│ Category           │ Tickets │ Cost       │ % Tot  │");
  console.log("├────────────────────┼─────────┼────────────┼────────┤");
  for (const cat of stats.costByCategory.slice(0, 10)) {
    const pct = stats.totalEstimatedCost > 0 ? ((cat.cost / stats.totalEstimatedCost) * 100).toFixed(1) : "0";
    console.log(`│ ${pad(cat.name.slice(0, 18), 18)} │ ${padL(String(cat.count), 7)} │ ${padL(fmt(cat.cost), 10)} │ ${padL(pct + "%", 6)} │`);
  }
  console.log("└────────────────────┴─────────┴────────────┴────────┘\n");
}

// Cost by Module
if (stats.costByModule.length > 0) {
  console.log("COST BY MODULE");
  console.log("┌────────────────────┬─────────┬────────────┬────────┐");
  console.log("│ Module             │ Tickets │ Cost       │ % Tot  │");
  console.log("├────────────────────┼─────────┼────────────┼────────┤");
  for (const mod of stats.costByModule.slice(0, 10)) {
    const pct = stats.totalEstimatedCost > 0 ? ((mod.cost / stats.totalEstimatedCost) * 100).toFixed(1) : "0";
    console.log(`│ ${pad(mod.name.slice(0, 18), 18)} │ ${padL(String(mod.count), 7)} │ ${padL(fmt(mod.cost), 10)} │ ${padL(pct + "%", 6)} │`);
  }
  console.log("└────────────────────┴─────────┴────────────┴────────┘\n");
}

// Resolution Breakdown
const resEntries = Object.entries(stats.resolutionBreakdown).sort((a, b) => b[1].count - a[1].count);
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

// Per-ticket cost analysis (sorted by cost descending)
const ticketCosts = bugs
  .map((b) => ({ ...b, estimate: estimateBugCost(b, hourlyRate) }))
  .sort((a, b) => b.estimate.estimatedCost - a.estimate.estimatedCost);

console.log("TICKET COST ANALYSIS (top 20)");
console.log("┌────────────┬────────────────────────────────┬──────────┬────────┬───────────┬──────────────┐");
console.log("│ Key        │ Summary                        │ Priority │ Hours  │ Cost      │ Method       │");
console.log("├────────────┼────────────────────────────────┼──────────┼────────┼───────────┼──────────────┤");
for (const t of ticketCosts.slice(0, 20)) {
  const key = (t.jiraKey || "—").slice(0, 10);
  const summ = t.summary.slice(0, 30);
  const pri = (t.priority || "—").slice(0, 8);
  const method = t.estimate.methodology.replace("_", " ");
  console.log(
    `│ ${pad(key, 10)} │ ${pad(summ, 30)} │ ${pad(pri, 8)} │ ${padL(String(t.estimate.estimatedHours), 6)} │ ${padL(fmt(t.estimate.estimatedCost), 9)} │ ${pad(method, 12)} │`
  );
}
console.log("└────────────┴────────────────────────────────┴──────────┴────────┴───────────┴──────────────┘");

// Method breakdown
const methodCounts: Record<string, { count: number; cost: number }> = {};
for (const t of ticketCosts) {
  const m = t.estimate.methodology.replace("_", " ");
  if (!methodCounts[m]) methodCounts[m] = { count: 0, cost: 0 };
  methodCounts[m].count++;
  methodCounts[m].cost += t.estimate.estimatedCost;
}
console.log("\nCOST ESTIMATION METHODS");
console.log("┌──────────────────┬───────┬────────────┐");
console.log("│ Method           │ Count │ Total Cost │");
console.log("├──────────────────┼───────┼────────────┤");
for (const [method, { count, cost }] of Object.entries(methodCounts).sort((a, b) => b[1].cost - a[1].cost)) {
  console.log(`│ ${pad(method, 16)} │ ${padL(String(count), 5)} │ ${padL(fmt(Math.round(cost)), 10)} │`);
}
console.log("└──────────────────┴───────┴────────────┘\n");

// Summary
const topCat = stats.costByCategory[0];
const lines: string[] = [];
lines.push(`Out of ${stats.totalBugs} tickets, ${stats.noisePercent}% were noise and never needed a code fix.`);
if (topCat) lines.push(`The biggest problem area is "${topCat.name}" with ${topCat.count} tickets.`);
if (stats.avgResolutionDays > 7) {
  lines.push(`Tickets take an average of ${stats.avgResolutionDays} days to resolve — quicker triage could help.`);
} else {
  lines.push(`Tickets are resolved in ${stats.avgResolutionDays} days on average (${stats.medianResolutionDays} day median).`);
}
console.log("SUMMARY");
console.log(lines.join(" ") + "\n");
```

---

## Requirements

This skill depends on the Quality Improvement Dashboard project libraries:
- `src/lib/csv-parser.ts` — CSV/JSON parsing with column mapping
- `src/lib/stats.ts` — Stats computation (resolution breakdown, categories, modules)
- `src/lib/cost-calculator.ts` — Bug cost estimation ($67/hr default)

Install dependencies: `npm install` in the project root, then run with `npx tsx scripts/cost-analysis.ts <path-to-csv>`.
