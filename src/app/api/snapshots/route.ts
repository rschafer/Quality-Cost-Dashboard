import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const snapshots = await prisma.snapshot.findMany({
      orderBy: { importedAt: "desc" },
    });

    return NextResponse.json(snapshots);
  } catch (error) {
    console.error("Failed to fetch snapshots:", error);
    return NextResponse.json(
      { error: "Failed to fetch snapshots" },
      { status: 500 }
    );
  }
}
