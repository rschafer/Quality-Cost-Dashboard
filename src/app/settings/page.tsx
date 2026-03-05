"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const DEFAULT_COLUMN_MAPPINGS: Record<string, string> = {
  jiraKey: "Issue key",
  summary: "Summary",
  description: "Description",
  status: "Status",
  resolution: "Resolution",
  priority: "Priority",
  issueType: "Issue Type",
  module: "Module",
  productCategory: "Product Category",
  rootCause: "Root Cause",
  assignee: "Assignee",
  reporter: "Reporter",
  labels: "Labels",
  components: "Component/s",
  storyPoints: "Story Points",
  timeEstimateHours: "Original Estimate",
  timeSpentHours: "Time Spent",
  createdAt: "Created",
  resolvedAt: "Resolved",
  updatedAt: "Updated",
};

export default function SettingsPage() {
  const [jiraBaseUrl, setJiraBaseUrl] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraApiToken, setJiraApiToken] = useState("");
  const [hourlyRate, setHourlyRate] = useState("67");
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>(
    { ...DEFAULT_COLUMN_MAPPINGS }
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data: Record<string, string>) => {
        if (data.jiraBaseUrl) setJiraBaseUrl(data.jiraBaseUrl);
        if (data.jiraEmail) setJiraEmail(data.jiraEmail);
        if (data.jiraApiToken) setJiraApiToken(data.jiraApiToken);
        if (data.hourlyRate) setHourlyRate(data.hourlyRate);
        // Load any saved column mappings
        for (const key of Object.keys(DEFAULT_COLUMN_MAPPINGS)) {
          const settingKey = `columnMapping_${key}`;
          if (data[settingKey]) {
            setColumnMappings((prev) => ({
              ...prev,
              [key]: data[settingKey],
            }));
          }
        }
      })
      .catch(() => {
        // Settings may not exist yet, use defaults
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const settings: Record<string, string> = {
        jiraBaseUrl,
        jiraEmail,
        jiraApiToken,
        hourlyRate,
      };

      // Include column mappings
      for (const [key, value] of Object.entries(columnMappings)) {
        settings[`columnMapping_${key}`] = value;
      }

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        throw new Error("Failed to save settings");
      }

      setMessage({ type: "success", text: "Settings saved successfully" });
    } catch {
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setMessage(null);

    try {
      // Save first, then test
      await handleSave();

      const res = await fetch("/api/import/jira", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error || "Connection test failed",
        });
      } else {
        setMessage({ type: "success", text: "Connection successful" });
      }
    } catch {
      setMessage({ type: "error", text: "Connection test failed" });
    } finally {
      setTesting(false);
    }
  }

  const yearlySalary = Math.round(parseFloat(hourlyRate || "0") * 2080);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      {message && (
        <div
          className={`p-4 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Jira Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Base URL</label>
            <Input
              placeholder="https://your-domain.atlassian.net"
              value={jiraBaseUrl}
              onChange={(e) => setJiraBaseUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              placeholder="your-email@company.com"
              value={jiraEmail}
              onChange={(e) => setJiraEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">API Token</label>
            <Input
              type="password"
              placeholder="Enter your Jira API token"
              value={jiraApiToken}
              onChange={(e) => setJiraApiToken(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? "Testing..." : "Test Connection"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Hourly Rate (USD)
            </label>
            <div className="flex items-center gap-4">
              <div className="relative w-40">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  className="pl-7"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  min="1"
                  step="1"
                />
              </div>
              <span className="text-sm text-muted-foreground">
                Yearly salary equivalent:{" "}
                {yearlySalary.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Default: $67/hr based on US national average software engineer
              salary (~$140K/yr)
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Default Column Mapping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure how CSV column headers map to bug fields. These defaults
            are used when importing CSV files.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(columnMappings).map(([field, header]) => (
              <div key={field} className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">
                  {field}
                </label>
                <Input
                  value={header}
                  onChange={(e) =>
                    setColumnMappings((prev) => ({
                      ...prev,
                      [field]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Column Mappings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
