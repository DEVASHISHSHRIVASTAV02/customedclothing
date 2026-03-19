import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);
type AuthRouteContext = {
  params: Promise<{ nextauth: string[] }>;
};
const ADMIN_LOGIN_LIMIT = 12;
const ADMIN_LOGIN_WINDOW_MS = 10 * 60_000;

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstHop = forwarded.split(",")[0]?.trim();
    if (firstHop) {
      return firstHop;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}

function isAdminCredentialsCallback(request: NextRequest) {
  if (request.method !== "POST") {
    return false;
  }

  const normalizedPath = request.nextUrl.pathname.replace(/\/+$/, "");
  return normalizedPath.endsWith("/api/auth/callback/admin-credentials");
}

function invokeNextAuth(
  request: NextRequest,
  context: AuthRouteContext,
) {
  return (handler as unknown as (req: NextRequest, ctx: AuthRouteContext) => ReturnType<typeof handler>)(
    request,
    context,
  );
}

export function GET(request: NextRequest, context: AuthRouteContext) {
  return invokeNextAuth(request, context);
}

export async function POST(request: NextRequest, context: AuthRouteContext) {
  if (isAdminCredentialsCallback(request)) {
    const ip = getClientIp(request);
    const limit = await checkRateLimit(`nextauth-admin-login:${ip}`, ADMIN_LOGIN_LIMIT, ADMIN_LOGIN_WINDOW_MS);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please wait and retry." },
        { status: 429 },
      );
    }
  }

  return invokeNextAuth(request, context);
}

