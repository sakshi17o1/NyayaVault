import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeCase, authorizeDocument, writeAudit } from "@/lib/audit";
import { getStorage } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { docId } = await params;

  // Ensure we are pulling the exact latest version anchored in the hash chain.
  const document = await prisma.document.findUnique({
    where: { id: docId },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!document || document.versions.length === 0) {
    return new NextResponse("Document not found", { status: 404 });
  }

  const purpose = request.nextUrl.searchParams.get("purpose") || undefined;

  // Re-verify ABAC on every download request since assignments or classifications may have changed.
  const authResult = await authorizeDocument({
    user,
    docId,
    action: "view_document",
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
    userAgent: request.headers.get("user-agent"),
    purpose,
  });

  if (!authResult.ok) {
    return new NextResponse(authResult.reason, { status: authResult.status });
  }

  const latestVersion = document.versions[0];
  const storageKey = latestVersion.storageKey;

  try {
    // Retrieve bytes from the vault and attempt authenticated decryption using the document ID and version as Additional Authenticated Data (AAD).
    const storage = getStorage();
    const aad = `${document.id}|${latestVersion.version}`;
    let fileBuffer: Buffer;
    try {
      fileBuffer = await storage.get(storageKey, aad);
    } catch (e: any) {
      // Fallback for files encrypted before AAD enforcement
      fileBuffer = await storage.get(storageKey);
    }
    
    // Critical: Verify cryptographic integrity post-decryption. If the hash doesn't match the ledger, the file has been tampered with or corrupted on disk.
    const crypto = require("crypto");
    const computedHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    if (computedHash !== latestVersion.sha256Hash) {
      await writeAudit({
        actorId: user.id,
        role: user.role,
        action: "DOWNLOAD",
        result: "ERROR",
        caseId: document.caseId,
        documentId: document.id,
        ip: request.headers.get("x-forwarded-for") || "local",
        userAgent: request.headers.get("user-agent") || "Browser",
        reason: "Integrity verification failed during download. File corrupted or tampered.",
      });
      return new NextResponse("File integrity verification failed. Document corrupted.", { status: 500 });
    }

    // Downloads of raw evidence files must be strictly audited for chain-of-custody tracking.
    await writeAudit({
      actorId: user.id,
      role: user.role,
      action: "DOWNLOAD",
      result: "SUCCESS",
      caseId: document.caseId,
      documentId: document.id,
      ip: request.headers.get("x-forwarded-for") || "local",
      userAgent: request.headers.get("user-agent") || "Browser",
      reason: "Downloaded decrypted document file",
    });

    // Force attachment mode to prevent the browser from inadvertently executing malicious scripts from uploaded evidence (e.g. HTML/SVG).
    return new NextResponse(fileBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": latestVersion.mimeType,
        "Content-Disposition": `attachment; filename="${latestVersion.originalName}"`,
        "Content-Length": fileBuffer.length.toString(),
        "X-Content-Type-Options": "nosniff" // C5: security header
      },
    });
  } catch (error) {
    console.error("Error decrypting/downloading document:", error);
    
    // Log the failure
    await writeAudit({
      actorId: user.id,
      role: user.role,
      action: "DOWNLOAD",
      result: "ERROR",
      caseId: document.caseId,
      documentId: document.id,
      ip: request.headers.get("x-forwarded-for") || "local",
      userAgent: request.headers.get("user-agent") || "Browser",
      reason: "Failed to decrypt or read file buffer",
    });

    return new NextResponse("Internal server error during decryption", { status: 500 });
  }
}
