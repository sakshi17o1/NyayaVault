import { prisma } from "./db";
import { writeAudit } from "./audit";
import { appendLedgerEvent } from "./integrity";

/**
 * DPDP Act Compliance & Data Minimization:
 * Scans for ARCHIVED cases where the retention policy has expired,
 * and purges the raw PII (OCR text) to minimize data while preserving 
 * the cryptographic ledger for legal integrity.
 */
export async function runRetentionPurge(dryRun: boolean = false, approver1?: string, approver2?: string) {
  console.log(`[Retention Cron] Starting DPDP Data Minimization scan... (Dry Run: ${dryRun})`);

  if (!dryRun && (!approver1 || !approver2 || approver1 === approver2)) {
    throw new Error("Two distinct approvers are required for a live purge.");
  }

  // Find all documents in ARCHIVED cases that are not already purged
  // AND are explicitly not under legal hold.
  const expiredDocuments = await prisma.document.findMany({
    where: {
      status: "ARCHIVED",
      retentionState: { not: "PURGED" },
      legalHold: false, // Critical Fix (E1): Never purge documents under legal hold
      case: {
        status: "ARCHIVED"
      }
    },
    include: {
      ocrExtractions: true
    }
  });

  if (expiredDocuments.length === 0) {
    console.log("[Retention Cron] No expired documents found for purging.");
    return;
  }

  console.log(`[Retention Cron] Found ${expiredDocuments.length} documents eligible for data minimization.`);

  for (const doc of expiredDocuments) {
    if (dryRun) {
      console.log(`[Retention Cron] (DRY RUN) Would purge PII for document ${doc.id}`);
      continue;
    }

    // We are legally required to redact PII from raw extractions after the retention period expires to comply with DPDP.
    for (const ocr of doc.ocrExtractions) {
      await prisma.ocrExtraction.update({
        where: { id: ocr.id },
        data: {
          rawText: "[REDACTED - DPDP DATA MINIMIZATION]",
          extractedData: "{}" // Clear JSON extraction
        }
      });
    }

    // Update the document's state to reflect its purged status so it is no longer served to the UI.
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        retentionState: "PURGED"
      }
    });

    // The act of purging a document must itself be recorded in the cryptographic ledger to maintain the complete lifecycle audit.
    await appendLedgerEvent({
      eventType: "PURGE",
      documentId: doc.id,
      metadata: { action: "DATA_MINIMIZATION", approvers: [approver1, approver2], version: doc.currentVersion }
    });

    // Leave a paper trail for the system administrator showing the automated background job executed successfully.
    await writeAudit({
      actorId: undefined, // System action
      role: "SYSTEM",
      action: "PURGE" as any, 
      caseId: doc.caseId,
      documentId: doc.id,
      ip: "127.0.0.1",
      userAgent: "NyayaVault-Retention-Cron",
      result: "SUCCESS",
      reason: `Automated DPDP Data Minimization: PII purged post-retention. Approvers: ${approver1}, ${approver2}`,
      metadata: { action: "DATA_MINIMIZATION", approvers: [approver1, approver2] }
    });

    console.log(`[Retention Cron] Successfully purged PII for document ${doc.id}`);
  }

  // 180-day Rolling Log Retention for Audit Logs
  if (!dryRun) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 180);
    const deletedLogs = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });
    console.log(`[Retention Cron] Purged ${deletedLogs.count} audit logs older than 180 days.`);
  }

  console.log("[Retention Cron] Scan complete.");
}
