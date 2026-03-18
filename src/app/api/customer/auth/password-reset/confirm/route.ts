import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import { getPasswordResetOtpMaxAttempts, hashPasswordResetOtp, normalizeResetEmail } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { passwordResetConfirmSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipLimit = await checkRateLimit(`customer-password-reset-confirm:${ip}`, 20, 10 * 60_000);
  if (!ipLimit.allowed) {
    return fail("Too many reset attempts. Please wait and retry.", 429);
  }

  const json = await request.json().catch(() => null);
  const parsed = passwordResetConfirmSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Invalid password reset payload.", 400, { issues: parsed.error.flatten() });
  }

  const email = normalizeResetEmail(parsed.data.email);

  try {
    const customer = await prisma.customerUser.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!customer) {
      return fail("Invalid or expired OTP.", 400);
    }

    const now = new Date();
    const activeOtp = await prisma.passwordResetOtp.findFirst({
      where: {
        customerId: customer.id,
        email,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        otpHash: true,
        attempts: true,
      },
    });

    if (!activeOtp) {
      return fail("Invalid or expired OTP.", 400);
    }

    const otpHash = hashPasswordResetOtp(parsed.data.otp);
    if (otpHash !== activeOtp.otpHash) {
      const maxAttempts = getPasswordResetOtpMaxAttempts();
      const nextAttempts = activeOtp.attempts + 1;

      if (nextAttempts >= maxAttempts) {
        await prisma.passwordResetOtp.delete({
          where: { id: activeOtp.id },
        });
      } else {
        await prisma.passwordResetOtp.update({
          where: { id: activeOtp.id },
          data: {
            attempts: { increment: 1 },
          },
        });
      }

      return fail("Invalid or expired OTP.", 400);
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.$transaction([
      prisma.customerUser.update({
        where: { id: customer.id },
        data: {
          passwordHash,
        },
      }),
      // Hard-delete OTP rows right after successful password reset.
      prisma.passwordResetOtp.deleteMany({
        where: {
          customerId: customer.id,
        },
      }),
    ]);

    return ok({ reset: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unexpected error.";
    return fail(
      "Unable to reset password right now. Please try again.",
      500,
      process.env.NODE_ENV === "development" ? { detail } : undefined,
    );
  }
}
