import { prisma } from "@/lib/db";
import { processDocument } from "./ocr/idp";

export async function processDocumentOcr(documentId: string, version: number, buffer: Buffer, mimeType: string) {
  console.log(`[OCR] Starting processDocumentOcr for docId: ${documentId}, mimeType: ${mimeType}`);
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    console.log(`[OCR] Error: Document ${documentId} not found in DB!`);
    return;
  }
  console.log(`[OCR] Document found. Type: ${doc.type}. Initiating processDocument...`);

  // Run the new IDP pipeline (Tesseract for images, pdf-parse for PDFs)
  try {
    const ocrResult = await processDocument(buffer, mimeType, doc.type);
    console.log(`[OCR] processDocument finished successfully.`);
    const extractionJson = JSON.stringify({
    fields: ocrResult.extractedData,
    confidences: ocrResult.fieldConfidence
  });

  // Check if any field has low confidence
  const needsReview = Object.values(ocrResult.fieldConfidence).some(c => c < 0.7);
  const nextStatus = needsReview ? "MANUAL_REVIEW" : "APPROVED";

  await prisma.$transaction([
    prisma.ocrExtraction.create({
      data: {
        documentId,
        version,
        rawText: ocrResult.rawText,
        confidence: ocrResult.confidence,
        extractedData: extractionJson,
        status: nextStatus === "APPROVED" ? "APPROVED" : "PENDING"
      }
    }),
    prisma.document.update({
      where: { id: documentId },
      data: { status: nextStatus }
    })
  ]);
  console.log(`[OCR] Database transaction complete. Status updated to ${nextStatus}.`);
  } catch (err) {
    console.error(`[OCR] Fatal error during processDocumentOcr:`, err);
  }
}
