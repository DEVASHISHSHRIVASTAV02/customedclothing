import { AdminRole } from "@prisma/client";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatInr } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function ConfirmationPage({ params }: PageProps) {
  const { orderId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    notFound();
  }

  const isAdmin = session.user.role === AdminRole.ADMIN;

  const order = await prisma.order.findFirst({
    where: isAdmin ? { id: orderId } : { id: orderId, customerId: session.user.id },
    include: {
      items: true,
      notifications: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <Card>
        <CardHeader>
          <p className="text-xs uppercase tracking-[0.2em] text-[#000000]">Order confirmed</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Thank you. Your order is placed.</h1>
        </CardHeader>
        <CardBody className="space-y-4 text-sm text-[#000000]">
          <p>
            <strong>Order ID:</strong> {order.orderCode}
          </p>
          <p>
            <strong>Status:</strong> {order.status}
          </p>
          <p>
            <strong>Total:</strong> {formatInr(order.totalInr)}
          </p>
          <p>
            Use <strong>{order.orderCode}</strong> with your phone number on the tracking page to monitor progress.
          </p>

          {isAdmin && (
            <div className="rounded-xl border border-[#ffffff]/80 bg-[#ffffff]/72 p-3 text-xs text-[#000000]">
              <p className="font-semibold">Notification logs</p>
              {order.notifications.length === 0 ? (
                <p>No notifications dispatched yet.</p>
              ) : (
                order.notifications.slice(0, 5).map((notification) => (
                  <p key={notification.id}>
                    {notification.channel}: {notification.status}
                    {notification.error ? ` (${notification.error})` : ""}
                  </p>
                ))
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Link href="/track-order">
              <Button>Track Order</Button>
            </Link>
            <Link href="/customize">
              <Button variant="ghost">Create Another Design</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
