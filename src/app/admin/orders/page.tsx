import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrdersTable } from "@/components/admin/orders-table";
import { AdminSignOutButton } from "@/components/admin/signout-button";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login?callbackUrl=/admin/orders");
  }

  const [orders, grouped] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
      },
      take: 200,
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
    }),
  ]);

  const counters = grouped.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = item._count._all;
    return acc;
  }, {});

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#000000]">Admin dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Orders</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/admin/catalog"
            className="rounded-xl border border-[#000000] bg-[#000000] px-3 py-2 text-[#ffffff] transition-colors hover:border-[#000000] hover:bg-[#000000] active:border-[#000000] active:bg-[#000000]"
          >
            Catalog
          </Link>
          <AdminSignOutButton />
        </div>
      </div>

      <OrdersTable
        initialOrders={orders.map((order) => ({
          id: order.id,
          orderCode: order.orderCode,
          customerName: order.customerName,
          phone: order.phone,
          totalInr: order.totalInr,
          status: order.status,
          createdAt: order.createdAt.toISOString(),
        }))}
        counters={counters}
      />
    </div>
  );
}




