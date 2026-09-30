import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeCase } from "@/lib/audit";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { caseId } = await params;

  const authResult = await authorizeCase({
    user,
    caseId,
    action: "ask_assistant",
    userAgent: request.headers.get("user-agent"),
  });

  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.reason }, { status: authResult.status });
  }

  const caseRecord = await prisma.caseRecord.findUnique({
    where: { id: caseId },
    include: {
      documents: {
        include: { ocrExtractions: { take: 1, orderBy: { version: "desc" } } }
      }
    }
  });

  if (!caseRecord) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  let contextText = `--- CASE DETAILS ---\nTitle: ${caseRecord.title}\nCase Number: ${caseRecord.caseNumber}\nStatus: ${caseRecord.status}\nStation: ${caseRecord.station}\n\n`;

  const docText = caseRecord.documents
    .filter(d => d.ocrExtractions && d.ocrExtractions.length > 0 && d.ocrExtractions[0].rawText)
    .map(d => `--- DOCUMENT [ID: ${d.id} | TITLE: ${d.title}] ---\n${d.ocrExtractions[0].rawText}`)
    .join("\n\n");
    
  if (docText) {
    contextText += docText;
  }

  return NextResponse.json({ context: contextText });
}
