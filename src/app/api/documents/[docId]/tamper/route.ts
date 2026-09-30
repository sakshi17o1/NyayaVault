import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeCase, writeAudit, clientIp } from "@/lib/audit";
import { env } from "@/lib/env";
import path from "path";
import fs from "fs/promises";
import { kms } from "@/lib/kms";
import { getStorage } from "@/lib/storage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Tamper endpoint is disabled in production" }, { status: 403 });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { docId } = await params;

  const document = await prisma.document.findUnique({
    where: { id: docId }
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const authResult = await authorizeCase({
    user,
    caseId: document.caseId,
    action: "view_document",
    purpose: "Demonstrate Cryptographic Tampering",
    userAgent: request.headers.get("user-agent"),
  });

  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.reason }, { status: authResult.status });
  }

  const versionRecord = await prisma.documentVersion.findUnique({
    where: { documentId_version: { documentId: docId, version: document.currentVersion } }
  });

  if (!versionRecord) {
    return NextResponse.json({ error: "Document version not found" }, { status: 404 });
  }

  // Intentionally tamper with the file by decrypting it, appending garbage
  // to the plaintext, and re-encrypting it. This ensures the decryption
  // succeeds but the SHA-256 hash completely changes.
  const rootDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.storageRoot);
  const filePath = path.join(rootDir, versionRecord.storageKey);

  try {
    const backupPath = filePath + ".bak";
    try {
      await fs.access(backupPath);
    } catch {
      await fs.copyFile(filePath, backupPath);
    }

    const storage = getStorage();
    const aad = `${docId}|${document.currentVersion}`;
    
    let plaintext;
    try {
      plaintext = await storage.get(versionRecord.storageKey, aad);
    } catch {
      plaintext = await storage.get(versionRecord.storageKey);
    }
    const tamperedPlaintext = Buffer.concat([plaintext, Buffer.from("TAMPERED", "utf-8")]);
    
    const tamperedCiphertext = await kms.encrypt(tamperedPlaintext, aad);
    await fs.writeFile(filePath, tamperedCiphertext);

    await writeAudit({
      actorId: user.id,
      role: user.role,
      action: "ACCESS_ALLOWED",
      result: "SUCCESS",
      caseId: document.caseId,
      documentId: docId,
      ip: clientIp(request.headers),
      userAgent: request.headers.get("user-agent"),
      reason: "Demo file tamper action executed (sandbox backup created)",
      metadata: { action: "TAMPER" },
    });
  } catch (error: any) {
    console.error("Failed to tamper file:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Failed to modify file on disk", 
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }

  return NextResponse.json({ 
    success: true, 
    message: "File successfully tampered on disk. Original saved as .bak. Run integrity check to detect it." 
  });
}
