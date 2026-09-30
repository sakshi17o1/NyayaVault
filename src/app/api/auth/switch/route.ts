import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { createSessionToken, getSessionUser, setSessionCookie } from "@/lib/auth/session";
import { writeAudit, clientIp } from "@/lib/audit";

const schema = z.object({ userId: z.string().min(1) });

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const current = await getSessionUser();
  if (!current) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!env.demoRoleSwitch) {
    return NextResponse.json({ error: "Role switcher disabled" }, { status: 403 });
  }
  if (!current.email.endsWith("@nyayavault.demo")) {
    return NextResponse.json({ error: "Only demo accounts can switch roles" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) {
    return NextResponse.json({ error: "Unknown demo user" }, { status: 404 });
  }
  if (!target.email.endsWith("@nyayavault.demo")) {
    return NextResponse.json({ error: "Target is not a demo user" }, { status: 403 });
  }

  const token = await createSessionToken({
    id: target.id,
    email: target.email,
    name: target.name,
    role: target.role,
  });
  await setSessionCookie(token);

  const currentUserExists = await prisma.user.findUnique({ where: { id: current.id } });

  await writeAudit({
    actorId: currentUserExists ? current.id : null,
    role: current.role,
    action: "ROLE_SWITCH",
    result: "SUCCESS",
    ip: clientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    reason: `Presentation switch ${current.email} → ${target.email}`,
    metadata: { from: current.email, to: target.email, toRole: target.role, dbSeedRecover: !currentUserExists },
  });

  return NextResponse.json({
    user: {
      id: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
      station: target.station,
      department: target.department,
    },
  });
}
