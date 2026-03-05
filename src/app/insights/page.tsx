"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SnapshotData } from "@/types/bug";
import type {
  AIAnalysisResult,
  KeyFinding,
  RootCausePattern,
  ProcessRecommendation,
  TrackingRecommendation,
} from "@/types/analysis";

interface AnalysisResponse extends AIAnalysisResult {
  metadata?: {
    id: string;
    modelUsed: string;
    tokenCount: number | null;
    generatedAt: string;
  };
}

const severityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  info: "bg-blue-100 text-blue-800 border-blue-200",
};

const impactColors: Record<string, string> = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-green-100 text-green-800 border-green-200",
};

const effortColors: Record<string, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-green-50 text-green-700 border-green-200",
};

const categoryLabels: Record<string, string> = {
  pattern: "Pattern",
  anomaly: "Anomaly",
  trend: "Trend",
  efficiency: "Efficiency",
};

export default function InsightsPage() {
  const [snapshots, setSnapshots] = useState<SnapshotData[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPatterns, setExpandedPatterns] = useState<Set<number>>(
    new Set()
  );

  // Fetch snapshots on mount
  useEffect(() => {
    async function fetchSnapshots() {
      try {
        const res = await fetch("/api/snapshots");
        if (!res.ok) throw new Error("Failed to fetch snapshots");
        const data = await res.json();
        setSnapshots(data);
      } catch (err) {
        console.error("Failed to fetch snapshots:", err);
      }
    }
    fetchSnapshots();
  }, []);

  // Fetch existing analysis when snapshot changes
  const fetchExistingAnalysis = useCallback(async (snapshotId: string) => {
    setLoadingExisting(true);
    setError(null);
    setAnalysis(null);

    try {
      const res = await fetch(
        `/api/analysis/ai?snapshotId=${encodeURIComponent(snapshotId)}`
      );
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      }
      // 404 is expected when no analysis exists yet
    } catch (err) {
      console.error("Failed to fetch existing analysis:", err);
    } finally {
      setLoadingExisting(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSnapshotId) {
      fetchExistingAnalysis(selectedSnapshotId);
    } else {
      setAnalysis(null);
    }
  }, [selectedSnapshotId, fetchExistingAnalysis]);

  // Run AI analysis
  async function handleRunAnalysis() {
    if (!selectedSnapshotId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/analysis/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId: selectedSnapshotId }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to run AI analysis");
      }

      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setLoading(false);
    }
  }

  function togglePattern(index: number) {
    setExpandedPatterns((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">AI Insights</h1>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Configuration</CardTitle>
          <CardDescription>
            Select a data snapshot and run Claude-powered analysis to identify
            bug patterns, root causes, and actionable recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-sm">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Data Snapshot
              </label>
              <Select
                value={selectedSnapshotId}
                onValueChange={setSelectedSnapshotId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a snapshot..." />
                </SelectTrigger>
                <SelectContent>
                  {snapshots.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.bugCount} bugs)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleRunAnalysis}
              disabled={!selectedSnapshotId || loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Analyzing...
                </span>
              ) : (
                "Run Analysis"
              )}
            </Button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
          {analysis?.metadata && (
            <p className="mt-3 text-xs text-muted-foreground">
              Last analyzed:{" "}
              {new Date(analysis.metadata.generatedAt).toLocaleString()} | Model:{" "}
              {analysis.metadata.modelUsed}
              {analysis.metadata.tokenCount
                ? ` | Tokens: ${analysis.metadata.tokenCount.toLocaleString()}`
                : ""}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Loading state */}
      {(loading || loadingExisting) && !analysis && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <svg
                className="animate-spin h-8 w-8 text-muted-foreground mb-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <p className="text-muted-foreground">
                {loading
                  ? "Running AI analysis. This may take 30-60 seconds..."
                  : "Loading existing analysis..."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading &&
        !loadingExisting &&
        !analysis &&
        selectedSnapshotId && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <svg
                  className="w-12 h-12 text-muted-foreground mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <p className="text-lg font-medium text-foreground">
                  No analysis yet
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click &quot;Run Analysis&quot; to generate AI-powered insights
                  for this snapshot.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

      {/* No snapshot selected */}
      {!selectedSnapshotId && !loading && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <p className="text-muted-foreground">
                Select a data snapshot above to view or generate AI insights.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {analysis && (
        <div className="space-y-6">
          {/* Key Findings */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Key Findings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.keyFindings.map(
                (finding: KeyFinding, index: number) => (
                  <Card key={index} className="relative">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">
                          {finding.title}
                        </CardTitle>
                        <div className="flex gap-1.5 shrink-0">
                          <Badge
                            variant="outline"
                            className={severityColors[finding.severity]}
                          >
                            {finding.severity}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {categoryLabels[finding.category] ||
                              finding.category}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {finding.description}
                      </p>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          </div>

          {/* Root Cause Patterns */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Root Cause Patterns</h2>
            <div className="space-y-3">
              {analysis.rootCausePatterns.map(
                (pattern: RootCausePattern, index: number) => (
                  <Card key={index}>
                    <CardHeader
                      className="cursor-pointer pb-2"
                      onClick={() => togglePattern(index)}
                    >
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          {pattern.pattern}
                        </CardTitle>
                        <svg
                          className={`w-5 h-5 text-muted-foreground transition-transform ${
                            expandedPatterns.has(index) ? "rotate-180" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </CardHeader>
                    {expandedPatterns.has(index) && (
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                              Description
                            </p>
                            <p className="text-sm">{pattern.description}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                              Affected Area
                            </p>
                            <p className="text-sm">{pattern.affectedArea}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                              Suggested Action
                            </p>
                            <p className="text-sm">{pattern.suggestedAction}</p>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                )
              )}
            </div>
          </div>

          {/* Process Recommendations */}
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Process Recommendations
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.processRecommendations.map(
                (rec: ProcessRecommendation, index: number) => (
                  <Card key={index}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{rec.title}</CardTitle>
                        <div className="flex gap-1.5 shrink-0">
                          <Badge
                            variant="outline"
                            className={impactColors[rec.impact]}
                          >
                            Impact: {rec.impact}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={effortColors[rec.effort]}
                          >
                            Effort: {rec.effort}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {rec.description}
                      </p>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          </div>

          {/* Tracking Recommendations */}
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Tracking Recommendations
            </h2>
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Field</TableHead>
                      <TableHead>Current Issue</TableHead>
                      <TableHead>Suggestion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.trackingRecommendations.map(
                      (rec: TrackingRecommendation, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {rec.field}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {rec.currentIssue}
                          </TableCell>
                          <TableCell>{rec.suggestion}</TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
