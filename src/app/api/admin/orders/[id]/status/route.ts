import { NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { canTransitionStatus } from "@/lib/order-status";
import { updateOrderStatusSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi();
  if (guard.response) {
    return guard.response;
  }

  const { id } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = updateOrderStatusSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Invalid status update payload.", 400, { issues: parsed.error.flatten() });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return fail("Order not found.", 404);
  }

  const target = parsed.data.status;
  if (!canTransitionStatus(order.status, target)) {
    return fail(`Invalid status transition: ${order.status} -> ${target}`, 409);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: { status: target },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: target,
        note: parsed.data.note,
        changedByAdminId: guard.session?.user.id,
      },
    });

    return updatedOrder;
  });

  return ok({
    orderId: result.id,
    status: result.status,
  });
}

