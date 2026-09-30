import { Suspense } from "react";
import { Bell, AlertCircle, ShieldAlert, ArrowRightLeft, FileWarning } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

async function NotificationsContent() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

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
    take: 20
  });

  for (const ocr of pendingOcr) {
    notifications.push({
      id: `ocr-${ocr.id}`,
      type: "IDP_REVIEW",
      title: "IDP Manual Review Required",
      message: `Confidence threshold missed for Document ${ocr.document.title}. Review extracted metadata.`,
      time: ocr.createdAt,
      icon: AlertCircle,
      color: "text-red-600 bg-red-100 border-red-200"
    });
  }

  // 2. Access Denied Alerts (Visible to Admin or Judge/Auditor)
  if (user.role === "ADMIN" || user.role === "JUDGE_AUDITOR") {
    const deniedAccess = await prisma.auditLog.findMany({
      where: {
        action: "ACCESS_DENIED",
      },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    for (const log of deniedAccess) {
      notifications.push({
        id: `audit-${log.id}`,
        type: "SECURITY",
        title: "Access Denied Alert",
        message: `Unauthorized attempt by role ${log.role} for case ${log.caseId || "unknown"}.`,
        time: log.createdAt,
        icon: ShieldAlert,
        color: "text-amber-600 bg-amber-100 border-amber-200"
      });
    }
  }

  // 3. Custody Transfers (Visible if user's role matches toDepartment)
  const recentTransfers = await prisma.custodyEvent.findMany({
    where: {
      toDepartment: user.role,
    },
    include: { document: { select: { title: true } }, actor: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  for (const transfer of recentTransfers) {
    notifications.push({
      id: `custody-${transfer.id}`,
      type: "CUSTODY",
      title: "Custody Transfer Pending",
      message: `${transfer.document.title} transferred by ${transfer.actor.role} ${transfer.actor.name}. Awaiting your signature.`,
      time: transfer.createdAt,
      icon: ArrowRightLeft,
      color: "text-blue-600 bg-blue-100 border-blue-200"
    });
  }

  // 4. Legal Holds (Visible to all)
  const newHolds = await prisma.document.findMany({
    where: {
      legalHold: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  for (const doc of newHolds) {
    notifications.push({
      id: `hold-${doc.id}`,
      type: "LEGAL",
      title: "Legal Hold Active",
      message: `Document ${doc.title} has been flagged for indefinite retention.`,
      time: doc.createdAt,
      icon: FileWarning,
      color: "text-purple-600 bg-purple-100 border-purple-200"
    });
  }

  // 5. Malware Alerts
  const malwareAlerts = await prisma.auditLog.findMany({
    where: {
      action: "UPLOAD",
      result: "DENIED",
      reason: { contains: "Malware detected in file:" },
      ...(user.role !== "ADMIN" && user.role !== "JUDGE_AUDITOR" ? { actorId: user.id } : {})
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  for (const log of malwareAlerts) {
    notifications.push({
      id: `malware-${log.id}`,
      type: "SECURITY",
      title: "Malware Detected",
      message: log.reason || "Malware detected",
      time: log.createdAt,
      icon: ShieldAlert,
      color: "text-red-600 bg-red-100 border-red-200"
    });
  }

  // Sort by time descending
  notifications.sort((a, b) => b.time.getTime() - a.time.getTime());

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">
        <Bell className="h-12 w-12 mb-4 opacity-20" />
        <h3 className="text-lg font-medium text-slate-900">No notifications</h3>
        <p className="text-sm">You're all caught up! There are no alerts or pending actions for your role.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notifications.map((notif) => {
        const Icon = notif.icon;
        return (
          <div key={notif.id} className={`flex items-start p-5 rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow relative overflow-hidden`}>
            {/* Left accent border */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${notif.color.split(' ')[1]}`}></div>
            
            <div className={`p-2 rounded-full mr-4 ${notif.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <h4 className="text-sm font-semibold text-slate-900">{notif.title}</h4>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                  {formatDistanceToNow(notif.time, { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{notif.message}</p>
              
              <div className="mt-3 flex gap-2">
                <button className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">
                  View Details
                </button>
                {notif.type === "CUSTODY" && (
                  <button className="text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg transition-colors">
                    Sign Transfer
                  </button>
                )}
                {notif.type === "IDP_REVIEW" && (
                  <button className="text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors">
                    Start Review
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Bell className="h-6 w-6 text-slate-700" />
          Notification Center
        </h1>
        <p className="text-slate-500 mt-1">Alerts, pending actions, and system messages for your role.</p>
      </div>

      <Suspense fallback={
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse flex p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="h-10 w-10 bg-slate-200 rounded-full mr-4"></div>
              <div className="flex-1 space-y-3 py-1">
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      }>
        <NotificationsContent />
      </Suspense>
    </div>
  );
}
