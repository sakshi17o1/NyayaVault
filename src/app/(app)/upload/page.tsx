import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { evaluateAccess } from "@/lib/auth/abac";
import { UploadForm } from "@/components/UploadForm";

export default async function UploadPage(props: { searchParams: Promise<{ caseId?: string }> }) {
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
    include: { case: true },
  });

  // Filter cases where the user actually has 'upload' permissions based on ABAC
  const uploadableCases = assignments
    .filter((row) =>
      evaluateAccess({
        role: user.role,
        assigned: true,
        caseClassification: row.case.classification,
        action: "upload",
      }).allowed
    )
    .map((row) => ({
      id: row.case.id,
      caseNumber: row.case.caseNumber,
      title: row.case.title,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-navy">Document upload</h1>
        <p className="text-sm text-slate-600">
          Upload PDF, JPG, or PNG files. Files are AES-256 encrypted at rest and SHA-256 hashed.
        </p>
      </div>
      <UploadForm cases={uploadableCases} />
    </div>
  );
}
