import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/rbac";
import { ROLE_POLICY } from "@/lib/auth/abac";

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  if (auth.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      station: true,
      department: true,
      mfaEnabled: true,
      assignments: { include: { case: { select: { caseNumber: true } } } },
    },
  });

  const policies = await prisma.accessPolicy.findMany();

  return NextResponse.json({
    users,
    policies,
    runtimePolicy: ROLE_POLICY,
    note: "Admin cannot silently bypass case ABAC. Opening unassigned cases is denied and logged.",
  });
}
