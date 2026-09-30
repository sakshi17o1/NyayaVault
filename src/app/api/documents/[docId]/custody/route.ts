import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeCase, authorizeDocument, writeAudit } from "@/lib/audit";
import { appendLedgerEvent } from "@/lib/integrity";
import { verifyEspSignature } from "@/lib/signature";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { docId } = await params;

  const document = await prisma.document.findUnique({
    where: { id: docId }
  });

  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const authResult = await authorizeCase({
    user,
    caseId: document.caseId,
    action: "view_document",
    userAgent: request.headers.get("user-agent"),
  });

  if (!authResult.ok) return NextResponse.json({ error: authResult.reason }, { status: authResult.status });

  const events = await prisma.custodyEvent.findMany({
    where: { documentId: docId },
    include: { actor: { select: { name: true, role: true, department: true } } },
    orderBy: { createdAt: "asc" }
  });

  return NextResponse.json({ events });
}

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

  const { signedToken } = body;
  if (!signedToken) {
    return NextResponse.json({ error: "Missing cryptographically signed ESP token." }, { status: 400 });
  }

  const document = await prisma.document.findUnique({
    where: { id: docId }
  });

  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const authResult = await authorizeDocument({
    user,
    docId,
    action: "transfer_custody",
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
    userAgent: request.headers.get("user-agent"),
  });

  if (!authResult.ok) return NextResponse.json({ error: authResult.reason }, { status: authResult.status });

  // We never trust the client's raw JSON for custody transfers. All metadata must be securely extracted from the signed ESP token to prevent tampering mid-flight.
  let payload;
  try {
    payload = await verifyEspSignature(signedToken);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // The payload contains the absolute source of truth for this transfer. 
  const { actorId, documentId, action, toDepartment, reason } = payload as any;
  const signatureRef = signedToken;

  if (actorId !== user.id) {
    return NextResponse.json({ error: "Signature rejected: Token is bound to a different user/actor." }, { status: 403 });
  }
  if (documentId !== docId) {
    return NextResponse.json({ error: "Signature rejected: Token is bound to a different document." }, { status: 403 });
  }
  if (action !== "CUSTODY_TRANSFER") {
    return NextResponse.json({ error: "Signature rejected: Token action does not match." }, { status: 403 });
  }

  // Custody changes legally bind a department to the physical evidence, so we must anchor it in the append-only ledger immediately.
  const ledgerEvent = await appendLedgerEvent({
    actorId: user.id,
    eventType: "CUSTODY_TRANSFER",
    documentId: docId,
    metadata: { toDepartment, reason, signatureRef }
  });

  const event = await prisma.custodyEvent.create({
    data: {
      documentId: docId,
      actorId: user.id,
      toDepartment,
      reason,
      signatureRef,
      ledgerProofId: ledgerEvent.proofId
    }
  });

  // Update current owner department
  await prisma.document.update({
    where: { id: docId },
    data: { ownerDepartment: toDepartment }
  });

  await writeAudit({
    actorId: user.id,
    role: user.role,
    action: "CUSTODY_TRANSFER",
    result: "SUCCESS",
    caseId: document.caseId,
    documentId: document.id,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
    userAgent: request.headers.get("user-agent"),
    reason: `Transferred custody to ${toDepartment} for reason: ${reason}`,
  });

  return NextResponse.json({ success: true, event });
}
