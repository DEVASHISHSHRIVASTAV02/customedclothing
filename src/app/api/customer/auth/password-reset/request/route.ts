import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import {
  generatePasswordResetOtp,
  getPasswordResetOtpExpiryDate,
  getPasswordResetOtpTtlMinutes,
  hashPasswordResetOtp,
  normalizeResetEmail,
} from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendCustomerPasswordResetOtpEmail } from "@/lib/notifications";
import { passwordResetRequestSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipLimit = await checkRateLimit(`customer-password-reset-request:${ip}`, 10, 10 * 60_000);
  if (!ipLimit.allowed) {
    return fail("Too many OTP requests. Please wait and retry.", 429);
  }

  const json = await request.json().catch(() => null);
  const parsed = passwordResetRequestSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Invalid password reset request payload.", 400, { issues: parsed.error.flatten() });
  }

  const email = normalizeResetEmail(parsed.data.email);
  const identityLimit = await checkRateLimit(`customer-password-reset-request-email:${email}`, 4, 10 * 60_000);
  if (!identityLimit.allowed) {
    return ok({ requested: true });
  }

  try {
    const customer = await prisma.customerUser.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!customer?.email) {
      return ok({ requested: true });
    }

    const otp = generatePasswordResetOtp();
    const otpHash = hashPasswordResetOtp(otp);
    const expiresAt = getPasswordResetOtpExpiryDate();

    await prisma.$transaction([
      // Keep only one active OTP record per customer by clearing older records.
      prisma.passwordResetOtp.deleteMany({
        where: {
          customerId: customer.id,
        },
      }),
      prisma.passwordResetOtp.create({
        data: {
          customerId: customer.id,
          email: customer.email,
          otpHash,
          expiresAt,
        },
      }),
    ]);

    const delivery = await sendCustomerPasswordResetOtpEmail({
      toEmail: customer.email,
      otp,
      expiresInMinutes: getPasswordResetOtpTtlMinutes(),
    });

    if (!delivery.sent) {
      const reason = delivery.error ?? "Unknown password reset OTP email error.";
      console.warn(`[password-reset] OTP created for ${customer.id}, but email delivery failed: ${reason}`);
    }

    return ok({ requested: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unexpected error.";
    return fail(
      "Unable to process password reset right now. Please try again.",
      500,
      process.env.NODE_ENV === "development" ? { detail } : undefined,
    );
  }
}
