import crypto from "crypto";
import { prisma } from "@/lib/db";

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// Global lock for ledger serialization
let ledgerLock = Promise.resolve<any>(null);

export async function appendLedgerEvent(params: {
  actorId?: string;
  eventType: string;
  documentId?: string;
  versionId?: string;
  metadata?: Record<string, unknown>;
  txClient?: any; // Pass existing transaction to avoid SQLite deadlocks
}) {
  const execute = async (tx: any) => {
    const lastEvent = await tx.ledgerEvent.findFirst({
      orderBy: { sequence: "desc" },
    });

    const sequence = lastEvent ? lastEvent.sequence + 1 : 1;
    const prevHash = lastEvent ? lastEvent.eventHash : "GENESIS";
    
    const timestamp = new Date();
    
    // Hash sensitive metadata to prevent leakage in ledger
    const safeMetadata: Record<string, any> = {};
    if (params.metadata) {
      for (const [key, value] of Object.entries(params.metadata)) {
        if (key === "hash") {
          safeMetadata[key] = value;
        } else if (typeof value === "string" && (value.includes("ey") || value.length > 50)) {
          safeMetadata[key] = computeSha256(Buffer.from(value, "utf-8"));
        } else {
          safeMetadata[key] = value;
        }
      }
    }
    const metadataJson = JSON.stringify(safeMetadata);
    
    const eventString = [
      sequence.toString(),
      prevHash,
      params.eventType,
      params.actorId || "",
      params.documentId || "",
      params.versionId || "",
      metadataJson,
      timestamp.toISOString()
    ].join("|");

    const eventHash = computeSha256(Buffer.from(eventString, "utf-8"));
    const proofId = `PROOF-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;

    return tx.ledgerEvent.create({
      data: {
        sequence,
        prevHash,
        eventHash,
        timestamp,
        actorId: params.actorId,
        eventType: params.eventType,
        documentId: params.documentId,
        versionId: params.versionId,
        proofId,
        metadataJson,
      },
    });
  };

  // Serialize execution to prevent race conditions on sequence generation
  return new Promise<any>((resolve, reject) => {
    ledgerLock = ledgerLock.then(async () => {
      try {
        let result;
        if (params.txClient) {
          result = await execute(params.txClient);
        } else {
          result = await prisma.$transaction(execute);
        }
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  });
}

export async function verifyLedgerChain(): Promise<{ valid: boolean; error?: string; count?: number; head?: string }> {
  const events = await prisma.ledgerEvent.findMany({
    orderBy: { sequence: "asc" },
  });

  let expectedPrevHash = "GENESIS";
  let expectedSequence = 1;

  for (const event of events) {
    if (event.sequence !== expectedSequence) {
      return { valid: false, error: `Sequence gap detected at sequence ${event.sequence}. Expected ${expectedSequence}.` };
    }
    if (event.prevHash !== expectedPrevHash) {
      return { valid: false, error: `Hash chain broken at sequence ${event.sequence}. Expected prevHash ${expectedPrevHash}, got ${event.prevHash}.` };
    }

    const eventString = [
      event.sequence.toString(),
      event.prevHash,
      event.eventType,
      event.actorId || "",
      event.documentId || "",
      event.versionId || "",
      event.metadataJson,
      event.timestamp.toISOString()
    ].join("|");

    const recomputedHash = computeSha256(Buffer.from(eventString, "utf-8"));

    if (recomputedHash !== event.eventHash) {
      return { valid: false, error: `Event hash mismatch at sequence ${event.sequence}. Recomputed hash does not match stored hash.` };
    }

    expectedPrevHash = event.eventHash;
    expectedSequence++;
  }

  return { valid: true, count: events.length, head: expectedPrevHash };
}
