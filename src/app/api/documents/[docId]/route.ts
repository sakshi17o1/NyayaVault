import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeDocument, writeAudit, clientIp } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { docId } = await params;
  const purpose = request.nextUrl.searchParams.get("purpose") || undefined;
  
  const authResult = await authorizeDocument({
    user,
    docId,
    action: "view_document",
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
    userAgent: request.headers.get("user-agent"),
    purpose,
  });

  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.reason }, { status: authResult.status });
  }

  const document = await prisma.document.findUnique({
    where: { id: docId },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1
      }
    }
  });

  return NextResponse.json({ document });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { docId } = await params;

  // Enforce zero-trust visibility: ensure the user has the 'archive' permission for this specific classification level and case.
  const authResult = await authorizeDocument({
    user,
    docId,
    action: "archive",
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
    userAgent: request.headers.get("user-agent"),
  });

  if (!authResult.ok) return NextResponse.json({ error: authResult.reason }, { status: authResult.status });

  const document = await prisma.document.findUnique({
    where: { id: docId }
  });

  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  // Legal Hold Check
  if (document.legalHold) {
    await writeAudit({
      actorId: user.id,
      role: user.role,
      action: "ACCESS_DENIED",
      result: "DENIED",
      caseId: document.caseId,
      documentId: document.id,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0] || "local",
      userAgent: request.headers.get("user-agent"),
      reason: "Attempted to delete a document under active LEGAL HOLD.",
    });

    return NextResponse.json({ 
      error: "Compliance Violation: This document is under active Legal Hold and cannot be deleted.",
      status: "LEGAL_HOLD_ACTIVE"
    }, { status: 403 });
  }
  
  await prisma.document.update({
    where: { id: docId },
    data: { status: "ARCHIVED" } // Soft delete
  });

  await writeAudit({
    actorId: user.id,
    role: user.role,
    action: "APPROVAL", 
    result: "SUCCESS",
    caseId: document.caseId,
    documentId: document.id,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0] || "local",
    userAgent: request.headers.get("user-agent"),
    reason: "Document successfully archived.",
  });

  return NextResponse.json({ success: true, message: "Document archived" });
}
