import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { adminLoginSchema } from "@/lib/validation";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await checkRateLimit(`admin-login:${ip}`, 12, 10 * 60_000);
  if (!limit.allowed) {
    return fail("Too many login attempts. Please wait and retry.", 429);
  }

  const json = await request.json().catch(() => null);
  const parsed = adminLoginSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Invalid login payload.", 400, { issues: parsed.error.flatten() });
  }

  const admin = await prisma.adminUser.findUnique({
    where: { email: parsed.data.email.toLowerCase().trim() },
  });

  if (!admin || !admin.active) {
    return fail("Invalid credentials.", 401);
  }

  const isValid = await bcrypt.compare(parsed.data.password, admin.passwordHash);
  if (!isValid) {
    return fail("Invalid credentials.", 401);
  }

  return ok({
    success: true,
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    },
    hint: "For admin dashboard sessions, authenticate through NextAuth credentials provider.",
  });
}

