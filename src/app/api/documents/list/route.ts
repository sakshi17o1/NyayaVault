import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assignments = await prisma.caseAssignment.findMany({
    where: { userId: user.id },
    select: { caseId: true }
  });

  const caseIds = assignments.map(a => a.caseId);

  const results = await prisma.document.findMany({
    where: {
      caseId: { in: caseIds }
    },
    include: {
      case: { select: { caseNumber: true } },
      ocrExtractions: { take: 1, orderBy: { version: "desc" }, select: { extractedData: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  const formatted = results.map((doc: any) => {
    let summary = null;
    let ocrKeys: string[] = [];
    const latestOcr = doc.ocrExtractions?.[0];
    if (latestOcr?.extractedData) {
      try {
        const parsed = JSON.parse(latestOcr.extractedData);
        if (parsed?.fields) {
          if (parsed.fields.summary) {
            summary = parsed.fields.summary;
          }
          ocrKeys = Object.keys(parsed.fields);
        }
      } catch (e) {
      }
    }

    return {
      id: doc.id,
      title: doc.title,
      type: doc.type,
      caseNumber: doc.case?.caseNumber || "Unknown",
      status: doc.status,
      summary,
      ocrKeys,
      createdAt: doc.createdAt
    };
  });

  return NextResponse.json({ documents: formatted });
}
