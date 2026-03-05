"use client";

import { useState, useEffect } from "react";
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
import CostBreakdownChart from "@/components/charts/CostBreakdownChart";
import StatCard from "@/components/dashboard/StatCard";
import type { SnapshotData, CostEstimate, CostBreakdown } from "@/types/bug";

interface CostResult {
  costs: CostEstimate[];
  breakdowns: {
    byModule: CostBreakdown[];
    byCategory: CostBreakdown[];
    byResolution: CostBreakdown[];
  };
  summary: {
    totalCost: number;
    avgCost: number;
    highConfidenceCount: number;
    mediumConfidenceCount: number;
    lowConfidenceCount: number;
  };
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function confidenceVariant(
  confidence: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (confidence) {
    case "high":
      return "default";
    case "medium":
      return "secondary";
    case "low":
      return "outline";
    default:
      return "outline";
  }
}

export default function CostsPage() {
  const [snapshots, setSnapshots] = useState<SnapshotData[]>([]);
  const [snapshotId, setSnapshotId] = useState("");
  const [result, setResult] = useState<CostResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costView, setCostView] = useState<"module" | "category">("module");

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

    fetch(`/api/analysis/costs?snapshotId=${snapshotId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to fetch cost data");
        }
        return res.json();
      })
      .then((data: CostResult) => setResult(data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "An error occurred")
      )
      .finally(() => setLoading(false));
  }, [snapshotId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Cost Estimation</h1>
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
            <p className="text-muted-foreground">Loading cost analysis...</p>
          </CardContent>
        </Card>
      )}

      {result && !loading && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Estimated Cost"
              value={formatCurrency(result.summary.totalCost)}
              subtitle={`${result.costs.length} bugs analyzed`}
            />
            <StatCard
              title="Average Cost / Bug"
              value={formatCurrency(result.summary.avgCost)}
              subtitle="Across all estimation methods"
            />
            <StatCard
              title="High Confidence"
              value={result.summary.highConfidenceCount}
              subtitle="Bugs with time tracking data"
            />
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">
                  Methodology
                </p>
                <p className="text-sm mt-2 text-muted-foreground">
                  Estimates use time tracking (high), story points (medium), or
                  priority-based heuristics (low) in order of confidence.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Cost Breakdown
                  </h3>
                  <div className="flex rounded-md border border-border overflow-hidden text-sm">
                    <button
                      onClick={() => setCostView("module")}
                      className={`px-3 py-1 transition-colors ${
                        costView === "module"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/40 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      By Module
                    </button>
                    <button
                      onClick={() => setCostView("category")}
                      className={`px-3 py-1 transition-colors ${
                        costView === "category"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/40 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      By Category
                    </button>
                  </div>
                </div>
                <CostBreakdownChart
                  data={
                    costView === "module"
                      ? result.breakdowns.byModule
                      : result.breakdowns.byCategory
                  }
                  title=""
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <CostBreakdownChart
                  data={result.breakdowns.byResolution}
                  title="Cost by Resolution Type"
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Bug Cost Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead className="text-right">Est. Hours</TableHead>
                    <TableHead className="text-right">Est. Cost</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.costs.map((cost) => (
                    <TableRow key={cost.bugId}>
                      <TableCell className="font-mono text-sm">
                        {cost.jiraKey || cost.bugId.slice(0, 8)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {cost.summary}
                      </TableCell>
                      <TableCell className="text-right">
                        {cost.estimatedHours}h
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(cost.estimatedCost)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {cost.methodology.replace("_", " ")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={confidenceVariant(cost.confidence)}>
                          {cost.confidence}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground text-center">
            Cost estimates based on $67/hr (US national avg software engineer
            salary ~$140K/yr)
          </p>
        </>
      )}
    </div>
  );
}
