import { prisma } from "../src/lib/db";
import { getStorage } from "../src/lib/storage";
import { processDocument } from "../src/lib/ocr/idp";

// Basic mock of writeAudit since we don't have the user object in the detached worker easily,
// or we can just update the DB directly.
async function writeAuditMock({ action, result, caseId, documentId, reason }: any) {
  await prisma.auditLog.create({
    data: {
      actorId: null, // Must be null, not "SYSTEM", because it's a foreign key to the User table
      role: "SYSTEM",
      action,
      result,
      caseId,
      documentId,
      ip: "127.0.0.1",
      userAgent: "OCR_BACKGROUND_WORKER",
      reason
    }
  });
}

async function run() {
  const docId = process.argv[2];
  if (!docId) {
    console.error("No document ID provided.");
    process.exit(1);
  }

  try {
    console.log(`[OCR WORKER] Starting processing for document: ${docId}`);
    
    const document = await prisma.document.findUnique({ where: { id: docId } });
    if (!document) throw new Error("Document not found");
    
    const versionRecord = await prisma.documentVersion.findUnique({ 
      where: { documentId_version: { documentId: docId, version: document.currentVersion } } 
    });
    if (!versionRecord) throw new Error("Version not found");

    const storage = getStorage();
    const aad = `${docId}|${versionRecord.version}`;
    const buffer = await storage.get(versionRecord.storageKey, aad);
    console.log(`[OCR WORKER] Buffer fetched, ${buffer.length} bytes`);

    // Run Tesseract / IDP
    const ocrResult = await processDocument(buffer, versionRecord.mimeType, document.type);
    console.log(`[OCR WORKER] OCR completed. Confidence: ${ocrResult.confidence}`);

    const extractionJson = JSON.stringify({
      fields: ocrResult.extractedData,
      confidences: ocrResult.fieldConfidence
    });

    const needsReview = Object.values(ocrResult.fieldConfidence).some(c => c < 0.6);
    const nextStatus = needsReview ? "MANUAL_REVIEW" : "APPROVED";

    const { chunkText, generateEmbedding } = await import("../src/lib/ai/embeddings");
    const { redact } = await import("../src/lib/redact");
    
    const redactedOutput = redact(ocrResult.rawText, { fields: ocrResult.extractedData }, []);
    const chunks = chunkText(redactedOutput.text);
    const chunkData: { documentId: string, text: string, embedding: string }[] = [];
    for (const text of chunks) {
      try {
        const emb = await generateEmbedding(text);
        chunkData.push({
          documentId: docId,
          text: text,
          embedding: JSON.stringify(emb)
        });
      } catch (e) {
        console.error("[OCR WORKER] Failed to embed chunk", e);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.ocrExtraction.upsert({
        where: { 
          documentId_version: { documentId: docId, version: versionRecord.version } 
        },
        create: {
          documentId: docId,
          version: versionRecord.version,
          rawText: ocrResult.rawText,
          confidence: ocrResult.confidence,
          extractedData: extractionJson,
          status: nextStatus === "APPROVED" ? "APPROVED" : "PENDING"
        },
        update: {
          version: versionRecord.version,
          rawText: ocrResult.rawText,
          confidence: ocrResult.confidence,
          extractedData: extractionJson,
          status: nextStatus === "APPROVED" ? "APPROVED" : "PENDING",
          reviewedById: null,
          reviewedAt: null,
        }
      });

      await tx.document.update({
        where: { id: docId },
        data: { 
          status: nextStatus,
          ...(ocrResult.suggestedDocumentType ? { type: ocrResult.suggestedDocumentType as any } : {})
        }
      });
      
      await tx.documentChunk.deleteMany({ where: { documentId: docId } });
      if (chunkData.length > 0) {
        await tx.documentChunk.createMany({ data: chunkData });
      }
    });

    await writeAuditMock({
      action: "AI_QUERY",
      result: "SUCCESS",
      caseId: document.caseId,
      documentId: document.id,
      reason: `OCR pipeline completed. Next status: ${nextStatus}`
    });

    console.log(`[OCR WORKER] Successfully updated document ${docId} to ${nextStatus}`);
    process.exit(0);
  } catch (error: any) {
    console.error(`[OCR WORKER] FATAL ERROR for ${docId}:`, error);
    process.exit(1);
  }
}

run();
