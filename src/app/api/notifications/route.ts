import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifications = [];
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. IDP Manual Review Required (Visible to IO/SHO assigned to the case, or Admin)
  const pendingOcr = await prisma.ocrExtraction.findMany({
    where: {
      status: "PENDING",
      document: user.role !== "ADMIN" && user.role !== "JUDGE_AUDITOR" ? {
        case: {
          assignments: {
            some: { userId: user.id }
          }
        }
      } : undefined
    },
    include: { document: { select: { title: true, id: true, case: { select: { caseNumber: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  for (const ocr of pendingOcr) {
    notifications.push({
      id: `ocr-${ocr.id}`,
      type: "IDP_REVIEW",
      title: "IDP Manual Review Required",
      message: `Confidence threshold missed for Document ${ocr.document.title}. Review extracted metadata.`,
      time: ocr.createdAt.toISOString(),
      icon: "AlertCircle",
      color: "red"
    });
  }

  // 2. Access Denied Alerts (Visible to Admin or Judge/Auditor)
  if (user.role === "ADMIN" || user.role === "JUDGE_AUDITOR") {
    const deniedAccess = await prisma.auditLog.findMany({
      where: {
        action: "ACCESS_DENIED",
        createdAt: { gte: oneDayAgo }
      },
      orderBy: { createdAt: "desc" },
      take: 5
    });

    for (const log of deniedAccess) {
      notifications.push({
        id: `audit-${log.id}`,
        type: "SECURITY",
        title: "Access Denied Alert",
        message: `Unauthorized attempt by role ${log.role} for case ${log.caseId || "unknown"}.`,
        time: log.createdAt.toISOString(),
        icon: "ShieldAlert",
        color: "amber"
      });
    }
  }

  // 3. Custody Transfers (Visible if user's role matches toDepartment)
  const recentTransfers = await prisma.custodyEvent.findMany({
    where: {
      toDepartment: user.role,
      createdAt: { gte: oneDayAgo }
    },
    include: { document: { select: { title: true } }, actor: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  for (const transfer of recentTransfers) {
    notifications.push({
      id: `custody-${transfer.id}`,
      type: "CUSTODY",
      title: "Custody Transfer Pending",
      message: `${transfer.document.title} transferred by ${transfer.actor.role} ${transfer.actor.name}. Awaiting your signature.`,
      time: transfer.createdAt.toISOString(),
      icon: "ArrowRightLeft",
      color: "blue"
    });
  }

  // 4. Legal Holds (Visible to assigned cases unless ADMIN)
  const newHolds = await prisma.document.findMany({
    where: {
      legalHold: true,
      createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
      case: user.role !== "ADMIN" && user.role !== "JUDGE_AUDITOR" ? {
        assignments: {
          some: { userId: user.id }
        }
      } : undefined
    },
    orderBy: { createdAt: "desc" },
    take: 3
  });

  for (const doc of newHolds) {
    notifications.push({
      id: `hold-${doc.id}`,
      type: "LEGAL",
      title: "Legal Hold Active",
      message: `Document ${doc.title} has been flagged for indefinite retention.`,
      time: doc.createdAt.toISOString(),
      icon: "FileWarning",
      color: "purple"
    });
  }

  // 5. Malware Alerts
  const malwareAlerts = await prisma.auditLog.findMany({
    where: {
      action: "UPLOAD",
      result: "DENIED",
      reason: { contains: "Malware detected in file:" },
      createdAt: { gte: oneDayAgo },
      ...(user.role !== "ADMIN" && user.role !== "JUDGE_AUDITOR" ? { actorId: user.id } : {})
    },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  for (const log of malwareAlerts) {
    notifications.push({
      id: `malware-${log.id}`,
      type: "SECURITY",
      title: "Malware Detected",
      message: log.reason || "Malware detected",
      time: log.createdAt.toISOString(),
      icon: "ShieldAlert",
      color: "red"
    });
  }

  // Sort by time descending
  notifications.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return NextResponse.json({ notifications: notifications.slice(0, 10) });
}
