import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { caseId } = await params;

  // Basic case access check
  const assignment = await prisma.caseAssignment.findUnique({
    where: { userId_caseId: { userId: user.id, caseId } },
  });

  if (!assignment && user.role !== "ADMIN" && user.role !== "JUDGE_AUDITOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const exhibits = await prisma.physicalExhibit.findMany({
    where: { caseId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(exhibits);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { caseId } = await params;

  // Only IO or SHO or Forensic can add exhibits typically
  if (!["IO", "SHO", "FORENSIC_EXPERT"].includes(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const assignment = await prisma.caseAssignment.findUnique({
    where: { userId_caseId: { userId: user.id, caseId } },
  });

  if (!assignment) {
    return NextResponse.json({ error: "Must be assigned to the case" }, { status: 403 });
  }

  const body = await request.json();
  const {
    exhibitNumber,
    description,
    currentLocation,
    status,
    category,
    serialNumber,
    identifyingMarks,
    recoveryDate,
    recoveryLocation,
    recoveringOfficerId,
    sourcePerson,
    witnesses,
    storageRequirements,
    disposalEligibilityDate
  } = body;

  if (!exhibitNumber || !description || !currentLocation) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const exhibit = await prisma.physicalExhibit.create({
    data: {
      caseId,
      exhibitNumber,
      description,
      currentLocation,
      status: status || "IN_CUSTODY",
      category: category || "OTHER",
      serialNumber,
      identifyingMarks,
      recoveryDate: recoveryDate ? new Date(recoveryDate) : null,
      recoveryLocation,
      recoveringOfficerId,
      sourcePerson,
      witnesses,
      storageRequirements,
      disposalEligibilityDate: disposalEligibilityDate ? new Date(disposalEligibilityDate) : null,
    },
  });

  await writeAudit({
    actorId: user.id,
    role: user.role,
    action: "ADD_EXHIBIT",
    caseId,
    ip: request.headers.get("x-forwarded-for") || "127.0.0.1",
    userAgent: request.headers.get("user-agent") || "unknown",
    result: "SUCCESS",
    reason: `Added physical exhibit ${exhibitNumber} to Malkhana registry.`,
    metadata: { exhibitId: exhibit.id, exhibitNumber }
  });

  return NextResponse.json(exhibit, { status: 201 });
}
