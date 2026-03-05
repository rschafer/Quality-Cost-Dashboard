# Quality Improvement Dashboard

## Overview
Bug cost analysis dashboard for engineering teams. Upload Jira CSV/JSON data, analyze patterns, estimate costs, and get AI-powered recommendations.

## Tech Stack
- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5
- **Database**: SQLite via Prisma 7 (`dev.db` local, `@prisma/adapter-better-sqlite3`)
- **UI**: Tailwind CSS v4, shadcn/ui (New York style, Zinc base), Recharts 3, Lucide icons
- **AI**: Anthropic SDK (`@anthropic-ai/sdk`) — Claude Sonnet 4 for analysis
- **Data**: papaparse for CSV parsing, uuid for IDs

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint
- Prisma: `npx prisma migrate dev`, `npx prisma generate`

## Project Structure
```
src/
├── app/                    # Pages + API routes (App Router)
│   ├── page.tsx            # Main dashboard (upload → stats view)
│   ├── api/                # Route handlers
│   │   ├── import/csv/     # CSV upload + parse
│   │   ├── analysis/       # summary, costs, trends, ai, category-detail
│   │   ├── snapshots/      # Snapshot CRUD
│   │   └── settings/       # Key-value settings
│   ├── costs/              # Cost breakdown page
│   ├── trends/             # Trend comparison page
│   ├── insights/           # Insights page
│   └── recommendations/    # Recommendations page
├── components/
│   ├── ui/                 # shadcn/ui primitives (button, card, dialog, etc.)
│   ├── charts/             # SwitchableChart, CostBreakdownChart, TrendLineChart, etc.
│   ├── dashboard/          # StatCard, DashboardCharts
│   └── layout/             # Sidebar
├── lib/                    # Business logic
│   ├── prisma.ts           # DB singleton (BetterSqlite3 adapter)
│   ├── csv-parser.ts       # CSV/JSON parsing + column mapping
│   ├── stats.ts            # Stats computation, noise detection
│   ├── cost-calculator.ts  # Bug cost estimation ($67/hr)
│   ├── suggestions.ts      # Dashboard + category suggestion generation
│   ├── analysis.ts         # Claude AI analysis runner
│   ├── anthropic.ts        # Anthropic SDK singleton
│   ├── prompts.ts          # Claude prompt builders
│   └── trend-calculator.ts # Trend comparison + hotspot detection
├── types/                  # TypeScript interfaces (bug.ts, analysis.ts, import.ts)
└── generated/prisma/       # Auto-generated Prisma client
prisma/
├── schema.prisma           # Models: Bug, Snapshot, Analysis, Setting
└── migrations/
```

## Key Conventions
- **Components**: PascalCase files, `"use client"` for interactive components
- **Lib files**: kebab-case (`cost-calculator.ts`)
- **API routes**: `src/app/api/[path]/route.ts`, return `NextResponse.json()`
- **Error handling**: try/catch → `{ error: string }` response with appropriate status code
- **State**: React hooks only (useState, useEffect, useCallback, useMemo) — no Redux/Zustand
- **Styling**: Tailwind utilities + shadcn/ui components, CSS variables for theming

## Data Models
- **Bug**: Core issue data (jiraKey, summary, status, priority, module, storyPoints, timeSpent, etc.)
- **Snapshot**: A data import session (name, source, bugCount) → has many Bugs
- **Analysis**: Cached AI analysis results per snapshot
- **Setting**: Key-value app config

## Cost Estimation
Priority: actual time spent → time estimate → story points (1 SP = 4h) → priority fallback (Critical: 16h, High: 8h, Medium: 4h, Low: 2h). Rate: $67/hr.

## Environment Variables
```
DATABASE_URL="file:./dev.db"
ANTHROPIC_API_KEY=""           # Required for AI features
JIRA_BASE_URL=""               # Optional
JIRA_EMAIL=""
JIRA_API_TOKEN=""
```
