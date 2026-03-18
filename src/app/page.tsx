import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

const highlights = [
  "Step 1 - Select the T-Shirt.",
  "Step 2 - Select the colour and size of the item.",
  "Step 3 - Add text that you want.",
  "Step 4 - Add image/screenshot that you want.",
  "Step 5 - Free hand paint with multiple tools.",
  "Step 6 - Review your item in 360 degree.",
  "Step 7 - Enter shipping details and place the order."
];

export default function HomePage() {
  return (
    <>
      <div className="relative z-10">
        <div className="mx-auto w-full max-w-7xl px-6 pb-20 pt-14">
          <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.22em] text-[#000000]">Clothing customization Studio</p>
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-[#000000] md:text-6xl">
                Design your own apparel in 6 steps and wear what you want
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-[#000000] md:text-lg">
                Choose product, pick color, add text or images, paint freely, rotate in 360 view, and place your order.
                Built for India pricing in INR with trackable order IDs.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/customize">
                  <Button
                    variant="ghost"
                    className="h-11 border border-[#000000] bg-[#000000] px-6 text-[#ffffff] hover:border-[#000000] hover:bg-[#ffffff] hover:text-[#000000]"
                  >
                    Start Designing
                  </Button>
                </Link>
                <Link href="/track-order">
                  <Button
                    variant="ghost"
                    className="h-11 border border-[#000000] bg-[#000000] px-6 text-[#ffffff] hover:border-[#000000] hover:bg-[#ffffff] hover:text-[#000000]"
                  >
                    Track Existing Order
                  </Button>
                </Link>
              </div>
            </div>

            <Card className="overflow-hidden">
              <CardBody className="space-y-4 p-6">
                <div className="rounded-2xl border border-[#000000] bg-[#000000] p-4">
                  <p className="text-sm font-medium text-[#ffffff]">Launch collection</p>
                  <p className="mt-2 text-sm text-[#ffffff]">
                    T-Shirt
                  </p>
                </div>
                <ul className="space-y-3">
                  {highlights.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-3 rounded-xl border border-[#ffffff]/80 bg-[#ffffff] px-4 py-3 text-sm text-[#000000]"
                    >
                      <span className="h-2 w-2 rounded-full bg-[#000000]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </section>
        </div>
        <SiteFooter />
      </div>
    </>
  );
}




