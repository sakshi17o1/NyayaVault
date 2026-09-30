import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/rbac";
import { authorizeCase, clientIp } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> },
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { caseId } = await context.params;
  const result = await authorizeCase({
    user: auth.user,
    caseId,
    action: "view_case",
    ip: clientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason, denied: true, fictional: true },
      { status: result.status },
    );
  }

  const record = result.case;
  return NextResponse.json({
    case: {
      id: record.id,
      caseNumber: record.caseNumber,
      title: record.title,
      station: record.station,
      status: record.status,
      classification: record.classification,
      firNumber: record.firNumber,
      cctnsRef: record.cctnsRef,
      summary: record.summary,
      fictionalNote: record.fictionalNote,
      createdAt: record.createdAt,
    },
  });
}
