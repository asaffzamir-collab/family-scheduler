import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { getSession } from "@/lib/session";

/**
 * GET /api/debug/auth — safe debug info for session/cookie issues.
 * Remove or protect this route in production.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const session = await getSession();
    const headersList = await headers();

    const debug = {
      timestamp: new Date().toISOString(),
      env: {
        NEXTAUTH_URL: process.env.NEXTAUTH_URL ? "set" : "not set",
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "set" : "not set",
        VERCEL: process.env.VERCEL ?? "not set",
        VERCEL_URL: process.env.VERCEL_URL ?? "not set",
        AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? "not set",
      },
      cookies: {
        count: allCookies.length,
        names: allCookies.map((c) => c.name),
        hasNextAuthSession: allCookies.some(
          (c) =>
            c.name === "next-auth.session-token" ||
            c.name === "__Secure-next-auth.session-token"
        ),
      },
      request: {
        host: headersList.get("host") ?? "missing",
        "x-forwarded-host": headersList.get("x-forwarded-host") ?? "missing",
        "x-forwarded-proto": headersList.get("x-forwarded-proto") ?? "missing",
      },
      session: session
        ? {
            hasSession: true,
            userId: session.user?.id ?? "missing",
            email: session.user?.email ?? "missing",
          }
        : { hasSession: false, reason: "getSession() returned null" },
    };

    return NextResponse.json(debug);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: "Debug endpoint failed",
        message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
