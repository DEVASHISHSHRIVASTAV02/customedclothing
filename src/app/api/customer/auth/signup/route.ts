import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeCustomerLoginId } from "@/lib/customer-auth";
import { sendCustomerWelcomeEmail } from "@/lib/notifications";
import { customerAuthSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await checkRateLimit(`customer-signup:${ip}`, 20, 10 * 60_000);
  if (!limit.allowed) {
    return fail("Too many signup attempts. Please wait and retry.", 429);
  }

  const json = await request.json().catch(() => null);
  const parsed = customerAuthSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Invalid signup payload.", 400, { issues: parsed.error.flatten() });
  }

  let normalized;
  try {
    normalized = normalizeCustomerLoginId(parsed.data.login);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid login identifier.";
    return fail(detail, 400);
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    const customer = await prisma.customerUser.create({
      data: {
        loginId: normalized.loginId,
        email: normalized.email,
        phone: normalized.phone,
        passwordHash,
      },
      select: {
        id: true,
        loginId: true,
        email: true,
        phone: true,
      },
    });

    if (customer.email) {
      const welcomeEmail = await sendCustomerWelcomeEmail({
        toEmail: customer.email,
        loginId: customer.loginId,
      });

      if (!welcomeEmail.sent) {
        const reason = welcomeEmail.error ?? "Unknown welcome email error.";
        console.warn(`[customer-signup] Account ${customer.id} created but welcome email was not sent: ${reason}`);
      }
    }

    return ok({
      customer,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("An account already exists with this email ID or phone number.", 409);
    }

    const detail = error instanceof Error ? error.message : "Unexpected error.";
    return fail(
      "Unable to create account right now. Please try again.",
      500,
      process.env.NODE_ENV === "development" ? { detail } : undefined,
    );
  }
}
