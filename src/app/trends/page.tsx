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
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import TrendLineChart from "@/components/charts/TrendLineChart";
import type { SnapshotData } from "@/types/bug";
import type { TrendComparison } from "@/types/analysis";

interface TrendResult {
  trends: TrendComparison[];
  hotspots: {
    growing: TrendComparison[];
    shrinking: TrendComparison[];
  };
}

const FIELD_OPTIONS = [
  { value: "productCategory", label: "Product Category" },
  { value: "module", label: "Module" },
  { value: "resolution", label: "Resolution" },
] as const;

export default function TrendsPage() {
  const [snapshots, setSnapshots] = useState<SnapshotData[]>([]);
  const [snapshotId1, setSnapshotId1] = useState("");
  const [snapshotId2, setSnapshotId2] = useState("");
  const [field, setField] = useState<string>("productCategory");
  const [result, setResult] = useState<TrendResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/snapshots")
      .then((res) => res.json())
      .then((data: SnapshotData[]) => setSnapshots(data))
      .catch(() => setError("Failed to load snapshots"));
  }, []);

  async function handleCompare() {
    if (!snapshotId1 || !snapshotId2) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(
        `/api/analysis/trends?snapshotId1=${snapshotId1}&snapshotId2=${snapshotId2}&field=${field}`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch trends");
      }
      const data: TrendResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  if (snapshots.length < 2) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Trend Analysis</h1>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-lg text-muted-foreground">
              Import at least 2 snapshots to compare trends
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Trend Analysis</h1>

      <Card>
        <CardHeader>
          <CardTitle>Compare Snapshots</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Previous Period
              </label>
              <Select value={snapshotId1} onValueChange={setSnapshotId1}>
                <SelectTrigger>
                  <SelectValue placeholder="Select snapshot" />
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Current Period
              </label>
              <Select value={snapshotId2} onValueChange={setSnapshotId2}>
                <SelectTrigger>
                  <SelectValue placeholder="Select snapshot" />
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Compare By
              </label>
              <Select value={field} onValueChange={setField}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Button
              onClick={handleCompare}
              disabled={!snapshotId1 || !snapshotId2 || loading}
            >
              {loading ? "Comparing..." : "Compare"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Trend Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendLineChart data={result.trends} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detailed Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Previous %</TableHead>
                    <TableHead className="text-right">Current %</TableHead>
                    <TableHead className="text-right">Delta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.trends.map((trend) => (
                    <TableRow key={trend.category}>
                      <TableCell className="font-medium">
                        {trend.category}
                      </TableCell>
                      <TableCell className="text-right">
                        {trend.previousPercent}%
                      </TableCell>
                      <TableCell className="text-right">
                        {trend.currentPercent}%
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            trend.delta > 0
                              ? "text-red-600 font-medium"
                              : trend.delta < 0
                                ? "text-green-600 font-medium"
                                : "text-muted-foreground"
                          }
                        >
                          {trend.delta > 0 ? "+" : ""}
                          {trend.delta}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">
                  Growing Hotspots
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.hotspots.growing.length === 0 ? (
                  <p className="text-muted-foreground">
                    No significant growth detected
                  </p>
                ) : (
                  <div className="space-y-3">
                    {result.hotspots.growing.map((item) => (
                      <div
                        key={item.category}
                        className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                      >
                        <span className="font-medium">{item.category}</span>
                        <Badge variant="destructive">
                          +{item.delta}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">
                  Shrinking Areas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.hotspots.shrinking.length === 0 ? (
                  <p className="text-muted-foreground">
                    No significant shrinkage detected
                  </p>
                ) : (
                  <div className="space-y-3">
                    {result.hotspots.shrinking.map((item) => (
                      <div
                        key={item.category}
                        className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100"
                      >
                        <span className="font-medium">{item.category}</span>
                        <Badge className="bg-green-600 hover:bg-green-700">
                          {item.delta}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
