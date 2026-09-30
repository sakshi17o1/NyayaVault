import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string; exhibitId: string; imageId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { caseId, exhibitId, imageId } = await params;

  // Basic ABAC check
  const assignment = await prisma.caseAssignment.findUnique({
    where: { userId_caseId: { userId: user.id, caseId } },
  });
  
  if (!assignment && user.role !== "ADMIN" && user.role !== "JUDGE_AUDITOR") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const image = await prisma.exhibitImage.findUnique({
    where: { id: imageId }
  });

  if (!image || image.exhibitId !== exhibitId) {
    return new NextResponse("Image not found", { status: 404 });
  }

  const storageKey = image.url; // We stored the storageKey in the 'url' field

  try {
    const storage = getStorage();
    const aad = `${exhibitId}|${imageId}`;
    let fileBuffer: Buffer;
    
    try {
      fileBuffer = await storage.get(storageKey, aad);
    } catch (e: any) {
      fileBuffer = await storage.get(storageKey);
    }

    return new NextResponse(fileBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg", // or determine dynamically if stored
        "Cache-Control": "public, max-age=31536000, immutable"
      },
    });
  } catch (error) {
    console.error("Error decrypting/downloading image:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
