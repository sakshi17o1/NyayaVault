import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CustodyDashboard } from "@/components/CustodyDashboard";

export default async function CustodyPage(props: { searchParams: Promise<{ caseId?: string }> }) {
  const searchParams = await props.searchParams;
  const { caseId } = searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const whereClause: any = { userId: user.id };
  if (caseId) {
    whereClause.caseId = caseId;
  }

  const assignments = await prisma.caseAssignment.findMany({
    where: whereClause,
    select: { caseId: true }
  });

  const caseIds = assignments.map(a => a.caseId);

  const docs = await prisma.document.findMany({
    where: { caseId: { in: caseIds } },
    include: { case: true },
    orderBy: { createdAt: "desc" }
  });

  const formattedDocs = docs.map(d => ({
    id: d.id,
    title: d.title,
    caseNumber: d.case.caseNumber,
    ownerDepartment: d.ownerDepartment
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy">Chain of Custody</h1>
        <p className="text-slate-500 mt-1">Track evidence possession, history, and initiate digitally signed transfers.</p>
      </div>

      <CustodyDashboard documents={formattedDocs} currentDept={(user as any).department || "Unknown"} />
    </div>
  );
}
