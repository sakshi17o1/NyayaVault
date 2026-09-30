import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { assignments: { include: { case: true } } },
  });

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      station: user.station,
      department: user.department,
      mfaEnabled: user.mfaEnabled,
      assignments: user.assignments.map((a) => ({
        caseId: a.caseId,
        caseNumber: a.case.caseNumber,
        title: a.case.title,
        purpose: a.purpose,
      })),
    },
  });
}
