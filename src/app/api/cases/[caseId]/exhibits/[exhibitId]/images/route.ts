import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";
import crypto from "crypto";
import { writeAudit } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string; exhibitId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { caseId, exhibitId } = await params;

  if (!["IO", "SHO", "FORENSIC_EXPERT"].includes(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const assignment = await prisma.caseAssignment.findUnique({
    where: { userId_caseId: { userId: user.id, caseId } },
  });

  if (!assignment) {
    return NextResponse.json({ error: "Must be assigned to the case" }, { status: 403 });
  }

  const exhibit = await prisma.physicalExhibit.findUnique({
    where: { id: exhibitId }
  });

  if (!exhibit || exhibit.caseId !== caseId) {
    return NextResponse.json({ error: "Exhibit not found or mismatch" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const imageId = crypto.randomUUID();
  const storageKey = `exhibit_img_${crypto.randomBytes(16).toString("hex")}`;
  const storage = getStorage();

  const aad = `${exhibitId}|${imageId}`;

  try {
    await storage.put(storageKey, buffer, file.type, aad);
  } catch (storageError: any) {
    console.error("Storage put failed:", storageError);
    return NextResponse.json({ error: "Storage failure" }, { status: 500 });
  }

  try {
    const exhibitImage = await prisma.exhibitImage.create({
      data: {
        id: imageId,
        exhibitId,
        url: storageKey,
        uploadedById: user.id,
      }
    });

    await writeAudit({
      actorId: user.id,
      role: user.role,
      action: "UPDATE_EXHIBIT",
      caseId,
      ip: request.headers.get("x-forwarded-for") || "127.0.0.1",
      userAgent: request.headers.get("user-agent") || "unknown",
      result: "SUCCESS",
      reason: `Uploaded image for exhibit ${exhibit.exhibitNumber}.`,
      metadata: { exhibitId, imageId }
    });

    return NextResponse.json({ success: true, image: exhibitImage });
  } catch (error: any) {
    await storage.delete(storageKey);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string; exhibitId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { caseId, exhibitId } = await params;

  const assignment = await prisma.caseAssignment.findUnique({
    where: { userId_caseId: { userId: user.id, caseId } },
  });

  if (!assignment && user.role !== "ADMIN" && user.role !== "JUDGE_AUDITOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const images = await prisma.exhibitImage.findMany({
    where: { exhibitId },
    orderBy: { uploadedAt: "desc" },
    include: {
      uploadedBy: { select: { name: true, role: true } }
    }
  });

  return NextResponse.json(images);
}
