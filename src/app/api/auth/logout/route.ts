import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getSessionUser } from "@/lib/auth/session";
import { writeAudit, clientIp } from "@/lib/audit";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  
  if (user?.jti) {
    await prisma.session.delete({ where: { jti: user.jti } }).catch(() => {});
  }

  await writeAudit({
    actorId: user?.id,
    role: user?.role ?? "ANONYMOUS",
    action: "LOGOUT",
    result: "SUCCESS",
    ip: clientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
  });
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
