"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEFAULT_COLUMN_MAPPING } from "@/lib/csv-parser";
import type { ColumnMapping, ImportResult } from "@/types/import";

type ImportStatus = "idle" | "uploading" | "success" | "error";

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [snapshotName, setSnapshotName] = useState(
    `Import - ${new Date().toLocaleDateString()}`
  );
  const [showMapping, setShowMapping] = useState(false);
  const [mapping, setMapping] = useState<ColumnMapping>({
    ...DEFAULT_COLUMN_MAPPING,
  });
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setImportStatus("idle");
    setImportResult(null);
    setErrorMessage("");

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      if (selectedFile.name.toLowerCase().endsWith(".csv")) {
        const result = Papa.parse<Record<string, string>>(content, {
          header: true,
          skipEmptyLines: true,
          preview: 5,
          transformHeader: (header: string) => header.trim(),
        });
        if (result.meta.fields) {
          setPreviewHeaders(result.meta.fields);
        }
        setPreviewRows(result.data);
      } else if (selectedFile.name.toLowerCase().endsWith(".json")) {
        try {
          const parsed = JSON.parse(content);
          const items: Record<string, unknown>[] = Array.isArray(parsed)
            ? parsed
            : parsed.issues || parsed.bugs || parsed.data || [];
          const preview = items.slice(0, 5);
          if (preview.length > 0) {
            const headers = Object.keys(preview[0]);
            setPreviewHeaders(headers);
            setPreviewRows(
              preview.map((item) => {
                const row: Record<string, string> = {};
                for (const key of headers) {
                  const val = item[key];
                  row[key] =
                    val === null || val === undefined
                      ? ""
                      : typeof val === "object"
                        ? JSON.stringify(val)
                        : String(val);
                }
                return row;
              })
            );
          }
        } catch {
          setErrorMessage("Could not parse JSON file for preview.");
        }
      }
    };
    reader.readAsText(selectedFile);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        processFile(selectedFile);
      }
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        const name = droppedFile.name.toLowerCase();
        if (name.endsWith(".csv") || name.endsWith(".json")) {
          processFile(droppedFile);
        } else {
          setErrorMessage("Please upload a .csv or .json file.");
        }
      }
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleMappingChange = useCallback(
    (field: string, value: string) => {
      setMapping((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleImport = useCallback(async () => {
    if (!file) return;

    setImportStatus("uploading");
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", snapshotName);
      formData.append("mapping", JSON.stringify(mapping));

      const response = await fetch("/api/import/csv", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setImportStatus("error");
        setErrorMessage(data.error || "Import failed");
        return;
      }

      setImportStatus("success");
      setImportResult(data as ImportResult);
    } catch {
      setImportStatus("error");
      setErrorMessage("Network error. Please try again.");
    }
  }, [file, snapshotName, mapping]);

  const resetForm = useCallback(() => {
    setFile(null);
    setPreviewHeaders([]);
    setPreviewRows([]);
    setImportStatus("idle");
    setImportResult(null);
    setErrorMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const mappingFields = [
    { key: "jiraKey", label: "Jira Key" },
    { key: "summary", label: "Summary" },
    { key: "description", label: "Description" },
    { key: "status", label: "Status" },
    { key: "resolution", label: "Resolution" },
    { key: "priority", label: "Priority" },
    { key: "issueType", label: "Issue Type" },
    { key: "module", label: "Module / Component" },
    { key: "productCategory", label: "Product Category" },
    { key: "rootCause", label: "Root Cause" },
    { key: "assignee", label: "Assignee" },
    { key: "reporter", label: "Reporter" },
    { key: "labels", label: "Labels" },
    { key: "components", label: "Components" },
    { key: "storyPoints", label: "Story Points" },
    { key: "timeEstimateHours", label: "Time Estimate (hours)" },
    { key: "timeSpentHours", label: "Time Spent (hours)" },
    { key: "createdAt", label: "Created Date" },
    { key: "resolvedAt", label: "Resolved Date" },
    { key: "updatedAt", label: "Updated Date" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Import Data</h1>

      <Tabs defaultValue="upload">
        <TabsList>
          <TabsTrigger value="upload">Upload File</TabsTrigger>
          <TabsTrigger value="jira">Connect Jira</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4 space-y-6">
          {/* Success State */}
          {importStatus === "success" && importResult && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-6 h-6 text-green-600 mt-0.5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-800 text-lg">
                      Import Successful
                    </h3>
                    <p className="text-green-700 mt-1">
                      Imported{" "}
                      <span className="font-bold">
                        {importResult.snapshot.bugCount}
                      </span>{" "}
                      bugs into snapshot &quot;{importResult.snapshot.name}&quot;.
                    </p>
                    {importResult.errors.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-yellow-700">
                          {importResult.errors.length} warning(s):
                        </p>
                        <ul className="text-sm text-yellow-600 mt-1 space-y-0.5 list-disc list-inside">
                          {importResult.errors.slice(0, 5).map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                          {importResult.errors.length > 5 && (
                            <li>
                              ...and {importResult.errors.length - 5} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                    <div className="mt-4 flex gap-3">
                      <Link href="/">
                        <Button>Go to Dashboard</Button>
                      </Link>
                      <Button variant="outline" onClick={resetForm}>
                        Import Another File
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error State */}
          {importStatus === "error" && errorMessage && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-6 h-6 text-red-600 mt-0.5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-red-800">
                      Import Failed
                    </h3>
                    <p className="text-red-700 mt-1">{errorMessage}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upload Area */}
          {importStatus !== "success" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Upload File</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Drag and drop zone */}
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : file
                          ? "border-green-300 bg-green-50"
                          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.json"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    {file ? (
                      <div>
                        <svg
                          className="w-10 h-10 text-green-500 mx-auto mb-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Click or drag to replace
                        </p>
                      </div>
                    ) : (
                      <div>
                        <svg
                          className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                          />
                        </svg>
                        <p className="text-sm font-medium">
                          Drag and drop your file here, or click to browse
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Supports .csv and .json files
                        </p>
                        <a
                          href="/sample-data.csv"
                          download="sample-data.csv"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-block mt-3 text-xs text-primary hover:underline"
                        >
                          Download sample CSV
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Snapshot name */}
                  <div>
                    <label className="text-sm font-medium block mb-1.5">
                      Snapshot Name
                    </label>
                    <Input
                      value={snapshotName}
                      onChange={(e) => setSnapshotName(e.target.value)}
                      placeholder="Enter a name for this import"
                    />
                  </div>

                  {/* Column mapping toggle */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowMapping(!showMapping)}
                      className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${showMapping ? "rotate-90" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      Show Column Mapping
                    </button>

                    {showMapping && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-muted/50 rounded-lg">
                        {mappingFields.map(({ key, label }) => (
                          <div key={key} className="flex items-center gap-2">
                            <label className="text-xs font-medium w-40 shrink-0 text-right text-muted-foreground">
                              {label}
                            </label>
                            <Input
                              value={mapping[key] || ""}
                              onChange={(e) =>
                                handleMappingChange(key, e.target.value)
                              }
                              className="h-8 text-xs"
                              placeholder="CSV column name"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Preview Table */}
              {previewRows.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Preview
                      <Badge variant="secondary">
                        First {previewRows.length} rows
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {previewHeaders.map((header) => (
                              <TableHead
                                key={header}
                                className="whitespace-nowrap text-xs"
                              >
                                {header}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewRows.map((row, i) => (
                            <TableRow key={i}>
                              {previewHeaders.map((header) => (
                                <TableCell
                                  key={header}
                                  className="text-xs max-w-[200px] truncate"
                                >
                                  {row[header] || ""}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Import Button */}
              <div className="flex gap-3">
                <Button
                  onClick={handleImport}
                  disabled={!file || importStatus === "uploading"}
                  className="min-w-[120px]"
                >
                  {importStatus === "uploading" ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
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
                      Importing...
                    </span>
                  ) : (
                    "Import"
                  )}
                </Button>
                {file && (
                  <Button variant="outline" onClick={resetForm}>
                    Clear
                  </Button>
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="jira" className="mt-4">
          <Card>
            <CardContent className="p-12 text-center">
              <svg
                className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              <h3 className="text-lg font-semibold text-muted-foreground">
                Jira Integration
              </h3>
              <p className="text-muted-foreground mt-2">
                Coming soon. Direct Jira API integration will allow you to pull
                bug data automatically.
              </p>
              <Badge variant="secondary" className="mt-4">
                Planned
              </Badge>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
