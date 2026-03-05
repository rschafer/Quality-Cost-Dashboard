import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { computeStats } from "@/lib/stats";
import { buildSummaryAnalysisPrompt } from "@/lib/prompts";
import type { AIAnalysisResult } from "@/types/analysis";

const AI_MODEL = "claude-sonnet-4-20250514";
const ANALYSIS_TYPE = "ai_summary";

export async function runAIAnalysis(
  snapshotId: string
): Promise<AIAnalysisResult> {
  // Validate API key is configured
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Please add your Anthropic API key to the .env file or environment variables."
    );
  }

  // Fetch the snapshot and its bugs
  const snapshot = await prisma.snapshot.findUnique({
    where: { id: snapshotId },
    include: { bugs: true },
  });

  if (!snapshot) {
    throw new Error(`Snapshot with id "${snapshotId}" not found.`);
  }

  if (snapshot.bugs.length === 0) {
    throw new Error(
      `Snapshot "${snapshot.name}" has no bugs. Import bug data before running analysis.`
    );
  }

  // Compute stats from the bug data
  const stats = computeStats(snapshot.bugs);

  // Build the analysis prompt
  const prompt = buildSummaryAnalysisPrompt(stats);

  // Call Claude API
  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  // Extract the text response
  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude API returned no text content in the response.");
  }

  const rawText = textBlock.text.trim();

  // Parse JSON response, handling potential markdown code fences
  let jsonText = rawText;
  if (jsonText.startsWith("```")) {
    jsonText = jsonText
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?\s*```$/, "");
  }

  let analysisResult: AIAnalysisResult;
  try {
    analysisResult = JSON.parse(jsonText);
  } catch (parseError) {
    throw new Error(
      `Failed to parse Claude API response as JSON. Raw response: ${rawText.slice(0, 500)}`
    );
  }

  // Validate the response structure
  if (!analysisResult.keyFindings || !Array.isArray(analysisResult.keyFindings)) {
    throw new Error("Invalid analysis response: missing keyFindings array.");
  }
  if (
    !analysisResult.rootCausePatterns ||
    !Array.isArray(analysisResult.rootCausePatterns)
  ) {
    throw new Error(
      "Invalid analysis response: missing rootCausePatterns array."
    );
  }
  if (
    !analysisResult.processRecommendations ||
    !Array.isArray(analysisResult.processRecommendations)
  ) {
    throw new Error(
      "Invalid analysis response: missing processRecommendations array."
    );
  }
  if (
    !analysisResult.trackingRecommendations ||
    !Array.isArray(analysisResult.trackingRecommendations)
  ) {
    throw new Error(
      "Invalid analysis response: missing trackingRecommendations array."
    );
  }

  // Calculate token usage
  const tokenCount =
    (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0);

  // Store the analysis result in the database
  await prisma.analysis.create({
    data: {
      snapshotId,
      analysisType: ANALYSIS_TYPE,
      content: JSON.stringify(analysisResult),
      modelUsed: AI_MODEL,
      tokenCount,
    },
  });

  return analysisResult;
}
