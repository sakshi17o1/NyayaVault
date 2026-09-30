import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeCase } from "@/lib/audit";
import { getStorage } from "@/lib/storage";
import { computeSha256, appendLedgerEvent } from "@/lib/integrity";
import { validateUploadFile, clamAvScan } from "@/lib/validators";
import { processDocumentOcr } from "@/lib/ocr";
import crypto from "crypto";
import { z } from "zod";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const UploadSchema = z.object({
    caseId: z.string().min(1).max(100).optional(),
    title: z.string().min(1).max(255).optional(),
    docType: z.string().min(1).max(50).optional(),
    documentId: z.string().optional(),
  });

  const parsed = UploadSchema.safeParse({
    caseId: formData.get("caseId")?.toString() || undefined,
    title: formData.get("title")?.toString() || undefined,
    docType: formData.get("docType")?.toString() || undefined,
    documentId: formData.get("documentId")?.toString() || undefined,
  });

  if (!parsed.success) {
    console.error("Upload validation error:", parsed.error);
    return NextResponse.json({ error: "Invalid input format" }, { status: 400 });
  }

  let { caseId, title, docType, documentId: existingDocId } = parsed.data;

  if (existingDocId) {
    const doc = await prisma.document.findUnique({ where: { id: existingDocId } });
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    if (caseId && doc.caseId !== caseId) {
      return NextResponse.json({ error: "caseId mismatch" }, { status: 400 });
    }
    caseId = doc.caseId; // Derive caseId from the document
  }

  if (!file || !caseId) {
    return NextResponse.json({ error: "Missing file or caseId" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // File validation (R11)
  const validationError = validateUploadFile(file, buffer);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // ABAC Check (R6, R7)
  const authResult = await authorizeCase({
    user,
    caseId,
    action: "upload",
    userAgent: request.headers.get("user-agent"),
  });
  if (!authResult.ok || !authResult.case) {
    return NextResponse.json({ error: authResult.reason }, { status: authResult.status });
  }

  // Malware Scan
  let scanResult: "CLEAN" | "FLAGGED" = "CLEAN";
  try {
    scanResult = await clamAvScan(buffer, file.name);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  if (scanResult === "FLAGGED") {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        role: user.role,
        caseId: caseId,
        action: "UPLOAD",
        result: "DENIED",
        reason: `Malware detected in file: ${file.name}`
      }
    });
    return NextResponse.json({ error: "Malware detected. Upload rejected." }, { status: 400 });
  }
  
  // Compute SHA-256 Hash of original file (R9)
  const sha256Hash = computeSha256(buffer);

  // Determine storage key
  const storageKey = `doc_${crypto.randomBytes(16).toString("hex")}`;
  
  let documentId: string;
  let versionNumber = 1;
  let prevVersionHash: string | null = null;
  let classification: any = "CONFIDENTIAL";
  let ownerDepartment: string = (user as any).department || "Unknown";
  
  if (existingDocId) {
    const documentRecord = await prisma.document.findUnique({ where: { id: existingDocId } });
    if (!documentRecord) throw new Error("Document not found");
    
    documentId = documentRecord.id;
    versionNumber = documentRecord.currentVersion + 1;
    
    const prevVersion = await prisma.documentVersion.findUnique({
      where: { documentId_version: { documentId: documentRecord.id, version: documentRecord.currentVersion } }
    });
    prevVersionHash = prevVersion?.sha256Hash || null;
  } else {
    documentId = crypto.randomUUID();
    classification = authResult.case.classification;
  }

  let documentRecord: any;

  try {
    // Write file to encrypted storage adapter FIRST (Atomicity C3)
    // Pass documentId|versionNumber as AAD (Cryptography D2)
    const storage = getStorage();
    const aad = `${documentId}|${versionNumber}`;
    
    try {
      await storage.put(storageKey, buffer, file.type, aad);
    } catch (storageError: any) {
      console.error("Storage put failed:", storageError);
      return NextResponse.json({ error: "Storage failure: " + storageError.message }, { status: 500 });
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (existingDocId) {
          documentRecord = await tx.document.update({
            where: { id: documentId },
            data: { currentVersion: versionNumber, status: "PROCESSING" }
          });
        } else {
          if (!docType || !title) throw new Error("Missing docType or title for new document");
          documentRecord = await tx.document.create({
            data: {
              id: documentId,
              caseId,
              title,
              type: docType as any,
              classification,
              ownerDepartment,
              currentVersion: 1,
              uploadedById: user.id,
              status: "PROCESSING",
            }
          });
        }

        const versionRecord = await tx.documentVersion.create({
          data: {
            documentId: documentRecord.id,
            version: versionNumber,
            storageKey,
            sha256Hash,
            prevVersionHash,
            scanStatus: scanResult,
            mimeType: file.type,
            byteSize: file.size,
            originalName: file.name,
          }
        });

        // Write to ledger (C8 Fix: Do not store plaintext PII filename on the ledger)
        const fileNameHash = crypto.createHash("sha256").update(file.name).digest("hex");
        const ledgerEvent = await appendLedgerEvent({
          actorId: user.id,
          eventType: "DOCUMENT_UPLOAD",
          documentId: documentRecord.id,
          versionId: versionRecord.id,
          metadata: { fileNameHash, hash: sha256Hash, size: file.size },
          txClient: tx,
        });

        // Link ledger proof back to version
        await tx.documentVersion.update({
          where: { id: versionRecord.id },
          data: { ledgerProofId: ledgerEvent.proofId }
        });
      });
    } catch (error: any) {
      // DB Transaction failed, delete the orphaned file from storage
      console.error("Upload DB transaction failed, deleting storage file", error);
      await storage.delete(storageKey);
      return NextResponse.json({ error: "Failed to create DB records: " + error.message }, { status: 500 });
    }
  } catch (outerError: any) {
    console.error("Fatal upload error:", outerError);
    return NextResponse.json({ error: "Internal server error: " + outerError.message }, { status: 500 });
  }

  // OCR is now triggered explicitly by the client via POST /api/documents/[id]/process-ocr

  return NextResponse.json({ 
    success: true, 
    documentId: documentRecord.id,
    version: versionNumber,
    hash: sha256Hash
  });
}
