export interface KeyFinding {
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  category: "pattern" | "anomaly" | "trend" | "efficiency";
}

export interface RootCausePattern {
  pattern: string;
  description: string;
  affectedArea: string;
  suggestedAction: string;
}

export interface ProcessRecommendation {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
}

export interface TrackingRecommendation {
  field: string;
  currentIssue: string;
  suggestion: string;
}

export interface AIAnalysisResult {
  keyFindings: KeyFinding[];
  rootCausePatterns: RootCausePattern[];
  processRecommendations: ProcessRecommendation[];
  trackingRecommendations: TrackingRecommendation[];
}

export interface ComputedStats {
  totalBugs: number;
  dateRange: string;
  resolutionBreakdown: Record<string, { count: number; percent: number }>;
  moduleDistribution: Record<string, { count: number; percent: number }>;
  categoryDistribution: Record<string, { count: number; percent: number }>;
  codeChangePercent: number;
  topCategories: Array<{ name: string; count: number; percent: number }>;
  topBugSummaries: Array<{
    summary: string;
    resolution: string | null;
    productCategory: string | null;
  }>;
  totalEstimatedCost: number;
  trendData?: {
    previous: Record<string, number>;
    current: Record<string, number>;
    growing: Array<{ name: string; delta: number }>;
    shrinking: Array<{ name: string; delta: number }>;
  };
}

export interface TrendComparison {
  category: string;
  previousPercent: number;
  currentPercent: number;
  delta: number;
}
