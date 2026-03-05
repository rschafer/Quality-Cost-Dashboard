export interface BugData {
  id: string;
  jiraKey: string | null;
  summary: string;
  description: string | null;
  status: string;
  resolution: string | null;
  priority: string | null;
  issueType: string | null;
  module: string | null;
  productCategory: string | null;
  rootCause: string | null;
  assignee: string | null;
  reporter: string | null;
  labels: string | null;
  components: string | null;
  storyPoints: number | null;
  timeEstimateHours: number | null;
  timeSpentHours: number | null;
  createdAt: string;
  resolvedAt: string | null;
  updatedAt: string | null;
  snapshotId: string;
}

export interface SnapshotData {
  id: string;
  name: string;
  description: string | null;
  source: string;
  sourceDetail: string | null;
  projectKey: string | null;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  bugCount: number;
  importedAt: string;
}

export interface CostEstimate {
  bugId: string;
  jiraKey: string | null;
  summary: string;
  estimatedHours: number;
  estimatedCost: number;
  methodology: "time_tracking" | "story_points" | "priority_based";
  confidence: "high" | "medium" | "low";
}

export interface CostBreakdown {
  category: string;
  totalCost: number;
  bugCount: number;
  avgCostPerBug: number;
}
