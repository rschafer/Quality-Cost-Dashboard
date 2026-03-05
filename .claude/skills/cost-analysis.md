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

```typescript
import { parseCSVFile, DEFAULT_COLUMN_MAPPING } from './src/lib/csv-parser';
import { computeStats } from './src/lib/stats';
import { readFileSync } from 'fs';

const csv = readFileSync('PATH', 'utf-8');
const { bugs } = parseCSVFile(csv, DEFAULT_COLUMN_MAPPING);
const bugLikes = bugs.map((b, i) => ({ id: b.jiraKey || `bug-${i}`, ...b }));
const stats = computeStats(bugLikes, RATE);
// ... format and print tables
```

Use `console.log` to output the formatted markdown tables. The user will see the output directly in their terminal.
