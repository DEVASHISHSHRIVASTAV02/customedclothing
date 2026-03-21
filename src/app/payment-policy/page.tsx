import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Payment Policy | Customed Clothing",
  description: "Learn about supported payment methods, payment verification, and transaction handling at Customed Clothing.",
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

export default function PaymentPolicyPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <header className="max-w-3xl border-b border-[#000000]/20 pb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-[#000000]">Legal</p>
          <h1 className="mt-2 text-5xl font-semibold tracking-tight text-[#000000] md:text-6xl">Payment Policy</h1>
          <p className="mt-3 text-base leading-relaxed text-[#000000] md:text-lg">Last updated: March 17, 2026</p>
          <p className="mt-3 text-base leading-relaxed text-[#000000] md:text-lg">
            This Payment Policy explains the payment methods and transaction terms for orders placed on Customed Clothing.
          </p>
        </header>

        <main className="mt-8 space-y-7">
          <PolicySection title="Supported Payment Methods">
            <p>Depending on availability and location, Customed Clothing may offer:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Cash on Delivery (COD) for eligible pin codes and order values.</li>
              <li>Online payments through secure gateways (UPI, cards, net banking, wallets).</li>
            </ul>
          </PolicySection>

          <PolicySection title="Pricing, Taxes, and Charges">
            <p>
              Product prices are shown on the website at checkout. Applicable taxes and shipping charges (if any) are
              displayed before order confirmation.
            </p>
          </PolicySection>

          <PolicySection title="Payment Authorization and Verification">
            <p>
              For online transactions, successful payment authorization is required to confirm your order. In select
              cases, we may perform additional verification checks for security or fraud prevention.
            </p>
          </PolicySection>

          <PolicySection title="Failed or Incomplete Transactions">
            <ul className="list-disc space-y-2 pl-5">
              <li>If payment fails, your order may remain unconfirmed.</li>
              <li>If amount is debited but order is not confirmed, reversal is usually initiated automatically.</li>
              <li>Bank-side posting timelines may vary based on payment provider rules.</li>
            </ul>
          </PolicySection>

          <PolicySection title="Duplicate Payments">
            <p>
              If duplicate payment occurs for the same order, contact us with transaction references. After verification,
              the excess amount is refunded to the original payment source.
            </p>
          </PolicySection>

          <PolicySection title="Cash on Delivery (COD) Conditions">
            <ul className="list-disc space-y-2 pl-5">
              <li>COD availability depends on pincode serviceability and internal risk checks.</li>
              <li>We may limit COD for high-value or repeated non-accepted orders.</li>
              <li>Certain custom or bulk orders may require prepaid confirmation.</li>
            </ul>
          </PolicySection>

          <PolicySection title="Invoice and Payment Records">
            <p>
              Order confirmation and transaction records are shared via registered email, SMS, or WhatsApp where
              enabled. Please retain payment references for future support.
            </p>
          </PolicySection>

          <PolicySection title="Refunds for Cancelled or Eligible Orders">
            <p>
              Refunds for approved cancellations or eligible cases are processed according to our{" "}
              <Link href="/return-and-refunds" className="font-medium text-[#000000] underline underline-offset-4">
                Return and Refunds Policy
              </Link>{" "}
              and{" "}
              <Link href="/cancellation-policy" className="font-medium text-[#000000] underline underline-offset-4">
                Cancellation Policy
              </Link>
              .
            </p>
          </PolicySection>

          <PolicySection title="Security and Fraud Prevention">
            <p>
              We use trusted third-party gateways for processing online payments and do not intentionally store full
              card data on application servers. Suspicious transactions may be held, reviewed, or declined.
            </p>
          </PolicySection>

          <PolicySection title="Contact for Payment Help">
            <p>
              For payment issues, write to us through our{" "}
              <Link href="/contact" className="font-medium text-[#000000] underline underline-offset-4">
                Contact Us
              </Link>{" "}
              page and include order ID and transaction details.
            </p>
          </PolicySection>
        </main>
      </div>

      <SiteFooter />
    </>
  );
}



