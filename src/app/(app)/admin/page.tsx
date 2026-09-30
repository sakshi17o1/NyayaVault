import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { ROLE_POLICY } from "@/lib/auth/abac";
import { writeAudit } from "@/lib/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (user.role !== "ADMIN") {
    await writeAudit({
      actorId: user.id,
      role: user.role,
      action: "ACCESS_DENIED",
      result: "DENIED",
      reason: "Admin page requires ADMIN role",
    });
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle>Admin restricted</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">This page is limited to the System Admin identity.</p>
        </CardContent>
      </Card>
    );
  }

  const users = await prisma.user.findMany({
    include: { assignments: { include: { case: true } } },
  });
  const policies = await prisma.accessPolicy.findMany();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-navy">Admin / demo configuration</h1>
        <p className="text-sm text-slate-600">
          Admin does not silently bypass case ABAC. Opening WS-2026-0001 as admin is denied and
          logged.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Demo users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {users.map((item) => (
            <div key={item.id} className="rounded border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{item.email}</span>
                <Badge tone="slate">{item.role}</Badge>
              </div>
              <p className="text-xs text-slate-500">
                Cases: {item.assignments.map((a) => a.case.caseNumber).join(", ") || "none"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Stored access policies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {policies.map((policy) => (
            <p key={policy.id}>
              <strong>{policy.role}</strong> — max {policy.maxClassification}. {policy.notes}
            </p>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Runtime policy (enforced in code)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded bg-slate-50 p-3 text-xs">
            {JSON.stringify(ROLE_POLICY, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
