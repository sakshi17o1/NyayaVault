import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeDocument } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { docId } = await params;

  const authResult = await authorizeDocument({
    user,
    docId,
    action: "review_ocr",
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
    userAgent: request.headers.get("user-agent"),
  });

  if (!authResult.ok) return NextResponse.json({ error: authResult.reason }, { status: authResult.status });

  const document = await prisma.document.findUnique({
    where: { id: docId },
    include: { ocrExtractions: { take: 1, orderBy: { version: "desc" } } }
  });

  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const latestOcr = document.ocrExtractions?.[0];
  if (!latestOcr) {
    return NextResponse.json({ error: "No OCR data found for this document" }, { status: 404 });
  }

  // The OCR worker outputs a JSON string, but legacy or failed extractions might be malformed.
  // We fall back to empty objects to prevent the UI from crashing when reading metadata.
  let extractedData;
  try {
    extractedData = JSON.parse(latestOcr.extractedData);
  } catch {
    extractedData = { fields: {}, confidences: {} };
  }

  return NextResponse.json({ 
    rawText: latestOcr.rawText,
    confidence: latestOcr.confidence,
    status: latestOcr.status,
    reviewedById: latestOcr.reviewedById,
    extractedData
  });
}
