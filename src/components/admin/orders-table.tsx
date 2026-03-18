"use client";

import { useState } from "react";
import { OrderStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { formatDateTimeIst } from "@/lib/time";

const ALL_STATUSES: OrderStatus[] = [
  "PLACED",
  "CONFIRMED",
  "PRODUCTION",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "FAILED_NOTIFICATION",
];

type OrderRow = {
  id: string;
  orderCode: string;
  customerName: string;
  phone: string;
  totalInr: number;
  status: OrderStatus;
  createdAt: string;
};

export function OrdersTable({
  initialOrders,
  counters,
}: {
  initialOrders: OrderRow[];
  counters: Record<string, number>;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, OrderStatus>>(
    Object.fromEntries(initialOrders.map((order) => [order.id, order.status])),
  );
  const [error, setError] = useState<string | null>(null);

  const updateStatus = async (orderId: string) => {
    const nextStatus = statusDrafts[orderId];
    if (!nextStatus) {
      return;
    }

    setPendingId(orderId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, note: "Updated from admin dashboard" }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update status.");
      }

      setOrders((prev) => prev.map((item) => (item.id === orderId ? { ...item, status: data.status } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Order Status Counters</h2>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-2 text-xs text-[#000000]">
          {Object.entries(counters).map(([status, count]) => (
            <span key={status} className="rounded-full border border-[#ffffff]/80 bg-[#ffffff]/72 px-3 py-1">
              {status}: {count}
            </span>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Orders</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-xl border border-[#ffffff]/80 bg-[#ffffff]/65 p-3 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{order.orderCode}</p>
                  <p className="text-xs text-[#000000]">
                    {order.customerName} | {order.phone} | Rs {order.totalInr}
                  </p>
                  <p className="text-xs text-[#000000]">{formatDateTimeIst(order.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={statusDrafts[order.id]}
                    onChange={(event) =>
                      setStatusDrafts((prev) => ({
                        ...prev,
                        [order.id]: event.target.value as OrderStatus,
                      }))
                    }
                    className="min-w-[180px]"
                  >
                    {ALL_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Select>
                  <Button onClick={() => void updateStatus(order.id)} disabled={pendingId === order.id}>
                    {pendingId === order.id ? "Updating..." : "Update"}
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {orders.length === 0 && <p className="text-sm text-[#000000]">No orders available yet.</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
        </CardBody>
      </Card>
    </div>
  );
}




