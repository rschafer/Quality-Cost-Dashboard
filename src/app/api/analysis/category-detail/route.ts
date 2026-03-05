import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { estimateBugCost, DEFAULT_HOURLY_RATE } from "@/lib/cost-calculator";
import { generateCategorySuggestions } from "@/lib/suggestions";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const snapshotId = searchParams.get("snapshotId");
  const category = searchParams.get("category");

  if (!snapshotId || !category) {
    return NextResponse.json(
      { error: "snapshotId and category query parameters are required" },
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

    const allBugs = snapshot.bugs;
    const categoryBugs = allBugs.filter(
      (b) => (b.productCategory || "Unknown") === category
    );

    if (categoryBugs.length === 0) {
      return NextResponse.json(
        { error: "No bugs found for this category" },
        { status: 404 }
      );
    }

    // Resolution breakdown
    const resolutionBreakdown: Record<string, number> = {};
    for (const bug of categoryBugs) {
      const res = bug.resolution || "Unknown";
      resolutionBreakdown[res] = (resolutionBreakdown[res] || 0) + 1;
    }

    // Priority breakdown
    const priorityBreakdown: Record<string, number> = {};
    for (const bug of categoryBugs) {
      const pri = bug.priority || "Unknown";
      priorityBreakdown[pri] = (priorityBreakdown[pri] || 0) + 1;
    }

    // Avg resolution time
    const resDays = categoryBugs
      .filter((b) => b.createdAt && b.resolvedAt)
      .map((b) => {
        const created = new Date(b.createdAt).getTime();
        const resolved = new Date(b.resolvedAt!).getTime();
        return (resolved - created) / (1000 * 60 * 60 * 24);
      })
      .filter((d) => d >= 0);
    const avgResolutionDays =
      resDays.length > 0
        ? Math.round((resDays.reduce((a, b) => a + b, 0) / resDays.length) * 10) / 10
        : 0;

    // Cost
    const cost = categoryBugs.reduce(
      (sum, bug) => sum + estimateBugCost(bug, DEFAULT_HOURLY_RATE).estimatedCost,
      0
    );
    const totalCost = allBugs.reduce(
      (sum, bug) => sum + estimateBugCost(bug, DEFAULT_HOURLY_RATE).estimatedCost,
      0
    );

    // All summaries for pattern analysis
    const allSummaries = categoryBugs.map((b) => b.summary);

    // Group summaries by resolution type for deeper insights
    const resolutionSummaries: Record<string, string[]> = {};
    for (const bug of categoryBugs) {
      const res = bug.resolution || "Unknown";
      if (!resolutionSummaries[res]) resolutionSummaries[res] = [];
      resolutionSummaries[res].push(bug.summary);
    }

    // Sample summaries for display
    const sampleSummaries = categoryBugs
      .slice(0, 5)
      .map((b) => b.summary);

    // Generate suggestions with summary pattern analysis
    const suggestions = generateCategorySuggestions({
      name: category,
      count: categoryBugs.length,
      cost: Math.round(cost),
      resolutionBreakdown,
      priorityBreakdown,
      avgResolutionDays,
      totalBugs: allBugs.length,
      totalCost: Math.round(totalCost),
      summaries: allSummaries,
      resolutionSummaries,
    });

    return NextResponse.json({
      name: category,
      cost: Math.round(cost),
      count: categoryBugs.length,
      resolutionBreakdown,
      priorityBreakdown,
      avgResolutionDays,
      sampleSummaries,
      suggestions,
    });
  } catch (error) {
    console.error("Failed to compute category detail:", error);
    return NextResponse.json(
      { error: "Failed to compute category detail" },
      { status: 500 }
    );
  }
}
