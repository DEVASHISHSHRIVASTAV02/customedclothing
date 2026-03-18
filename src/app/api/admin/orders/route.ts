import { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-guard";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const guard = await requireAdminApi();
  if (guard.response) {
    return guard.response;
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as OrderStatus | null;
  const search = url.searchParams.get("search")?.trim();
  const fromDate = url.searchParams.get("from");
  const toDate = url.searchParams.get("to");

  const where = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { orderCode: { contains: search, mode: "insensitive" as const } },
            { customerName: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: new Date(fromDate) } : {}),
            ...(toDate ? { lte: new Date(toDate) } : {}),
          },
        }
      : {}),
  };

  const [orders, counters] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        items: true,
        statusLogs: {
          orderBy: { createdAt: "asc" },
          take: 20,
        },
      },
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
    }),
  ]);

  return ok({
    orders,
    counters: counters.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = item._count._all;
      return acc;
    }, {}),
  });
}

export async function PATCH() {
  return fail("Not implemented. Use /api/admin/orders/:id/status", 405);
}

