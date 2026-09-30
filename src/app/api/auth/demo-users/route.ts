import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!env.demoRoleSwitch) {
    return NextResponse.json({ error: "Role switcher disabled" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { role: "asc" },
    select: { id: true, email: true, name: true, role: true, station: true },
  });

  return NextResponse.json({ users });
}
