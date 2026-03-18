import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Shipping Policy | CUSTOMED",
  description: "Understand CUSTOMED order processing, shipping timelines, and delivery terms.",
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

export default function ShippingPolicyPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <header className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#000000]">Legal</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#000000] md:text-5xl">Shipping Policy</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#000000] md:text-base">Last updated: March 17, 2026</p>
          <p className="mt-3 text-sm leading-relaxed text-[#000000] md:text-base">
            This Shipping Policy explains how CUSTOMED processes, dispatches, and delivers your orders.
          </p>
        </header>

        <main className="mt-8 space-y-5">
          <PolicySection title="1. Order Processing Timeline">
            <p>
              Most custom orders require production before dispatch. Standard processing time is typically 2 to 5
              business days after order confirmation and design approval, depending on order complexity and volume.
            </p>
          </PolicySection>

          <PolicySection title="2. Estimated Delivery Timeline">
            <ul className="list-disc space-y-2 pl-5">
              <li>Metro cities: usually 2 to 4 business days after dispatch.</li>
              <li>Non-metro and remote areas: usually 4 to 8 business days after dispatch.</li>
              <li>Large bulk/custom business orders may require additional lead time.</li>
            </ul>
            <p>
              Delivery estimates are indicative and may vary based on courier capacity, holidays, weather, and local
              serviceability constraints.
            </p>
          </PolicySection>

          <PolicySection title="3. Shipping Partners and Tracking">
            <p>
              We use third-party courier partners for delivery. Once your order is shipped, tracking details are shared
              via SMS, WhatsApp, or email on your registered contact details.
            </p>
          </PolicySection>

          <PolicySection title="4. Address Accuracy">
            <p>
              Please enter a complete and accurate shipping address, including landmark and pincode. CUSTOMED is not
              responsible for delays or failed delivery resulting from incorrect or incomplete address details.
            </p>
          </PolicySection>

          <PolicySection title="5. Delivery Attempts and Return to Origin">
            <ul className="list-disc space-y-2 pl-5">
              <li>Courier partners generally attempt delivery 2 to 3 times.</li>
              <li>If the order remains undelivered, it may be marked as Return to Origin (RTO).</li>
              <li>
                For prepaid orders returned to origin due to customer unavailability or incorrect address, re-shipping
                charges may apply.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="6. Partial Shipments">
            <p>
              In certain cases, multi-item orders may be shipped in separate packages to improve delivery speed or due
              to production scheduling.
            </p>
          </PolicySection>

          <PolicySection title="7. Damaged or Tampered Package at Delivery">
            <p>
              If a package appears damaged or tampered at the time of delivery, record supporting photos/video and
              report it promptly through our{" "}
              <Link href="/contact" className="font-medium text-[#000000] underline underline-offset-4">
                Contact Us
              </Link>{" "}
              page with your order ID.
            </p>
          </PolicySection>

          <PolicySection title="8. International Shipping">
            <p>
              International shipping is currently limited and may be enabled on request for specific orders. Additional
              duties, taxes, and customs handling (if applicable) are borne by the customer.
            </p>
          </PolicySection>

          <PolicySection title="9. Related Policies">
            <p>For complete order terms, please also review:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <Link href="/cancellation-policy" className="font-medium text-[#000000] underline underline-offset-4">
                  Cancellation Policy
                </Link>
              </li>
              <li>
                <Link href="/return-and-refunds" className="font-medium text-[#000000] underline underline-offset-4">
                  Return and Refunds Policy
                </Link>
              </li>
              <li>
                <Link href="/terms-and-conditions" className="font-medium text-[#000000] underline underline-offset-4">
                  Terms and Conditions
                </Link>
              </li>
            </ul>
          </PolicySection>
        </main>
      </div>

      <SiteFooter />
    </>
  );
}
