import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeCase } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { caseId } = await params;
  const { summaryId } = await request.json();

  // You must have edit_case permission to approve a summary as official
  const authResult = await authorizeCase({
    user,
    caseId,
    action: "edit_case",
    userAgent: request.headers.get("user-agent"),
  });

  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.reason }, { status: authResult.status });
  }

  const aiSummary = await prisma.aiSummary.findUnique({
    where: { id: summaryId }
  });

  if (!aiSummary || aiSummary.caseId !== caseId) {
    return NextResponse.json({ error: "Summary not found" }, { status: 404 });
  }

  // Transaction: update CaseRecord and AiSummary
  await prisma.$transaction([
    prisma.caseRecord.update({
      where: { id: caseId },
      data: { summary: aiSummary.summary }
    }),
    prisma.aiSummary.update({
      where: { id: summaryId },
      data: { status: "VERIFIED" }
    })
  ]);

  await writeAudit({
    actorId: user.id,
    role: user.role,
    action: "APPROVAL",
    caseId,
    result: "SUCCESS",
    reason: "Verified AI Summary and made it Official",
  });

  return NextResponse.json({ success: true });
}
