import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Cancellation Policy | CUSTOMED",
  description: "Read when and how CUSTOMED orders can be cancelled and what refund conditions apply.",
};

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-[#ffffff]/80 bg-[#ffffff] p-6 shadow-[0_12px_28px_rgba(0,0,0,0.08)] backdrop-blur-md">
      <h2 className="text-xl font-semibold tracking-tight text-[#000000]">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-[#000000] md:text-base">{children}</div>
    </section>
  );
}

export default function CancellationPolicyPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <header className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#000000]">Legal</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#000000] md:text-5xl">
            Cancellation Policy
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#000000] md:text-base">Last updated: March 17, 2026</p>
          <p className="mt-3 text-sm leading-relaxed text-[#000000] md:text-base">
            This policy explains when order cancellation is possible and how related refunds are handled.
          </p>
        </header>

        <main className="mt-8 space-y-5">
          <PolicySection title="1. Cancellation Window">
            <p>
              Cancellation requests are accepted only before production begins. Since most CUSTOMED products are
              personalized, orders move quickly into production and may become non-cancellable.
            </p>
          </PolicySection>

          <PolicySection title="2. How to Request Cancellation">
            <p>
              Submit your cancellation request through our{" "}
              <Link href="/contact" className="font-medium text-[#000000] underline underline-offset-4">
                Contact Us
              </Link>{" "}
              page with your order ID, registered phone number, and reason for cancellation.
            </p>
          </PolicySection>

          <PolicySection title="3. When Cancellation May Not Be Possible">
            <ul className="list-disc space-y-2 pl-5">
              <li>Order is already in production or quality-check stage.</li>
              <li>Order has been packed, dispatched, or marked shipped with courier tracking.</li>
              <li>Custom artwork has been finalized and moved to print workflow.</li>
            </ul>
          </PolicySection>

          <PolicySection title="4. Prepaid Orders and Refunds">
            <p>
              If a valid cancellation is approved before production, prepaid amounts are refunded to the original
              payment mode. Refund processing typically takes 5 to 10 business days after approval.
            </p>
          </PolicySection>

          <PolicySection title="5. Cash on Delivery (COD) Orders">
            <p>
              COD orders can also be cancelled before production starts. Repeated non-serious COD cancellations may
              result in temporary or permanent restriction of COD for future orders.
            </p>
          </PolicySection>

          <PolicySection title="6. Cancellations by CUSTOMED">
            <p>In rare cases we may cancel an order due to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Product or serviceability constraints.</li>
              <li>Pricing or technical errors.</li>
              <li>Suspected fraudulent activity.</li>
              <li>Policy-violating or restricted design content.</li>
            </ul>
            <p>If a prepaid order is cancelled by us, the amount is refunded as applicable.</p>
          </PolicySection>

          <PolicySection title="7. Linked Policies">
            <p>
              Please also review our{" "}
              <Link href="/return-and-refunds" className="font-medium text-[#000000] underline underline-offset-4">
                Return and Refunds Policy
              </Link>{" "}
              and{" "}
              <Link href="/terms-and-conditions" className="font-medium text-[#000000] underline underline-offset-4">
                Terms and Conditions
              </Link>{" "}
              for complete order rules.
            </p>
          </PolicySection>
        </main>
      </div>

      <SiteFooter />
    </>
  );
}
