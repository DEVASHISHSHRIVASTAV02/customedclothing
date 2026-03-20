import { Prisma } from "@prisma/client";
import { getCustomerSession } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { deleteStoredDirectory } from "@/lib/storage";
import { parseJsonObject } from "@/lib/utils";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

const ORDER_CANCEL_WINDOW_MS = 12 * 60 * 60 * 1000;

function buildOrderStorageSubdirectory(createdAt: Date, orderCode: string) {
  const year = String(createdAt.getFullYear());
  const month = String(createdAt.getMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${orderCode}`;
}

function normalizeRelativePath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "").trim();
}

function directoryFromRelativePath(value: string) {
  const normalized = normalizeRelativePath(value);
  if (!normalized) {
    return null;
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length <= 1) {
    return null;
  }

  return segments.slice(0, -1).join("/");
}

function collectOrderStorageDirectories(order: {
  createdAt: Date;
  orderCode: string;
  items: Array<{ designExportPathsJson: unknown }>;
}) {
  const directories = new Set<string>();
  directories.add(buildOrderStorageSubdirectory(order.createdAt, order.orderCode));

  for (const item of order.items) {
    const paths = parseJsonObject<Record<string, unknown>>(item.designExportPathsJson, {});
    for (const value of Object.values(paths)) {
      if (typeof value !== "string") {
        continue;
      }

      const directory = directoryFromRelativePath(value);
      if (directory && directory.length > 0) {
        directories.add(directory);
      }
    }
  }

  return Array.from(directories);
}

export async function POST(_request: Request, context: RouteContext) {
  void _request;

  const session = await getCustomerSession();
  if (!session) {
    return fail("Unauthorized", 401);
  }

  const { orderId } = await context.params;
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      customerId: session.user.id,
    },
    select: {
      id: true,
      createdAt: true,
      orderCode: true,
      items: {
        select: {
          designExportPathsJson: true,
        },
      },
    },
  });

  if (!order) {
    return fail("Order not found.", 404);
  }

  const elapsedMs = Date.now() - order.createdAt.getTime();
  if (elapsedMs > ORDER_CANCEL_WINDOW_MS) {
    return fail("Order cancellation window has expired. Orders can be cancelled only within 12 hours.", 409);
  }

  const storageDirectories = collectOrderStorageDirectories(order);
  await Promise.all(
    storageDirectories.map((directory) => deleteStoredDirectory("orders", directory)),
  );

  try {
    await prisma.order.delete({
      where: { id: order.id },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail("Order not found.", 404);
    }

    const detail = error instanceof Error ? error.message : "Unexpected error.";
    return fail(
      "Unable to cancel order right now. Please try again.",
      500,
      process.env.NODE_ENV === "development" ? { detail } : undefined,
    );
  }

  return ok({
    orderId: order.id,
    cancelled: true,
  });
}
