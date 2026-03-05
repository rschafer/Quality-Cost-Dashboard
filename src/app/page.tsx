"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Papa from "papaparse";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DEFAULT_COLUMN_MAPPING, parseCSVFile } from "@/lib/csv-parser";
import { computeStats } from "@/lib/stats";
import { DEFAULT_HOURLY_RATE } from "@/lib/cost-calculator";
import { generateDashboardSuggestions } from "@/lib/suggestions";
import type { Suggestion, CategoryDetail } from "@/lib/suggestions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import SwitchableChart from "@/components/charts/SwitchableChart";

// Types for dashboard data
interface FilterOptions {
  priorities: string[];
  resolutions: string[];
  modules: string[];
  categories: string[];
}

interface Filters {
  dateFrom: string;
  dateTo: string;
  priority: string[];
  resolution: string[];
  module: string[];
  category: string[];
}

const EMPTY_FILTERS: Filters = {
  dateFrom: "",
  dateTo: "",
  priority: [],
  resolution: [],
  module: [],
  category: [],
};

interface DashboardStats {
  totalBugs: number;
  dateRange: string;
  totalEstimatedCost: number;
  noiseCost: number;
  noiseCount: number;
  noisePercent: number;
  codeChangePercent: number;
  avgResolutionDays: number;
  medianResolutionDays: number;
  criticalCount: number;
  highCount: number;
  resolutionBreakdown: Record<string, { count: number; percent: number }>;
  moduleDistribution: Record<string, { count: number; percent: number }>;
  costByCategory: Array<{ name: string; cost: number; count: number }>;
  costByModule: Array<{ name: string; cost: number; count: number }>;
  assigneeBreakdown: Record<string, { count: number; percent: number }>;
  filterOptions?: FilterOptions;
}

interface UploadedFile {
  file: File;
  team: string;
  preview: string[][];
  headers: string[];
}

function fmt(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function HomePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryDetail, setCategoryDetail] = useState<CategoryDetail | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [costBreakdownView, setCostBreakdownView] = useState<"category" | "module" | "resolution" | "moduleDist">("category");
  const [hourlyRate, setHourlyRate] = useState(DEFAULT_HOURLY_RATE);
  const [rateInput, setRateInput] = useState(String(DEFAULT_HOURLY_RATE));
  const [editingRate, setEditingRate] = useState(false);
  const [mockBugs, setMockBugs] = useState<Parameters<typeof computeStats>[0] | null>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles).filter(
      (f) => f.name.endsWith(".csv") || f.name.endsWith(".json")
    );
    for (const f of fileArray) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (!content) return;
        let headers: string[] = [];
        let preview: string[][] = [];
        if (f.name.endsWith(".csv")) {
          const result = Papa.parse(content, { header: false, skipEmptyLines: true, preview: 4 });
          const rows = result.data as string[][];
          if (rows.length > 0) {
            headers = rows[0];
            preview = rows.slice(1, 4);
          }
        }
        setFiles((prev) => [
          ...prev,
          { file: f, team: "", preview, headers },
        ]);
      };
      reader.readAsText(f);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateTeam = useCallback((index: number, team: string) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, team } : f))
    );
  }, []);

  const handleImport = useCallback(async () => {
    if (files.length === 0) return;
    setImporting(true);
    setError("");

    try {
      // Upload each file
      const results = [];
      for (const { file, team } of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", team ? `${team} - ${file.name}` : file.name);
        formData.append("mapping", JSON.stringify(DEFAULT_COLUMN_MAPPING));
        const res = await fetch("/api/import/csv", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Import failed");
        results.push(data);
      }

      // Use the last snapshot to fetch stats
      const lastSnapshot = results[results.length - 1].snapshot;
      setSnapshotId(lastSnapshot.id);

      // Fetch combined stats
      const statsRes = await fetch(`/api/analysis/summary?snapshotId=${lastSnapshot.id}`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [files]);

  const handleReset = useCallback(() => {
    setStats(null);
    setSnapshotId(null);
    setFiles([]);
    setError("");
  }, []);

  const fetchWithFilters = useCallback(async (f: Filters, rate?: number) => {
    if (!snapshotId) return;
    setFilterLoading(true);
    try {
      const params = new URLSearchParams({ snapshotId });
      params.set("hourlyRate", String(rate ?? hourlyRate));
      if (f.dateFrom) params.set("dateFrom", f.dateFrom);
      if (f.dateTo) params.set("dateTo", f.dateTo);
      if (f.priority.length) params.set("priority", f.priority.join(","));
      if (f.resolution.length) params.set("resolution", f.resolution.join(","));
      if (f.module.length) params.set("module", f.module.join(","));
      if (f.category.length) params.set("category", f.category.join(","));
      const res = await fetch(`/api/analysis/summary?${params}`);
      if (res.ok) setStats(await res.json());
    } finally {
      setFilterLoading(false);
    }
  }, [snapshotId, hourlyRate]);

  const applyFilters = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
    fetchWithFilters(newFilters);
  }, [fetchWithFilters]);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    fetchWithFilters(EMPTY_FILTERS);
  }, [fetchWithFilters]);

  const hasActiveFilters = !!(filters.dateFrom || filters.dateTo || filters.priority.length || filters.resolution.length || filters.module.length || filters.category.length);

  const handleCategoryClick = useCallback(async (categoryName: string) => {
    if (!snapshotId) return;
    setSelectedCategory(categoryName);
    setCategoryLoading(true);
    setCategoryDetail(null);
    try {
      const res = await fetch(
        `/api/analysis/category-detail?snapshotId=${snapshotId}&category=${encodeURIComponent(categoryName)}`
      );
      if (res.ok) {
        setCategoryDetail(await res.json());
      }
    } catch {
      // silently fail, dialog will show loading state
    } finally {
      setCategoryLoading(false);
    }
  }, [snapshotId]);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!stats) return [];
    return generateDashboardSuggestions(stats as Parameters<typeof generateDashboardSuggestions>[0]);
  }, [stats]);

  const [loadingPreview, setLoadingPreview] = useState(false);

  const handlePreviewMockData = useCallback(async () => {
    setLoadingPreview(true);
    setError("");
    try {
      const res = await fetch("/sample-data.csv");
      const csvText = await res.text();
      const { bugs: parsedBugs } = parseCSVFile(csvText, DEFAULT_COLUMN_MAPPING);

      if (parsedBugs.length === 0) throw new Error("No bugs found in sample data");

      // Convert parsed bugs to BugLike objects for stats computation
      const bugs = parsedBugs.map((b, i) => ({
        id: b.jiraKey || `mock-${i}`,
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

      setMockBugs(bugs);
      const computed = computeStats(bugs, hourlyRate);
      const filterOptions = {
        priorities: [...new Set(bugs.map((b) => b.priority).filter(Boolean) as string[])].sort(),
        resolutions: [...new Set(bugs.map((b) => b.resolution).filter(Boolean) as string[])].sort(),
        modules: [...new Set(bugs.map((b) => b.module).filter(Boolean) as string[])].sort(),
        categories: [...new Set(bugs.map((b) => b.productCategory).filter(Boolean) as string[])].sort(),
      };

      setStats({ ...computed, filterOptions } as DashboardStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load mock data");
    } finally {
      setLoadingPreview(false);
    }
  }, [hourlyRate]);

  const commitRate = useCallback(() => {
    const parsed = parseFloat(rateInput);
    if (!parsed || parsed <= 0 || parsed === hourlyRate) {
      setRateInput(String(hourlyRate));
      setEditingRate(false);
      return;
    }
    setHourlyRate(parsed);
    setEditingRate(false);
    // Recalculate: mock data path (client-side) or API path
    if (mockBugs) {
      const computed = computeStats(mockBugs, parsed);
      setStats((prev) => prev ? { ...computed, filterOptions: prev.filterOptions } as DashboardStats : null);
    } else if (snapshotId) {
      fetchWithFilters(filters, parsed);
    }
  }, [rateInput, hourlyRate, mockBugs, snapshotId, fetchWithFilters, filters]);

  // ── DASHBOARD VIEW ──
  if (stats) {
    const resolutionData = Object.entries(stats.resolutionBreakdown).map(
      ([name, { count, percent }]) => ({ name, count, percent })
    );
    const moduleData = Object.entries(stats.moduleDistribution).map(
      ([name, { count, percent }]) => ({ name, count, percent })
    );

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Bug Analysis</h2>
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="flex items-center gap-1.5 text-sm text-foreground mt-1 hover:text-primary transition-colors group"
            >
              <span className={hasActiveFilters ? "underline decoration-primary underline-offset-2" : ""}>
                {stats.dateRange} &middot; {stats.totalBugs} tickets
              </span>
              <svg className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
              {filterLoading && <span className="text-xs text-muted-foreground">Updating...</span>}
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            Upload New Data
          </Button>
        </div>

        {/* Filter bar */}
        {filtersOpen && (
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Date range */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">From</label>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">To</label>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Priority</label>
                  <div className="flex flex-wrap gap-1">
                    {(stats.filterOptions?.priorities || []).map((p) => (
                      <button
                        key={p}
                        onClick={() =>
                          setFilters((f) => ({
                            ...f,
                            priority: f.priority.includes(p)
                              ? f.priority.filter((x) => x !== p)
                              : [...f.priority, p],
                          }))
                        }
                        className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                          filters.priority.includes(p)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:bg-accent"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resolution */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Resolution</label>
                  <div className="flex flex-wrap gap-1">
                    {(stats.filterOptions?.resolutions || []).map((r) => (
                      <button
                        key={r}
                        onClick={() =>
                          setFilters((f) => ({
                            ...f,
                            resolution: f.resolution.includes(r)
                              ? f.resolution.filter((x) => x !== r)
                              : [...f.resolution, r],
                          }))
                        }
                        className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                          filters.resolution.includes(r)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:bg-accent"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Module */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Module</label>
                  <div className="flex flex-wrap gap-1">
                    {(stats.filterOptions?.modules || []).map((m) => (
                      <button
                        key={m}
                        onClick={() =>
                          setFilters((f) => ({
                            ...f,
                            module: f.module.includes(m)
                              ? f.module.filter((x) => x !== m)
                              : [...f.module, m],
                          }))
                        }
                        className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                          filters.module.includes(m)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:bg-accent"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Category</label>
                  <div className="flex flex-wrap gap-1">
                    {(stats.filterOptions?.categories || []).map((c) => (
                      <button
                        key={c}
                        onClick={() =>
                          setFilters((f) => ({
                            ...f,
                            category: f.category.includes(c)
                              ? f.category.filter((x) => x !== c)
                              : [...f.category, c],
                          }))
                        }
                        className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                          filters.category.includes(c)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:bg-accent"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-3 pt-3 border-t">
                <Button size="sm" onClick={() => applyFilters(filters)} disabled={filterLoading}>
                  {filterLoading ? "Applying..." : "Apply Filters"}
                </Button>
                {hasActiveFilters && (
                  <Button size="sm" variant="ghost" onClick={clearFilters}>
                    Clear All
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <TooltipProvider>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help">
                <CardContent className="p-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Total Bug Cost
                    <svg className="w-3.5 h-3.5 inline-block ml-1 -mt-0.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /><path strokeLinecap="round" strokeWidth={2} d="M12 16v-4m0-4h.01" /></svg>
                  </p>
                  <p className="text-2xl font-bold mt-1 font-mono">{fmt(stats.totalEstimatedCost)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.totalBugs} tickets @{" "}
                    {editingRate ? (
                      <span className="inline-flex items-center">
                        $<input
                          type="number"
                          className="w-14 px-1 py-0 border rounded text-xs font-mono bg-background"
                          value={rateInput}
                          onChange={(e) => setRateInput(e.target.value)}
                          onBlur={commitRate}
                          onKeyDown={(e) => { if (e.key === "Enter") commitRate(); if (e.key === "Escape") { setRateInput(String(hourlyRate)); setEditingRate(false); } }}
                          autoFocus
                          min="1"
                          step="1"
                        />/hr
                      </span>
                    ) : (
                      <button
                        className="underline decoration-dashed underline-offset-2 hover:text-foreground transition-colors cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); setRateInput(String(hourlyRate)); setEditingRate(true); }}
                      >
                        ${hourlyRate}/hr
                      </button>
                    )}
                  </p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-left leading-relaxed">
              <p className="font-semibold mb-1">How cost is calculated</p>
              <p>Each bug&apos;s cost = estimated hours × ${hourlyRate}/hr (${Math.round(hourlyRate * 2080).toLocaleString()}/yr engineer).</p>
              <p className="mt-1">Hours are derived from (in priority order):</p>
              <ol className="list-decimal list-inside mt-0.5 space-y-0.5">
                <li>Actual time spent (if logged)</li>
                <li>Original time estimate</li>
                <li>Story points × 4 hrs</li>
                <li>Priority fallback: Critical 16h, High 8h, Medium 4h, Low 2h</li>
              </ol>
            </TooltipContent>
          </Tooltip>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Wasted on Noise</p>
              <p className="text-2xl font-bold mt-1 font-mono text-amber-600">{fmt(stats.noiseCost)}</p>
              <p className="text-xs text-muted-foreground mt-1">{stats.noiseCount} tickets ({stats.noisePercent}%)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Resolution</p>
              <p className="text-2xl font-bold mt-1 font-mono">{stats.avgResolutionDays}d</p>
              <p className="text-xs text-muted-foreground mt-1">Median: {stats.medianResolutionDays}d</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Critical + High</p>
              <p className="text-2xl font-bold mt-1 font-mono text-red-600">{stats.criticalCount + stats.highCount}</p>
              <p className="text-xs text-muted-foreground mt-1">{stats.criticalCount} critical, {stats.highCount} high</p>
            </CardContent>
          </Card>
        </div>
        </TooltipProvider>

        {/* Unified breakdown — category cost, module cost, resolution types, module distribution */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Data Breakdown</CardTitle>
                <CardDescription className="text-xs">
                  {costBreakdownView === "category" && "Cost by category. Click a category for details."}
                  {costBreakdownView === "module" && "Cost by module."}
                  {costBreakdownView === "resolution" && "Bug count by resolution type."}
                  {costBreakdownView === "moduleDist" && "Bug count by module."}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <div className="flex rounded-md border border-border overflow-hidden text-xs">
                  {([
                    { key: "category", label: "Cost: Category" },
                    { key: "module", label: "Cost: Module" },
                    { key: "resolution", label: "Resolutions" },
                    { key: "moduleDist", label: "Modules" },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setCostBreakdownView(key)}
                      className={`px-2.5 py-1 transition-colors ${
                        costBreakdownView === key
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/40 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(costBreakdownView === "resolution" || costBreakdownView === "moduleDist") ? (
              <SwitchableChart
                data={costBreakdownView === "resolution" ? resolutionData : moduleData}
                colors={costBreakdownView === "moduleDist" ? ["#7c3aed", "#14b8a6", "#3b82f6", "#f97316", "#ec4899", "#84cc16"] : undefined}
              />
            ) : (() => {
              const items = costBreakdownView === "category" ? stats.costByCategory : stats.costByModule;
              const maxCost = items.length > 0 ? items[0].cost : 1;
              const isCat = costBreakdownView === "category";
              const barColors = isCat ? ["#dc2626", "#ea580c", "#d97706"] : ["#7c3aed", "#14b8a6", "#3b82f6"];
              const defaultColor = isCat ? "#3b82f6" : "#6b7280";

              return (
                <div className="space-y-1.5">
                  {items.map((item, i) => {
                    const pct = maxCost > 0 ? (item.cost / maxCost) * 100 : 0;
                    return isCat ? (
                      <button
                        key={item.name}
                        onClick={() => handleCategoryClick(item.name)}
                        className="group flex items-center gap-2 text-sm w-full text-left hover:bg-accent/50 rounded p-0.5 -m-0.5 transition-colors cursor-pointer"
                      >
                        <span className="w-28 text-right truncate text-xs font-medium text-primary underline underline-offset-2 decoration-primary/40 group-hover:decoration-primary flex items-center justify-end gap-1">
                          {item.name}
                          <svg className="w-3 h-3 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </span>
                        <div className="flex-1 h-6 rounded overflow-hidden relative">
                          <div className="h-full rounded" style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: i < 3 ? barColors[i] : defaultColor }} />
                          <span className="absolute inset-0 flex items-center px-2 text-xs">{fmt(item.cost)} &middot; {item.count} bugs</span>
                        </div>
                      </button>
                    ) : (
                      <div key={item.name} className="flex items-center gap-2 text-sm p-0.5">
                        <span className="w-28 text-right truncate text-xs font-medium">{item.name}</span>
                        <div className="flex-1 h-6 rounded overflow-hidden relative">
                          <div className="h-full rounded" style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: i < 3 ? barColors[i] : defaultColor }} />
                          <span className="absolute inset-0 flex items-center px-2 text-xs">{fmt(item.cost)} &middot; {item.count} bugs</span>
                        </div>
                      </div>
                    );
                  })}
                  {isCat && stats.costByCategory.length >= 3 && (
                    <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      Fixing <strong>{stats.costByCategory.slice(0, 3).map(c => c.name).join(", ")}</strong> saves{" "}
                      <strong>{fmt(stats.costByCategory.slice(0, 3).reduce((s, c) => s + c.cost, 0))}</strong>{" "}
                      ({(stats.costByCategory.slice(0, 3).reduce((s, c) => s + c.cost, 0) / stats.totalEstimatedCost * 100).toFixed(0)}% of total).
                    </p>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Ticket Quality */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Ticket Quality</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full h-8 rounded-lg overflow-hidden flex text-xs font-medium">
              <div
                className="h-full bg-blue-600 flex items-center justify-center text-white"
                style={{ width: `${stats.codeChangePercent}%` }}
              >
                Code Changes {stats.codeChangePercent}%
              </div>
              <div
                className="h-full bg-gray-200 flex items-center justify-center text-gray-600"
                style={{ width: `${100 - stats.codeChangePercent}%` }}
              >
                Noise {(100 - stats.codeChangePercent).toFixed(1)}%
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Suggested Changes */}
        {suggestions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Suggested Changes</CardTitle>
                  <CardDescription className="text-xs">Data-driven recommendations to reduce bug cost and improve quality.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {suggestions.map((s, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <Badge
                      variant={s.impact === "high" ? "destructive" : s.impact === "medium" ? "default" : "secondary"}
                      className="mt-0.5 shrink-0 text-[10px] w-14 justify-center"
                    >
                      {s.impact}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category Detail Dialog */}
        <Dialog open={!!selectedCategory} onOpenChange={(open) => { if (!open) setSelectedCategory(null); }}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{selectedCategory}</DialogTitle>
              <DialogDescription>
                {categoryDetail
                  ? `${categoryDetail.count} bugs · ${fmt(categoryDetail.cost)} total cost`
                  : "Loading category details..."}
              </DialogDescription>
            </DialogHeader>

            {categoryLoading && (
              <div className="flex items-center justify-center py-8">
                <svg className="w-6 h-6 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}

            {categoryDetail && !categoryLoading && (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Priority breakdown */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Priority</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(categoryDetail.priorityBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([priority, count]) => (
                        <Badge key={priority} variant={
                          priority === "Critical" ? "destructive" : priority === "High" ? "default" : "secondary"
                        }>
                          {priority}: {count}
                        </Badge>
                      ))}
                  </div>
                </div>

                {/* Resolution breakdown */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Resolutions</p>
                  <div className="space-y-1">
                    {Object.entries(categoryDetail.resolutionBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([resolution, count]) => (
                        <div key={resolution} className="flex items-center justify-between text-sm">
                          <span>{resolution}</span>
                          <span className="text-muted-foreground text-xs">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Avg resolution */}
                {categoryDetail.avgResolutionDays > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Avg Resolution Time</p>
                    <p className="text-sm font-mono">{categoryDetail.avgResolutionDays} days</p>
                  </div>
                )}

                {/* Suggestions */}
                {categoryDetail.suggestions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Suggestions</p>
                    <div className="space-y-2">
                      {categoryDetail.suggestions.map((s, i) => (
                        <div key={i} className="bg-accent/50 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={s.impact === "high" ? "destructive" : s.impact === "medium" ? "default" : "secondary"}
                              className="text-[10px]"
                            >
                              {s.impact}
                            </Badge>
                            <p className="text-sm font-medium">{s.title}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sample bugs */}
                {categoryDetail.sampleSummaries.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Sample Bugs</p>
                    <ul className="space-y-1">
                      {categoryDetail.sampleSummaries.map((s, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-2">
                          <span className="shrink-0">&#8226;</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <DialogFooter showCloseButton />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── UPLOAD VIEW ──
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center pt-8">
        <h2 className="text-2xl font-bold">Upload Jira Exports</h2>
        <p className="text-muted-foreground mt-2">
          Drop one or more CSV files exported from Jira. Tag each with a team or product name.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400 bg-white"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          multiple
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
        <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <p className="text-sm font-medium">Drop CSV files here, or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">Upload multiple files at once</p>
      </div>

      {/* Preview with mock data */}
      <div className="text-center">
        <Button
          variant="outline"
          onClick={handlePreviewMockData}
          disabled={loadingPreview}
        >
          {loadingPreview ? "Loading..." : "Preview with mock data"}
        </Button>
        <p className="text-xs text-muted-foreground mt-1.5">
          See the dashboard in action with sample Jira data
        </p>
      </div>

      {/* File list with team tags */}
      {files.length > 0 && (
        <div className="space-y-3">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 bg-white border rounded-lg p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.file.name}</p>
                <p className="text-xs text-muted-foreground">{(f.file.size / 1024).toFixed(0)} KB</p>
              </div>
              <Input
                value={f.team}
                onChange={(e) => updateTeam(i, e.target.value)}
                placeholder="Team or product name"
                className="w-48 h-8 text-sm"
              />
              <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 p-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
          )}

          <Button onClick={handleImport} disabled={importing} className="w-full">
            {importing ? "Importing..." : `Import ${files.length} file${files.length > 1 ? "s" : ""}`}
          </Button>
        </div>
      )}
    </div>
  );
}
