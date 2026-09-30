import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { evaluateAccess } from "@/lib/auth/abac";
import { writeAudit } from "@/lib/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AuditPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const decision = evaluateAccess({
    role: user.role,
    assigned: true,
    caseClassification: "INTERNAL",
    action: "view_audit",
  });

  if (!decision.allowed) {
    await writeAudit({
      actorId: user.id,
      role: user.role,
      action: "ACCESS_DENIED",
      result: "DENIED",
      reason: decision.reason,
    });
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle>Audit log restricted</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{decision.reason}</p>
        </CardContent>
      </Card>
    );
  }

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 150,
    include: { actor: { select: { email: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-navy">Audit log</h1>
        <p className="text-sm text-slate-600">Append-only. Denied actions are retained.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent events</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Actor</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Result</th>
                <th className="py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 whitespace-nowrap">{row.createdAt.toISOString()}</td>
                  <td className="py-2 pr-3">{row.actor?.email ?? row.role}</td>
                  <td className="py-2 pr-3">{row.action}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={row.result === "DENIED" ? "red" : "green"}>{row.result}</Badge>
                  </td>
                  <td className="py-2">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
