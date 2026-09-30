import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/rbac";
import { evaluateAccess } from "@/lib/auth/abac";
import { writeAudit, clientIp } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const decision = evaluateAccess({
    role: auth.user.role,
    assigned: true,
    caseClassification: "INTERNAL",
    action: "view_audit",
  });

  if (!decision.allowed) {
    await writeAudit({
      actorId: auth.user.id,
      role: auth.user.role,
      action: "ACCESS_DENIED",
      result: "DENIED",
      ip: clientIp(request.headers),
      userAgent: request.headers.get("user-agent"),
      reason: decision.reason,
    });
    return NextResponse.json({ error: decision.reason }, { status: 403 });
  }

  const page = parseInt(request.nextUrl.searchParams.get("page") || "1", 10);
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);
  const skip = (page - 1) * limit;

  let whereClause: any = {};
  if (auth.user.role === "SHO") {
    // Lock SHO to their station's cases
    whereClause.caseId = { not: null };
    whereClause.case = {
      station: auth.user.station,
    };
  } else if (auth.user.role !== "ADMIN") {
    whereClause.case = {
      assignments: {
        some: { userId: auth.user.id }
      }
    };
  }

  const logs = await prisma.auditLog.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
    include: { actor: { select: { email: true, name: true } } },
  });

  await writeAudit({
    actorId: auth.user.id,
    role: auth.user.role,
    action: "ACCESS_ALLOWED",
    result: "SUCCESS",
    ip: clientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    reason: "Viewed audit log",
  });

  return NextResponse.json({ logs });
}
