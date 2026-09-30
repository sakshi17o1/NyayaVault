import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { evaluateAccess } from "@/lib/auth/abac";
import { FloatingAssistantClient } from "./FloatingAssistantClient";

export async function FloatingAssistant() {
  const user = await getSessionUser();
  if (!user) return null;

  const assignments = await prisma.caseAssignment.findMany({
    where: { userId: user.id },
    include: { case: true },
  });

  // Filter cases where the user actually has 'view' permissions based on ABAC
  const viewableCases = assignments
    .filter((row) =>
      evaluateAccess({
        role: user.role,
        assigned: true,
        caseClassification: row.case.classification,
        action: "view_case",
      }).allowed
    )
    .map((row) => ({
      id: row.case.id,
      caseNumber: row.case.caseNumber,
      title: row.case.title,
    }));

  return <FloatingAssistantClient viewableCases={viewableCases} />;
}
