import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseCSVFile,
  parseJSONFile,
  DEFAULT_COLUMN_MAPPING,
} from "@/lib/csv-parser";
import type { ColumnMapping } from "@/lib/csv-parser";
import type { ImportResult } from "@/types/import";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string) || `Import - ${new Date().toLocaleDateString()}`;
    const mappingRaw = formData.get("mapping") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith(".csv");
    const isJSON = fileName.endsWith(".json");

    if (!isCSV && !isJSON) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a .csv or .json file." },
        { status: 400 }
      );
    }

    // Parse column mapping
    let mapping: ColumnMapping = DEFAULT_COLUMN_MAPPING;
    if (mappingRaw) {
      try {
        mapping = JSON.parse(mappingRaw) as ColumnMapping;
      } catch {
        return NextResponse.json(
          { error: "Invalid column mapping JSON" },
          { status: 400 }
        );
      }
    }

    // Read file content
    const fileContent = await file.text();

    if (!fileContent.trim()) {
      return NextResponse.json(
        { error: "File is empty" },
        { status: 400 }
      );
    }

    // Parse the file
    const { bugs, errors } = isCSV
      ? parseCSVFile(fileContent, mapping)
      : parseJSONFile(fileContent);

    if (bugs.length === 0) {
      return NextResponse.json(
        {
          error: "No valid bug records found in the file",
          errors,
        },
        { status: 400 }
      );
    }

    // Create the snapshot
    const snapshot = await prisma.snapshot.create({
      data: {
        name,
        source: isCSV ? "csv" : "json",
        sourceDetail: file.name,
        bugCount: 0,
      },
    });

    // Create bug records
    const createdBugs = await prisma.bug.createMany({
      data: bugs.map((bug) => ({
        jiraKey: bug.jiraKey,
        summary: bug.summary,
        description: bug.description,
        status: bug.status,
        resolution: bug.resolution,
        priority: bug.priority,
        issueType: bug.issueType,
        module: bug.module,
        productCategory: bug.productCategory,
        rootCause: bug.rootCause,
        assignee: bug.assignee,
        reporter: bug.reporter,
        labels: bug.labels,
        components: bug.components,
        storyPoints: bug.storyPoints,
        timeEstimateHours: bug.timeEstimateHours,
        timeSpentHours: bug.timeSpentHours,
        createdAt: new Date(bug.createdAt),
        resolvedAt: bug.resolvedAt ? new Date(bug.resolvedAt) : null,
        updatedAt: bug.updatedAt ? new Date(bug.updatedAt) : null,
        customFields: bug.customFields,
        snapshotId: snapshot.id,
      })),
    });

    // Update snapshot with actual bug count
    const updatedSnapshot = await prisma.snapshot.update({
      where: { id: snapshot.id },
      data: { bugCount: createdBugs.count },
    });

    const result: ImportResult = {
      snapshot: {
        id: updatedSnapshot.id,
        name: updatedSnapshot.name,
        bugCount: updatedSnapshot.bugCount,
      },
      errors,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Import failed:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Import failed: ${msg}` },
      { status: 500 }
    );
  }
}
