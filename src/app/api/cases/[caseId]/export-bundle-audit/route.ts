import { NextResponse } from "next/server";
import { requireRecentAuth } from "@/lib/auth/rbac";
import { writeAudit, authorizeCase } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const auth = await requireRecentAuth();
  if ("response" in auth) return auth.response;
  const user = auth.user;

  const { caseId } = await params;

  const authResult = await authorizeCase({
    user,
    caseId,
    action: "export",
    userAgent: request.headers.get("user-agent") || "unknown",
  });

  if (!authResult.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  await writeAudit({
    actorId: user.id,
    role: user.role,
    action: "EXPORT",
    result: "SUCCESS",
    caseId,
    ip,
    userAgent: request.headers.get("user-agent") || "unknown",
    reason: "Generated Case-Level Court Bundle.",
  });

  return NextResponse.json({ success: true });
}
