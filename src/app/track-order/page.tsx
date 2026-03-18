"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTimeIst } from "@/lib/time";

type TimelineItem = {
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
};

type TrackResult = {
  orderCode: string;
  status: string;
  timeline: TimelineItem[];
};

export default function TrackOrderPage() {
  const [orderCode, setOrderCode] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackResult | null>(null);

  const onTrack = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/track-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderCode, phone }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Tracking failed.");
      }

      setResult(data.order);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Tracking failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-6 py-10 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <p className="text-xs uppercase tracking-[0.2em] text-[#000000]">Track order</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Order ID + Phone</h1>
        </CardHeader>
        <CardBody>
          <form onSubmit={onTrack} className="space-y-3">
            <Input required placeholder="Order ID (e.g. CC-20260222-123456)" value={orderCode} onChange={(event) => setOrderCode(event.target.value)} />
            <Input required placeholder="Phone number" value={phone} onChange={(event) => setPhone(event.target.value)} />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Tracking..." : "Track Order"}
            </Button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Status Timeline</h2>
        </CardHeader>
        <CardBody>
          {!result ? (
            <p className="text-sm text-[#000000]">Enter order details to view timeline.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>Order:</strong> {result.orderCode}
              </p>
              <p className="text-sm">
                <strong>Current Status:</strong> {result.status}
              </p>
              <div className="space-y-2">
                {result.timeline.map((item, index) => (
                  <div key={`${item.toStatus}-${index}`} className="rounded-xl border border-[#ffffff]/80 bg-[#ffffff]/72 p-3 text-sm">
                    <p className="font-medium">{item.toStatus}</p>
                    <p className="text-xs text-[#000000]">{formatDateTimeIst(item.createdAt)}</p>
                    {item.note && <p className="mt-1 text-xs text-[#000000]">{item.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}




