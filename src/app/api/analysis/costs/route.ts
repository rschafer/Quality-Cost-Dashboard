import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  estimateBugCost,
  calculateCostBreakdown,
} from "@/lib/cost-calculator";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const snapshotId = searchParams.get("snapshotId");

  if (!snapshotId) {
    return NextResponse.json(
      { error: "snapshotId query parameter is required" },
      { status: 400 }
    );
  }

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

    const costs = snapshot.bugs.map((bug) => estimateBugCost(bug));

    const byModule = calculateCostBreakdown(snapshot.bugs, "module");
    const byCategory = calculateCostBreakdown(
      snapshot.bugs,
      "productCategory"
    );
    const byResolution = calculateCostBreakdown(snapshot.bugs, "resolution");

    const totalCost = costs.reduce((sum, c) => sum + c.estimatedCost, 0);
    const avgCost = costs.length > 0 ? totalCost / costs.length : 0;
    const highConfidenceCount = costs.filter(
      (c) => c.confidence === "high"
    ).length;
    const mediumConfidenceCount = costs.filter(
      (c) => c.confidence === "medium"
    ).length;
    const lowConfidenceCount = costs.filter(
      (c) => c.confidence === "low"
    ).length;

    return NextResponse.json({
      costs,
      breakdowns: {
        byModule,
        byCategory,
        byResolution,
      },
      summary: {
        totalCost: Math.round(totalCost * 100) / 100,
        avgCost: Math.round(avgCost * 100) / 100,
        highConfidenceCount,
        mediumConfidenceCount,
        lowConfidenceCount,
      },
    });
  } catch (error) {
    console.error("Failed to compute cost analysis:", error);
    return NextResponse.json(
      { error: "Failed to compute cost analysis" },
      { status: 500 }
    );
  }
}
