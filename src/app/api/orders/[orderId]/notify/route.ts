import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { dispatchOrderNotifications } from "@/lib/notifications";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

function hasValidInternalSecret(request: NextRequest) {
  const expected = process.env.INTERNAL_NOTIFY_SECRET?.trim();
  const provided = request.headers.get("x-internal-notify-secret")?.trim();

  if (!expected || !provided) {
    return false;
  }

  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const adminSession = await getAdminSession();
  if (!adminSession && !hasValidInternalSecret(request)) {
    return fail("Unauthorized", 401);
  }

  const { orderId } = await context.params;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return fail("Order not found.", 404);
  }

  const results = await dispatchOrderNotifications(orderId);
  return ok({ orderId, results });
}

