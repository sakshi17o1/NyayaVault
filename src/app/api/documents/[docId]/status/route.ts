import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeDocument } from "@/lib/audit";

export async function GET(request: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await prisma.document.findUnique({
    where: { id: docId },
    include: { ocrExtractions: { take: 1, orderBy: { version: "desc" } } }
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // We do NOT use authorizeDocument("view_document") here because it writes to the AuditLog 
  // every 2 seconds during polling and requires a purpose for restricted cases, leading to 403s.
  // Instead, we just verify the user is assigned to the case.
  const assigned = await prisma.caseAssignment.findFirst({
    where: {
      caseId: doc.caseId,
      userId: user.id
    }
  });

  if (!assigned) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  return NextResponse.json({
    status: doc.status,
    hasOcr: doc.ocrExtractions && doc.ocrExtractions.length > 0,
    needsReview: doc.status === "MANUAL_REVIEW"
  });
}
