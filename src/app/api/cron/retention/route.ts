import { NextRequest, NextResponse } from "next/server";
import { runRetentionPurge } from "@/lib/retention-cron";

export async function POST(request: NextRequest) {
  // In a production app, verify a secret token in the headers to prevent abuse.
  if (process.env.NODE_ENV === "production") {
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
    }
  }
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { dryRun = false, approver1, approver2 } = body;

    await runRetentionPurge(dryRun, approver1, approver2);
    
    return NextResponse.json({ 
      success: true, 
      message: `Retention purge scan completed successfully. (Dry Run: ${dryRun})` 
    });
  } catch (error: any) {
    console.error("[Retention Cron API] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
