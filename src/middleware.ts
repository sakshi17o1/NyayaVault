import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

import { env } from "@/lib/env";

function secret() {
  return new TextEncoder().encode(env.sessionSecret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rpm = Number(process.env.RATE_LIMIT_RPM ?? "600");
  const limited = rateLimit(ip, rpm);

  if (!limited.ok && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Rate limit placeholder exceeded" }, { status: 429 });
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public/share/") ||
    PUBLIC_PATHS.includes(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  try {
    const { payload } = await jwtVerify(token, secret());
    
    const response = NextResponse.next();
    
    // Sliding session: if the token is older than 5 minutes, issue a fresh one
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const iat = payload.iat || 0;
    
    if (nowInSeconds - iat > 5 * 60) {
      const { SignJWT } = await import("jose");
      const newToken = await new SignJWT({
        email: payload.email,
        name: payload.name,
        role: payload.role,
        jti: payload.jti as string | undefined,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(payload.sub!)
        .setIssuedAt()
        .setExpirationTime("30m")
        .sign(secret());
        
      response.cookies.set(SESSION_COOKIE, newToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 30 * 60, // 30 minutes in seconds
      });
    }

    return response;
  } catch {
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};