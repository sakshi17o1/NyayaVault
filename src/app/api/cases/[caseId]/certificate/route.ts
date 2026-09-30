import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeCase, writeAudit } from "@/lib/audit";
import { computeSha256, appendLedgerEvent } from "@/lib/integrity";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { caseId } = await params;

  const authResult = await authorizeCase({
    user,
    caseId,
    action: "export",
  });

  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.reason }, { status: authResult.status });
  }

  const caseRecord = await prisma.caseRecord.findUnique({
    where: { id: caseId },
    include: { documents: true }
  });

  if (!caseRecord) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  // Generate the cryptographic payload required to satisfy Section 63 of the Bharatiya Sakshya Adhiniyam (BSA).
  const certificateContent = `
NYAYAVAULT BSA-63 MASTER CERTIFICATE
CASE NUMBER: ${caseRecord.caseNumber}
TOTAL DOCUMENTS: ${caseRecord.documents.length}
TIMESTAMP: ${new Date().toISOString()}

STATUS: DRAFT
`.trim();

  const certHash = computeSha256(Buffer.from(certificateContent, "utf-8"));

  // Provide transparency in the application dashboard that a legal certification was issued.
  await writeAudit({
    actorId: user.id,
    role: user.role,
    action: "EXPORT",
    result: "SUCCESS",
    caseId,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
    userAgent: request.headers.get("user-agent"),
    reason: "Generated BSA Section 63 Draft Certificate",
  });

  // Cryptographically anchor the certificate payload in the append-only ledger so it can be verified in court independently of the database.
  const ledgerTx = await appendLedgerEvent({
    actorId: user.id,
    eventType: "BSA_CERTIFICATE_DRAFT",
    metadata: {
      caseId,
      certHash,
    }
  });

  return NextResponse.json({
    status: "DRAFT",
    hash: certHash,
    ledgerProofId: ledgerTx.proofId,
    content: certificateContent
  });
}
