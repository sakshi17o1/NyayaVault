import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeCase, authorizeDocument, writeAudit } from "@/lib/audit";
import crypto from "crypto";

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

  const { recipient, purpose, expiryHours, redactedFields } = body;
  if (!recipient || !purpose || !expiryHours) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const document = await prisma.document.findUnique({
    where: { id: docId }
  });

  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const authResult = await authorizeDocument({
    user,
    docId,
    action: "share",
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
    userAgent: request.headers.get("user-agent"),
  });

  if (!authResult.ok) return NextResponse.json({ error: authResult.reason }, { status: authResult.status });

  const hours = parseInt(expiryHours);
  if (isNaN(hours) || hours <= 0 || hours > 72) {
    return NextResponse.json({ error: "Invalid expiry. Must be between 1 and 72 hours." }, { status: 400 });
  }

  // Generate secure random token
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  const shareToken = await prisma.shareToken.create({
    data: {
      token,
      documentId: docId,
      recipient,
      purpose,
      expiresAt,
      viewOnly: true,
      redactedFields: redactedFields ? JSON.stringify(redactedFields) : null,
      createdById: user.id
    }
  });

  await writeAudit({
    actorId: user.id,
    role: user.role,
    action: "SHARE",
    result: "SUCCESS",
    caseId: document.caseId,
    documentId: document.id,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
    userAgent: request.headers.get("user-agent"),
    reason: `Generated secure share link for ${recipient}. Purpose: ${purpose}`,
  });

  return NextResponse.json({ 
    success: true, 
    shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/public/share/${token}` 
  });
}
