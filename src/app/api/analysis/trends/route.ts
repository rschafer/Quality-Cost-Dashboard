import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compareTrends, identifyHotspots } from "@/lib/trend-calculator";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const snapshotId1 = searchParams.get("snapshotId1");
  const snapshotId2 = searchParams.get("snapshotId2");
  const field = searchParams.get("field") as
    | "module"
    | "productCategory"
    | "resolution"
    | null;

  if (!snapshotId1 || !snapshotId2) {
    return NextResponse.json(
      { error: "snapshotId1 and snapshotId2 query parameters are required" },
      { status: 400 }
    );
  }

  if (!field || !["module", "productCategory", "resolution"].includes(field)) {
    return NextResponse.json(
      {
        error:
          'field query parameter is required and must be one of: module, productCategory, resolution',
      },
      { status: 400 }
    );
  }

  try {
    const [snapshot1, snapshot2] = await Promise.all([
      prisma.snapshot.findUnique({
        where: { id: snapshotId1 },
        include: { bugs: true },
      }),
      prisma.snapshot.findUnique({
        where: { id: snapshotId2 },
        include: { bugs: true },
      }),
    ]);

    if (!snapshot1) {
      return NextResponse.json(
        { error: `Snapshot not found: ${snapshotId1}` },
        { status: 404 }
      );
    }
    if (!snapshot2) {
      return NextResponse.json(
        { error: `Snapshot not found: ${snapshotId2}` },
        { status: 404 }
      );
    }

    const trends = compareTrends(snapshot1.bugs, snapshot2.bugs, field);
    const hotspots = identifyHotspots(trends);

    return NextResponse.json({ trends, hotspots });
  } catch (error) {
    console.error("Failed to compute trend analysis:", error);
    return NextResponse.json(
      { error: "Failed to compute trend analysis" },
      { status: 500 }
    );
  }
}
