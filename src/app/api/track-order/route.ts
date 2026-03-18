import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { trackOrderSchema } from "@/lib/validation";
import { fail, ok } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await checkRateLimit(`track:${ip}`, 40, 60_000);
  if (!limit.allowed) {
    return fail("Tracking rate limit exceeded. Try again later.", 429);
  }

  const json = await request.json().catch(() => null);
  const parsed = trackOrderSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Invalid tracking payload.", 400, { issues: parsed.error.flatten() });
  }

  const order = await prisma.order.findFirst({
    where: {
      orderCode: parsed.data.orderCode,
      phone: parsed.data.phone,
    },
    include: {
      statusLogs: {
        orderBy: { createdAt: "asc" },
      },
      items: true,
    },
  });

  if (!order) {
    return fail("Order not found for provided credentials.", 404);
  }

  return ok({
    order: {
      id: order.id,
      orderCode: order.orderCode,
      status: order.status,
      totalInr: order.totalInr,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items,
      timeline: order.statusLogs.map((log) => ({
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        note: log.note,
        createdAt: log.createdAt,
      })),
    },
  });
}

