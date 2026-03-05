import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAIAnalysis } from "@/lib/analysis";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { snapshotId } = body;

    if (!snapshotId || typeof snapshotId !== "string") {
      return NextResponse.json(
        { error: "snapshotId is required and must be a string" },
        { status: 400 }
      );
    }

    const result = await runAIAnalysis(snapshotId);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run AI analysis";
    console.error("AI analysis error:", error);

    // Return appropriate status codes based on the error
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("ANTHROPIC_API_KEY")) {
      return NextResponse.json({ error: message }, { status: 503 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
    const analysis = await prisma.analysis.findFirst({
      where: {
        snapshotId,
        analysisType: "ai_summary",
      },
      orderBy: { generatedAt: "desc" },
    });

    if (!analysis) {
      return NextResponse.json(
        { error: "No AI analysis found for this snapshot" },
        { status: 404 }
      );
    }

    const content = JSON.parse(analysis.content);

    return NextResponse.json({
      ...content,
      metadata: {
        id: analysis.id,
        modelUsed: analysis.modelUsed,
        tokenCount: analysis.tokenCount,
        generatedAt: analysis.generatedAt,
      },
    });
  } catch (error) {
    console.error("Failed to fetch AI analysis:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI analysis" },
      { status: 500 }
    );
  }
}
