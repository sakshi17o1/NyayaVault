import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeCase } from "@/lib/audit";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { caseId } = await params;
  const { summary } = await request.json();

  const authResult = await authorizeCase({
    user,
    caseId,
    action: "edit_case",
    userAgent: request.headers.get("user-agent"),
  });

  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.reason }, { status: authResult.status });
  }

  // Save the AI summary in the dedicated AiSummary table
  // with a promptHash (omitted here for simplicity or can be generated) and UNVERIFIED status
  await prisma.aiSummary.create({
    data: {
      caseId,
      summary,
      status: "UNVERIFIED"
    }
  });

  return NextResponse.json({ success: true });
}
