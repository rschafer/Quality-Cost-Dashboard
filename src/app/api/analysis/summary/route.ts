import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeStats } from "@/lib/stats";
import { DEFAULT_HOURLY_RATE } from "@/lib/cost-calculator";
import type { Bug } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const snapshotId = searchParams.get("snapshotId");
  const hourlyRate = parseFloat(searchParams.get("hourlyRate") || "") || DEFAULT_HOURLY_RATE;

  if (!snapshotId) {
    return NextResponse.json(
      { error: "snapshotId query parameter is required" },
      { status: 400 }
    );
  }

  // Filter params
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const priority = searchParams.get("priority");
  const resolution = searchParams.get("resolution");
  const module = searchParams.get("module");
  const category = searchParams.get("category");

  try {
    const snapshot = await prisma.snapshot.findUnique({
      where: { id: snapshotId },
      include: { bugs: true },
    });

    if (!snapshot) {
      return NextResponse.json(
        { error: "Snapshot not found" },
        { status: 404 }
      );
    }

    let bugs: Bug[] = snapshot.bugs;

    // Apply filters
    if (dateFrom) {
      const from = new Date(dateFrom);
      bugs = bugs.filter((b) => new Date(b.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      bugs = bugs.filter((b) => new Date(b.createdAt) <= to);
    }
    if (priority) {
      const values = priority.split(",");
      bugs = bugs.filter((b) => b.priority && values.includes(b.priority));
    }
    if (resolution) {
      const values = resolution.split(",");
      bugs = bugs.filter((b) => b.resolution && values.includes(b.resolution));
    }
    if (module) {
      const values = module.split(",");
      bugs = bugs.filter((b) => b.module && values.includes(b.module));
    }
    if (category) {
      const values = category.split(",");
      bugs = bugs.filter((b) => b.productCategory && values.includes(b.productCategory));
    }

    // Also return available filter options from the FULL unfiltered set
    const allBugs = snapshot.bugs;
    const filterOptions = {
      priorities: [...new Set(allBugs.map((b) => b.priority).filter(Boolean))].sort() as string[],
      resolutions: [...new Set(allBugs.map((b) => b.resolution).filter(Boolean))].sort() as string[],
      modules: [...new Set(allBugs.map((b) => b.module).filter(Boolean))].sort() as string[],
      categories: [...new Set(allBugs.map((b) => b.productCategory).filter(Boolean))].sort() as string[],
    };

    const stats = computeStats(bugs, hourlyRate);

    return NextResponse.json({ ...stats, filterOptions });
  } catch (error) {
    console.error("Failed to compute analysis summary:", error);
    return NextResponse.json(
      { error: "Failed to compute analysis summary" },
      { status: 500 }
    );
  }
}
