import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { writeAudit, clientIp } from "@/lib/audit";

export async function requireSession(): Promise<
  { user: SessionUser } | { response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }
  return { user };
}

export async function requireRecentAuth(maxAgeMinutes: number = 15): Promise<
  { user: SessionUser } | { response: NextResponse }
> {
  const auth = await requireSession();
  if ("response" in auth) return auth;

  const createdAt = auth.user.sessionCreatedAt;
  if (!createdAt || (Date.now() - new Date(createdAt).getTime() > maxAgeMinutes * 60 * 1000)) {
    return {
      response: NextResponse.json({ error: "Re-authentication required for this sensitive action" }, { status: 401 }),
    };
  }

  return auth;
}

export async function denyUnauthenticated(request: Request) {
  await writeAudit({
    role: "ANONYMOUS",
    action: "ACCESS_DENIED",
    result: "DENIED",
    ip: clientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    reason: "No session",
  });
}
