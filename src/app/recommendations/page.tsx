"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SnapshotData } from "@/types/bug";
import type {
  AIAnalysisResult,
  ProcessRecommendation,
} from "@/types/analysis";

function impactVariant(
  level: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (level) {
    case "high":
      return "destructive";
    case "medium":
      return "default";
    case "low":
      return "secondary";
    default:
      return "outline";
  }
}

function effortVariant(
  level: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (level) {
    case "low":
      return "default";
    case "medium":
      return "secondary";
    case "high":
      return "destructive";
    default:
      return "outline";
  }
}

export default function RecommendationsPage() {
  const [snapshots, setSnapshots] = useState<SnapshotData[]>([]);
  const [snapshotId, setSnapshotId] = useState("");
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noAnalysis, setNoAnalysis] = useState(false);

  useEffect(() => {
    fetch("/api/snapshots")
      .then((res) => res.json())
      .then((data: SnapshotData[]) => {
        setSnapshots(data);
        if (data.length > 0) {
          setSnapshotId(data[0].id);
        }
      })
      .catch(() => setError("Failed to load snapshots"));
  }, []);

  useEffect(() => {
    if (!snapshotId) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);
    setNoAnalysis(false);

    fetch(`/api/analysis/ai?snapshotId=${snapshotId}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNoAnalysis(true);
          return null;
        }
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to fetch analysis");
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setAnalysis(data as AIAnalysisResult);
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "An error occurred")
      )
      .finally(() => setLoading(false));
  }, [snapshotId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Recommendations</h1>
        <div className="w-72">
          <Select value={snapshotId} onValueChange={setSnapshotId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a snapshot" />
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
      </div>

      {error && (
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Loading recommendations...</p>
          </CardContent>
        </Card>
      )}

      {noAnalysis && !loading && (
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <p className="text-lg text-muted-foreground">
              No AI analysis found for this snapshot.
            </p>
            <p className="text-sm text-muted-foreground">
              Run an AI analysis first to generate recommendations.
            </p>
            <Link href="/insights">
              <Button>Go to AI Insights</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {analysis && !loading && (
        <>
          {analysis.processRecommendations &&
            analysis.processRecommendations.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">
                  Process Recommendations
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.processRecommendations.map(
                    (rec: ProcessRecommendation, index: number) => (
                      <Card key={index}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base">
                              {rec.title}
                            </CardTitle>
                            <div className="flex gap-1.5 shrink-0">
                              <Badge variant={impactVariant(rec.impact)}>
                                Impact: {rec.impact}
                              </Badge>
                              <Badge variant={effortVariant(rec.effort)}>
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
            )}

          {analysis.trackingRecommendations &&
            analysis.trackingRecommendations.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">
                  Tracking Recommendations
                </h2>
                <Card>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Field</TableHead>
                          <TableHead>Current Issue</TableHead>
                          <TableHead>Suggestion</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysis.trackingRecommendations.map(
                          (rec, index: number) => (
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
            )}

          {(!analysis.processRecommendations ||
            analysis.processRecommendations.length === 0) &&
            (!analysis.trackingRecommendations ||
              analysis.trackingRecommendations.length === 0) && (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">
                    No recommendations available in this analysis. Try running a
                    new AI analysis.
                  </p>
                </CardContent>
              </Card>
            )}
        </>
      )}
    </div>
  );
}
