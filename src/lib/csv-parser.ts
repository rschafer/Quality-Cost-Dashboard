import Papa from "papaparse";

export type ColumnMapping = Record<string, string>;

export interface ParsedBug {
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
  customFields: string | null;
}

export const DEFAULT_COLUMN_MAPPING: ColumnMapping = {
  jiraKey: "Key",
  summary: "Summary",
  description: "Description",
  status: "Status",
  resolution: "Resolution",
  priority: "Priority",
  issueType: "Issue Type",
  module: "Component",
  productCategory: "Labels",
  rootCause: "Root Cause",
  assignee: "Assignee",
  reporter: "Reporter",
  labels: "Labels",
  components: "Components",
  storyPoints: "Story Points",
  timeEstimateHours: "Time Estimate",
  timeSpentHours: "Time Spent",
  createdAt: "Created",
  resolvedAt: "Resolved",
  updatedAt: "Updated",
};

const NUMERIC_FIELDS = new Set([
  "storyPoints",
  "timeEstimateHours",
  "timeSpentHours",
]);

const DATE_FIELDS = new Set(["createdAt", "resolvedAt", "updatedAt"]);

const REQUIRED_FIELDS = new Set(["summary", "status"]);

function getField(
  row: Record<string, string>,
  internalField: string,
  mapping: ColumnMapping
): string | undefined {
  const csvColumn = mapping[internalField];
  if (!csvColumn) return undefined;

  // Try exact match first
  if (row[csvColumn] !== undefined) return row[csvColumn];

  // Try case-insensitive match
  const lowerCol = csvColumn.toLowerCase();
  for (const key of Object.keys(row)) {
    if (key.toLowerCase() === lowerCol) return row[key];
  }

  return undefined;
}

function parseNumeric(value: string | undefined): number | null {
  if (!value || value.trim() === "") return null;
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseDate(value: string | undefined): string | null {
  if (!value || value.trim() === "") return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

function rowToParsedBug(
  row: Record<string, string>,
  mapping: ColumnMapping
): ParsedBug | null {
  const summary = getField(row, "summary", mapping)?.trim();
  const status = getField(row, "status", mapping)?.trim();

  if (!summary || !status) return null;

  const createdAtRaw = getField(row, "createdAt", mapping);
  const createdAt = parseDate(createdAtRaw) || new Date().toISOString();

  return {
    jiraKey: getField(row, "jiraKey", mapping)?.trim() || null,
    summary,
    description: getField(row, "description", mapping)?.trim() || null,
    status,
    resolution: getField(row, "resolution", mapping)?.trim() || null,
    priority: getField(row, "priority", mapping)?.trim() || null,
    issueType: getField(row, "issueType", mapping)?.trim() || null,
    module: getField(row, "module", mapping)?.trim() || null,
    productCategory: getField(row, "productCategory", mapping)?.trim() || null,
    rootCause: getField(row, "rootCause", mapping)?.trim() || null,
    assignee: getField(row, "assignee", mapping)?.trim() || null,
    reporter: getField(row, "reporter", mapping)?.trim() || null,
    labels: getField(row, "labels", mapping)?.trim() || null,
    components: getField(row, "components", mapping)?.trim() || null,
    storyPoints: parseNumeric(getField(row, "storyPoints", mapping)),
    timeEstimateHours: parseNumeric(
      getField(row, "timeEstimateHours", mapping)
    ),
    timeSpentHours: parseNumeric(getField(row, "timeSpentHours", mapping)),
    createdAt,
    resolvedAt: parseDate(getField(row, "resolvedAt", mapping)),
    updatedAt: parseDate(getField(row, "updatedAt", mapping)),
    customFields: null,
  };
}

export function parseCSVFile(
  fileContent: string,
  mapping: ColumnMapping = DEFAULT_COLUMN_MAPPING
): { bugs: ParsedBug[]; errors: string[] } {
  const errors: string[] = [];

  const result = Papa.parse<Record<string, string>>(fileContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      errors.push(`Row ${err.row}: ${err.message}`);
    }
  }

  const bugs: ParsedBug[] = [];

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i];
    const bug = rowToParsedBug(row, mapping);
    if (bug) {
      bugs.push(bug);
    } else {
      errors.push(
        `Row ${i + 1}: Skipped - missing required fields (summary, status)`
      );
    }
  }

  return { bugs, errors };
}

export function parseJSONFile(
  fileContent: string
): { bugs: ParsedBug[]; errors: string[] } {
  const errors: string[] = [];

  let raw: unknown;
  try {
    raw = JSON.parse(fileContent);
  } catch {
    return { bugs: [], errors: ["Invalid JSON file"] };
  }

  const items: Record<string, unknown>[] = Array.isArray(raw)
    ? raw
    : (raw as Record<string, unknown>).issues
      ? ((raw as Record<string, unknown>).issues as Record<string, unknown>[])
      : (raw as Record<string, unknown>).bugs
        ? ((raw as Record<string, unknown>).bugs as Record<string, unknown>[])
        : Array.isArray((raw as Record<string, unknown>).data)
          ? ((raw as Record<string, unknown>).data as Record<string, unknown>[])
          : [];

  if (items.length === 0) {
    return {
      bugs: [],
      errors: ["No bug data found in JSON. Expected an array or an object with 'issues', 'bugs', or 'data' key."],
    };
  }

  const bugs: ParsedBug[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const summary = (item.summary as string)?.trim();
    const status = (item.status as string)?.trim();

    if (!summary || !status) {
      errors.push(
        `Item ${i + 1}: Skipped - missing required fields (summary, status)`
      );
      continue;
    }

    const createdAtRaw = item.createdAt as string | undefined;
    const createdAt = parseDate(createdAtRaw) || new Date().toISOString();

    bugs.push({
      jiraKey: (item.jiraKey as string) || (item.key as string) || null,
      summary,
      description: (item.description as string) || null,
      status,
      resolution: (item.resolution as string) || null,
      priority: (item.priority as string) || null,
      issueType: (item.issueType as string) || (item.issuetype as string) || null,
      module: (item.module as string) || (item.component as string) || null,
      productCategory: (item.productCategory as string) || (item.category as string) || null,
      rootCause: (item.rootCause as string) || null,
      assignee: (item.assignee as string) || null,
      reporter: (item.reporter as string) || null,
      labels: (item.labels as string) || null,
      components: (item.components as string) || null,
      storyPoints:
        typeof item.storyPoints === "number"
          ? item.storyPoints
          : parseNumeric(item.storyPoints as string),
      timeEstimateHours:
        typeof item.timeEstimateHours === "number"
          ? item.timeEstimateHours
          : parseNumeric(item.timeEstimateHours as string),
      timeSpentHours:
        typeof item.timeSpentHours === "number"
          ? item.timeSpentHours
          : parseNumeric(item.timeSpentHours as string),
      createdAt,
      resolvedAt: parseDate(item.resolvedAt as string),
      updatedAt: parseDate(item.updatedAt as string),
      customFields: item.customFields
        ? JSON.stringify(item.customFields)
        : null,
    });
  }

  return { bugs, errors };
}
