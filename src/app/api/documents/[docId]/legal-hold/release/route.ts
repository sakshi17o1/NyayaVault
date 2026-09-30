import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeDocument, writeAudit, clientIp } from "@/lib/audit";
import { appendLedgerEvent } from "@/lib/integrity";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { docId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { reason, orderReference } = body;
  if (!reason || !orderReference) {
    return NextResponse.json({ error: "Missing reason or orderReference" }, { status: 400 });
  }

  // Only SHO or ADMIN can release legal hold (business logic)
  if (user.role !== "SHO" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only SHO or ADMIN can release a legal hold" }, { status: 403 });
  }

  const authResult = await authorizeDocument({
    user,
    docId,
    action: "archive", // Requires archive action capability
    ip: clientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
  });

  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.reason }, { status: authResult.status });
  }

  const document = authResult.document;
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (!document.legalHold) {
    return NextResponse.json({ error: "Document is not under legal hold" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    // Lift the lock on the document so it can be managed by the normal retention cron again.
    await tx.document.update({
      where: { id: docId },
      data: { legalHold: false, retentionState: "HOLD_RELEASED" },
    });

    // The release of a legal hold is a high-stakes event that must be anchored in the immutable chain.
    await appendLedgerEvent({
      actorId: user.id,
      eventType: "LEGAL_HOLD_RELEASE",
      documentId: docId,
      metadata: { reason, orderReference },
      txClient: tx as any
    });
  });

  // Maintain standard application-level auditing for the UI dashboard.
  await writeAudit({
    actorId: user.id,
    role: user.role,
    action: "APPROVAL", // Reusing APPROVAL for this high-privilege action
    result: "SUCCESS",
    caseId: document.caseId,
    documentId: docId,
    ip: clientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    reason: `Released Legal Hold. Ref: ${orderReference}. Reason: ${reason}`,
    metadata: { orderReference }
  });

  return NextResponse.json({ success: true, message: "Legal hold released" });
}
