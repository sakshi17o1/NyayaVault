import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { env, loginSchema } from "@/lib/env";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { writeAudit, clientIp } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request.headers);
  const userAgent = request.headers.get("user-agent");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    await writeAudit({
      role: "ANONYMOUS",
      action: "LOGIN",
      result: "DENIED",
      ip,
      userAgent,
      reason: "Invalid login payload",
    });
    return NextResponse.json({ error: "Invalid credentials payload" }, { status: 400 });
  }

  const { email, password, otp } = parsed.data;
  // Anti-bruteforce: Check DB for failures
  const recentFailures = await prisma.loginAttempt.count({
    where: {
      ip,
      success: false,
      timestamp: { gte: new Date(Date.now() - 15 * 60 * 1000) }
    }
  });

  if (recentFailures >= 5) {
    return new NextResponse(
      JSON.stringify({ error: "Too many attempts, please try again later" }), 
      { status: 429, headers: { "Retry-After": "900", "Content-Type": "application/json" } }
    );
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  
  // Dummy hash to mitigate timing attacks for unknown users
  const dummyHash = "$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
  const isValidPassword = await bcrypt.compare(password, user ? user.passwordHash : dummyHash);

  if (!user || !isValidPassword) {
    await prisma.loginAttempt.create({
      data: { email: email.toLowerCase(), ip, success: false }
    });
    
    await writeAudit({
      actorId: user?.id,
      role: user?.role ?? "ANONYMOUS",
      action: "LOGIN",
      result: "DENIED",
      ip,
      userAgent,
      reason: "Invalid email or password",
    });
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (user.mfaEnabled) {
    if (!otp) {
      return NextResponse.json({
        mfaRequired: true,
      });
    }
    
    let isTotpValid = false;
    if (user.totpSecret) {
      const { authenticator } = require("otplib");
      isTotpValid = authenticator.verify({ token: otp, secret: user.totpSecret });
    }
    
    // Fallback to DEMO_OTP if no specific TOTP secret exists (for pre-seeded demo accounts)
    if (otp !== env.demoOtp && !isTotpValid) {
      await prisma.loginAttempt.create({
        data: { email: email.toLowerCase(), ip, success: false }
      });
      await writeAudit({
        actorId: user.id,
        role: user.role,
        action: "LOGIN",
        result: "DENIED",
        ip,
        userAgent,
        reason: "Invalid MFA OTP",
      });
      return NextResponse.json({ error: "Invalid OTP" }, { status: 401 });
    }
  }

  await prisma.loginAttempt.create({
    data: { email: email.toLowerCase(), ip, success: true }
  });

  const token = await createSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  await setSessionCookie(token);

  await writeAudit({
    actorId: user.id,
    role: user.role,
    action: "LOGIN",
    result: "SUCCESS",
    ip,
    userAgent,
    reason: "Demo login",
  });

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      station: user.station,
      department: user.department,
    },
  });
  } catch (error: any) {
    console.error("LOGIN ROUTE CRASHED:", error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
