import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { evaluateAccess } from "@/lib/auth/abac";
import { writeAudit, clientIp } from "@/lib/audit";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q");

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Enforce zero-trust visibility: users can only search across cases they are explicitly assigned to.
  const assignments = await prisma.caseAssignment.findMany({
    where: { userId: user.id },
    include: { case: true }
  });

  // Filter cases the user actually has permission to view
  const caseIds = assignments
    .filter(a => {
      const decision = evaluateAccess({
        role: user.role,
        assigned: true,
        caseClassification: a.case.classification,
        action: "view_document",
        purpose: a.purpose,
      });
      return decision.allowed;
    })
    .map(a => a.caseId);

  // Search across both structured metadata (title/status) and unstructured evidence (OCR text) simultaneously.
  const results = await prisma.document.findMany({
    where: {
      caseId: { in: caseIds },
      OR: [
        { title: { contains: q } },
        { case: { caseNumber: { contains: q } } },
        {
          ocrExtractions: {
            some: { rawText: { contains: q } }
          }
        }
      ]
    },
    include: {
      case: { select: { caseNumber: true } },
      ocrExtractions: { take: 1, orderBy: { version: "desc" }, select: { rawText: true, status: true } }
    },
    take: 50
  });

  // Write audit event for SEARCH
  const qHash = crypto.createHash("sha256").update(q).digest("hex");
  await writeAudit({
    actorId: user.id,
    role: user.role,
    action: "ACCESS_ALLOWED",
    result: "SUCCESS",
    ip: clientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    reason: `Performed SEARCH (query hash: ${qHash})`,
  });

  const formatted = results.map((doc: any) => {
    // Generate a snippet of the OCR text if matched
    let snippet = null;
    const latestOcr = doc.ocrExtractions && doc.ocrExtractions.length > 0 ? doc.ocrExtractions[0] : null;
    if (latestOcr?.rawText) {
      const idx = latestOcr.rawText.toLowerCase().indexOf(q.toLowerCase());
      if (idx !== -1) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(latestOcr.rawText.length, idx + q.length + 40);
        snippet = `...${latestOcr.rawText.substring(start, end).replace(/\n/g, " ")}...`;
      }
    }

    return {
      id: doc.id,
      title: doc.title,
      type: doc.type,
      caseNumber: doc.case.caseNumber,
      snippet,
      status: doc.status
    };
  });

  return NextResponse.json({ results: formatted });
}
