import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "nv_session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  station?: string;
  department?: string;
  jti?: string;
  sessionCreatedAt?: Date;
};

function secretKey() {
  return new TextEncoder().encode(env.sessionSecret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  await prisma.session.create({
    data: {
      userId: user.id,
      jti,
      expiresAt,
    }
  });

  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    jti,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("8h") // Absolute cap for the JWT signature
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub || !payload.email || !payload.role || !payload.name) {
      return null;
    }
    return {
      id: payload.sub,
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
      station: payload.station as string | undefined,
      department: payload.department as string | undefined,
      jti: payload.jti as string | undefined,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const decoded = await verifySessionToken(token);
  if (!decoded) return null;
  
  // Verify user still exists in the DB (prevents crashes after db:seed)
  // SECURITY FIX: Overwrite the JWT's baked role with the fresh role from the database 
  // to ensure instant revocation if a user is demoted in production.
  const exists = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!exists) return null;
  
  if (decoded.jti) {
    const sessionExists = await prisma.session.findUnique({ where: { jti: decoded.jti } });
    if (!sessionExists || sessionExists.expiresAt < new Date()) {
      return null;
    }
    // Update expiresAt if it is older than 5 minutes to support sliding timeout
    if (sessionExists.expiresAt.getTime() - Date.now() < 25 * 60 * 1000) {
       await prisma.session.update({
         where: { jti: decoded.jti },
         data: { expiresAt: new Date(Date.now() + 30 * 60 * 1000) }
       }).catch(() => {});
    }
  }

  return { 
    ...decoded, 
    role: exists.role, 
    station: exists.station || undefined, 
    department: exists.department || undefined,
    sessionCreatedAt: decoded.jti ? (await prisma.session.findUnique({ where: { jti: decoded.jti } }))?.createdAt : undefined
  };
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60, // 8 hours absolute limit
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
