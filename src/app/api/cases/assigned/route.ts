import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const assignments = await prisma.caseAssignment.findMany({
      where: { userId: user.id },
      include: {
        case: {
          select: { id: true, caseNumber: true, title: true }
        }
      }
    });

    const cases = assignments.map(a => a.case);
    
    return NextResponse.json({ cases });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
