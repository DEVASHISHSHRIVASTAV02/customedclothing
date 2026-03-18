import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Return and Refunds Policy | CUSTOMED",
  description: "Review eligibility, timelines, and process for returns, replacements, and refunds at CUSTOMED.",
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

export default function ReturnAndRefundsPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <header className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#000000]">Legal</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#000000] md:text-5xl">
            Return and Refunds Policy
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#000000] md:text-base">Last updated: March 17, 2026</p>
          <p className="mt-3 text-sm leading-relaxed text-[#000000] md:text-base">
            Because CUSTOMED products are made-to-order, return and refund eligibility is limited. Please read this
            policy carefully before placing an order.
          </p>
        </header>

        <main className="mt-8 space-y-5">
          <PolicySection title="1. Nature of Custom Products">
            <p>
              Most CUSTOMED items are personalized and produced specifically for your order. Therefore, returns or
              exchanges are generally not accepted for reasons such as change of mind, wrong size selected by customer,
              or preference changes after production starts.
            </p>
          </PolicySection>

          <PolicySection title="2. Eligible Cases for Return or Replacement">
            <p>You may request support if any of the following applies:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>You received the wrong product or wrong design.</li>
              <li>You received a damaged or tampered product.</li>
              <li>The product has a clear manufacturing defect.</li>
              <li>You received an incomplete order.</li>
            </ul>
          </PolicySection>

          <PolicySection title="3. Raise a Request Timeline">
            <p>
              Raise your return/replacement/refund request within 48 hours of delivery through our{" "}
              <Link href="/contact" className="font-medium text-[#000000] underline underline-offset-4">
                Contact Us
              </Link>{" "}
              page and include your order ID.
            </p>
            <p>
              To help with verification, share clear photos of the product, package label, and unboxing proof where
              available.
            </p>
          </PolicySection>

          <PolicySection title="4. Verification and Resolution">
            <p>
              Our team reviews all requests and may offer one of the following resolutions based on case validity:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Replacement of the affected item.</li>
              <li>Store credit for future purchase.</li>
              <li>Refund to the original payment mode (for eligible prepaid orders).</li>
            </ul>
          </PolicySection>

          <PolicySection title="5. Non-Eligible Cases">
            <ul className="list-disc space-y-2 pl-5">
              <li>Minor color variation due to screen/display differences.</li>
              <li>Issues arising from incorrect size or customization data entered by customer.</li>
              <li>Requests submitted after the review window without valid reason.</li>
              <li>Damage caused after successful delivery and acceptance.</li>
            </ul>
          </PolicySection>

          <PolicySection title="6. Refund Timelines">
            <p>
              Once approved, refunds for prepaid orders are generally processed within 5 to 10 business days. Actual
              credit timelines depend on your bank, card network, or payment provider.
            </p>
          </PolicySection>

          <PolicySection title="7. Cancellation and Payment Linkage">
            <p>
              For cancellations before production starts, please refer to our{" "}
              <Link href="/cancellation-policy" className="font-medium text-[#000000] underline underline-offset-4">
                Cancellation Policy
              </Link>
              . Payment-specific conditions are described in our{" "}
              <Link href="/payment-policy" className="font-medium text-[#000000] underline underline-offset-4">
                Payment Policy
              </Link>
              .
            </p>
          </PolicySection>

          <PolicySection title="8. Contact for Returns and Refunds">
            <p>
              For assistance, use the{" "}
              <Link href="/contact" className="font-medium text-[#000000] underline underline-offset-4">
                Contact Us
              </Link>{" "}
              page with your order ID, delivery date, and issue details.
            </p>
          </PolicySection>
        </main>
      </div>

      <SiteFooter />
    </>
  );
}
