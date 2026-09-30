import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { evaluateAccess } from "@/lib/auth/abac";
import { IntegrityDashboard } from "@/components/IntegrityDashboard";

export default async function IntegrityPage(props: { searchParams: Promise<{ caseId?: string }> }) {
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
    include: { 
      case: {
        include: {
          documents: {
            where: { currentVersion: { gt: 0 } },
            orderBy: { createdAt: "desc" }
          }
        }
      } 
    },
  });

  const uploadableCases = assignments
    .filter((row) =>
      evaluateAccess({
        role: user.role,
        assigned: true,
        caseClassification: row.case.classification,
        action: "view_document",
        purpose: "Cryptographic Integrity Verification",
      }).allowed && row.case.documents.length > 0
    )
    .map((row) => ({
      id: row.case.id,
      caseNumber: row.case.caseNumber,
      title: row.case.title,
      documents: row.case.documents.map(d => ({
        id: d.id,
        title: d.title,
        type: d.type,
        version: d.currentVersion
      }))
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-navy">Integrity verification</h1>
        <p className="text-sm text-slate-600">
          Recompute SHA-256 hashes and compare them to the append-only ledger proof.
        </p>
      </div>
      <IntegrityDashboard cases={uploadableCases} />
    </div>
  );
}
