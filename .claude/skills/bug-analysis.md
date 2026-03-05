---
name: bug-analysis
description: Analyze a Jira CSV/JSON export for bug trends, patterns, and focus areas (no cost analysis)
user_invocable: true
---

# Bug Analysis CLI Skill

When the user runs `/bug-analysis`, do the following:

## 1. Find the data file

- Check if the user provided a file path as an argument (e.g., `/bug-analysis path/to/file.csv`)
- If no argument, look for CSV/JSON files in the project root or `public/` directory
- If multiple candidates exist, ask the user which file to analyze

## 2. Parse and analyze the data

Use a Bash command to run the script at `scripts/bug-analysis.ts` with `npx tsx`:

```bash
npx tsx scripts/bug-analysis.ts <path-to-csv>
```

The script imports from the project's existing libs to parse the data and compute bug-focused analytics.

## 3. Display results as formatted tables

Output the analysis directly in the terminal. The report includes:

### Overview
Total tickets, date range, resolution times, critical/high counts — no dollar figures.

### Bugs by Category (top 10)
Category, ticket count, and percentage of total.

### Bugs by Module (top 10)
Module, ticket count, and percentage of total.

### Priority Distribution
Priority level, count, and percentage.

### Resolution Breakdown
Resolution type, count, and percentage.

### Monthly Trend
Month-by-month ticket counts to show volume trends over time.

### Bug Themes
Recurring keyword patterns extracted from bug summaries (e.g., "export", "validation", "performance").

### Focus Areas & Suggestions
Actionable suggestions generated from the data — high-volume categories, resolution patterns, priority concentrations, and recurring themes. Each suggestion includes an impact rating (high/medium/low).

## Implementation approach

The script at `scripts/bug-analysis.ts` imports from the project's existing libs:
- `src/lib/csv-parser.ts` for parsing
- `src/lib/stats.ts` for stats computation
- `src/lib/suggestions.ts` for generating focus-area suggestions

Use `console.log` to output formatted tables. The user sees the output directly in their terminal.
