import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Payment Policy | CUSTOMED",
  description: "Learn about supported payment methods, payment verification, and transaction handling at CUSTOMED.",
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

export default function PaymentPolicyPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <header className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#000000]">Legal</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#000000] md:text-5xl">Payment Policy</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#000000] md:text-base">Last updated: March 17, 2026</p>
          <p className="mt-3 text-sm leading-relaxed text-[#000000] md:text-base">
            This Payment Policy explains the payment methods and transaction terms for orders placed on CUSTOMED.
          </p>
        </header>

        <main className="mt-8 space-y-5">
          <PolicySection title="1. Supported Payment Methods">
            <p>Depending on availability and location, CUSTOMED may offer:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Cash on Delivery (COD) for eligible pin codes and order values.</li>
              <li>Online payments through secure gateways (UPI, cards, net banking, wallets).</li>
            </ul>
          </PolicySection>

          <PolicySection title="2. Pricing, Taxes, and Charges">
            <p>
              Product prices are shown on the website at checkout. Applicable taxes and shipping charges (if any) are
              displayed before order confirmation.
            </p>
          </PolicySection>

          <PolicySection title="3. Payment Authorization and Verification">
            <p>
              For online transactions, successful payment authorization is required to confirm your order. In select
              cases, we may perform additional verification checks for security or fraud prevention.
            </p>
          </PolicySection>

          <PolicySection title="4. Failed or Incomplete Transactions">
            <ul className="list-disc space-y-2 pl-5">
              <li>If payment fails, your order may remain unconfirmed.</li>
              <li>If amount is debited but order is not confirmed, reversal is usually initiated automatically.</li>
              <li>Bank-side posting timelines may vary based on payment provider rules.</li>
            </ul>
          </PolicySection>

          <PolicySection title="5. Duplicate Payments">
            <p>
              If duplicate payment occurs for the same order, contact us with transaction references. After verification,
              the excess amount is refunded to the original payment source.
            </p>
          </PolicySection>

          <PolicySection title="6. Cash on Delivery (COD) Conditions">
            <ul className="list-disc space-y-2 pl-5">
              <li>COD availability depends on pincode serviceability and internal risk checks.</li>
              <li>We may limit COD for high-value or repeated non-accepted orders.</li>
              <li>Certain custom or bulk orders may require prepaid confirmation.</li>
            </ul>
          </PolicySection>

          <PolicySection title="7. Invoice and Payment Records">
            <p>
              Order confirmation and transaction records are shared via registered email, SMS, or WhatsApp where
              enabled. Please retain payment references for future support.
            </p>
          </PolicySection>

          <PolicySection title="8. Refunds for Cancelled or Eligible Orders">
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

          <PolicySection title="9. Security and Fraud Prevention">
            <p>
              We use trusted third-party gateways for processing online payments and do not intentionally store full
              card data on application servers. Suspicious transactions may be held, reviewed, or declined.
            </p>
          </PolicySection>

          <PolicySection title="10. Contact for Payment Help">
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
