import { execFile } from "child_process";
import path from "path";
import { prisma } from "./db";

const MAX_CONCURRENT_OCR = 2;
let activeWorkers = 0;

export async function enqueueOcrJob(docId: string) {
  // Use database queue instead of in-memory array
  await prisma.ocrJob.upsert({
    where: { documentId: docId },
    update: { status: "PENDING", error: null },
    create: { documentId: docId, status: "PENDING" }
  });
  
  // Fire off processing asynchronously
  processQueue().catch(console.error);
}

async function processQueue() {
  if (activeWorkers >= MAX_CONCURRENT_OCR) {
    return;
  }

  // Fetch the oldest pending job
  const nextJob = await prisma.ocrJob.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" }
  });

  if (!nextJob) return;

  // Mark as processing (using a transaction-like update where possible, but simple for now)
  await prisma.ocrJob.update({
    where: { id: nextJob.id },
    data: { status: "PROCESSING", attempts: { increment: 1 } }
  });

  activeWorkers++;
  const scriptPath = path.join(process.cwd(), "scripts", "ocr-worker.ts");

  // Run OCR worker directly using tsx
  const cmd = "npx";
  const args = [
    "tsx",
    scriptPath,
    nextJob.documentId
  ];
  
  execFile(cmd, args, { shell: true }, async (err, stdout, stderr) => {
    activeWorkers--;
    
    if (err) {
      console.error(`[OCR BACKGROUND ERROR for ${nextJob.documentId}] ${err.message}`);
      await prisma.ocrJob.update({
        where: { id: nextJob.id },
        data: { status: "FAILED", error: err.message }
      });
    } else {
      await prisma.ocrJob.update({
        where: { id: nextJob.id },
        data: { status: "COMPLETED" }
      });
    }
    if (stderr) console.error(stderr);
    
    // Attempt to process next item in queue
    processQueue().catch(console.error);
  });
}
