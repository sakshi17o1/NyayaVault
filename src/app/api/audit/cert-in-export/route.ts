import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { requireRecentAuth } from "@/lib/auth/rbac";

export async function GET(request: NextRequest) {
  const auth = await requireRecentAuth();
  if ("response" in auth) return auth.response;
  const user = auth.user;
  
  if (!user || (user.role !== "ADMIN" && user.role !== "JUDGE_AUDITOR")) {
    return NextResponse.json({ error: "Unauthorized. Requires ADMIN or JUDGE_AUDITOR role." }, { status: 403 });
  }

  // CERT-In guidelines generally require incidents from the last 72 hours
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - 72);

  const securityIncidents = await prisma.auditLog.findMany({
    where: {
      createdAt: {
        gte: cutoffDate
      },
      action: {
        in: ["ACCESS_DENIED"]
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      actor: true
    }
  });

  // Convert to CSV
  const header = "id,timestamp,action,actorId,actorName,role,ip,userAgent,result,reason\n";
  const rows = securityIncidents.map(log => {
    return [
      log.id,
      log.createdAt.toISOString(),
      log.action,
      log.actorId || "SYSTEM",
      (log as any).actor?.name || "N/A",
      log.role,
      `"${log.ip}"`,
      `"${log.userAgent?.replace(/"/g, '""')}"`,
      log.result,
      `"${log.reason?.replace(/"/g, '""')}"`
    ].join(",");
  });

  const csvContent = header + rows.join("\n");

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="CERT_IN_Incident_Report_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
