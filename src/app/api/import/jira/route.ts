import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Jira integration not yet configured. Please use CSV import.",
    },
    { status: 501 }
  );
}
