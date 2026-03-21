import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Return and Refunds Policy | Customed Clothing",
  description: "Review eligibility, timelines, and process for returns, replacements, and refunds at Customed Clothing.",
};

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-b border-[#000000]/15 pb-6 last:border-b-0">
      <h2 className="text-xl font-semibold tracking-tight text-[#000000] md:text-2xl">{title}</h2>
      <div className="space-y-3 text-base leading-relaxed text-[#000000] md:text-lg">{children}</div>
    </section>
  );
}

export default function ReturnAndRefundsPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <header className="max-w-3xl border-b border-[#000000]/20 pb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-[#000000]">Legal</p>
          <h1 className="mt-2 text-5xl font-semibold tracking-tight text-[#000000] md:text-6xl">
            Return and Refunds Policy
          </h1>
          <p className="mt-3 text-base leading-relaxed text-[#000000] md:text-lg">Last updated: March 17, 2026</p>
          <p className="mt-3 text-base leading-relaxed text-[#000000] md:text-lg">
            Because Customed Clothing products are made-to-order, return and refund eligibility is limited. Please read this
            policy carefully before placing an order.
          </p>
        </header>

        <main className="mt-8 space-y-7">
          <PolicySection title="Nature of Custom Products">
            <p>
              Most Customed Clothing items are personalized and produced specifically for your order. Therefore, returns or
              exchanges are generally not accepted for reasons such as change of mind, wrong size selected by customer,
              or preference changes after production starts.
            </p>
          </PolicySection>

          <PolicySection title="Eligible Cases for Return or Replacement">
            <p>You may request support if any of the following applies:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>You received the wrong product or wrong design.</li>
              <li>You received a damaged or tampered product.</li>
              <li>The product has a clear manufacturing defect.</li>
              <li>You received an incomplete order.</li>
            </ul>
          </PolicySection>

          <PolicySection title="Raise a Request Timeline">
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

          <PolicySection title="Verification and Resolution">
            <p>
              Our team reviews all requests and may offer one of the following resolutions based on case validity:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Replacement of the affected item.</li>
              <li>Store credit for future purchase.</li>
              <li>Refund to the original payment mode (for eligible prepaid orders).</li>
            </ul>
          </PolicySection>

          <PolicySection title="Non-Eligible Cases">
            <ul className="list-disc space-y-2 pl-5">
              <li>Minor color variation due to screen/display differences.</li>
              <li>Issues arising from incorrect size or customization data entered by customer.</li>
              <li>Requests submitted after the review window without valid reason.</li>
              <li>Damage caused after successful delivery and acceptance.</li>
            </ul>
          </PolicySection>

          <PolicySection title="Refund Timelines">
            <p>
              Once approved, refunds for prepaid orders are generally processed within 5 to 10 business days. Actual
              credit timelines depend on your bank, card network, or payment provider.
            </p>
          </PolicySection>

          <PolicySection title="Cancellation and Payment Linkage">
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

          <PolicySection title="Contact for Returns and Refunds">
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



