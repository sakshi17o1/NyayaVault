import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeCase, authorizeDocument } from "@/lib/audit";
import { exec } from "child_process";
import path from "path";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { docId } = await params;

  const document = await prisma.document.findUnique({
    where: { id: docId }
  });

  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const authResult = await authorizeDocument({
    user,
    docId,
    action: "review_ocr", 
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
    userAgent: request.headers.get("user-agent"),
  });

  if (!authResult.ok) return NextResponse.json({ error: authResult.reason }, { status: authResult.status });

  // Instead of running Tesseract in the Next.js API Route (which causes freezing/memory leaks
  // because Webpack interferes with WebAssembly workers in Serverless environments),
  // we detach the heavy OCR pipeline to a completely isolated background OS process.
  // We use a queue to prevent unbounded concurrency.
  const { enqueueOcrJob } = require("@/lib/ocr-queue");
  enqueueOcrJob(docId);

  return NextResponse.json({ 
    success: true, 
    status: "PROCESSING_BACKGROUND",
  });
}
