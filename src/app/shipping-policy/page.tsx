import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Shipping Policy | Customed Clothing",
  description: "Understand Customed Clothing order processing, shipping timelines, and delivery terms.",
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

export default function ShippingPolicyPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <header className="max-w-3xl border-b border-[#000000]/20 pb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-[#000000]">Legal</p>
          <h1 className="mt-2 text-5xl font-semibold tracking-tight text-[#000000] md:text-6xl">Shipping Policy</h1>
          <p className="mt-3 text-base leading-relaxed text-[#000000] md:text-lg">Last updated: March 17, 2026</p>
          <p className="mt-3 text-base leading-relaxed text-[#000000] md:text-lg">
            This Shipping Policy explains how Customed Clothing processes, dispatches, and delivers your orders.
          </p>
        </header>

        <main className="mt-8 space-y-7">
          <PolicySection title="Order Processing Timeline">
            <p>
              Most custom orders require production before dispatch. Standard processing time is typically 2 to 5
              business days after order confirmation and design approval, depending on order complexity and volume.
            </p>
          </PolicySection>

          <PolicySection title="Estimated Delivery Timeline">
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

          <PolicySection title="Shipping Partners and Tracking">
            <p>
              We use third-party courier partners for delivery. Once your order is shipped, tracking details are shared
              via SMS, WhatsApp, or email on your registered contact details.
            </p>
          </PolicySection>

          <PolicySection title="Address Accuracy">
            <p>
              Please enter a complete and accurate shipping address, including landmark and pincode. Customed Clothing is not
              responsible for delays or failed delivery resulting from incorrect or incomplete address details.
            </p>
          </PolicySection>

          <PolicySection title="Delivery Attempts and Return to Origin">
            <ul className="list-disc space-y-2 pl-5">
              <li>Courier partners generally attempt delivery 2 to 3 times.</li>
              <li>If the order remains undelivered, it may be marked as Return to Origin (RTO).</li>
              <li>
                For prepaid orders returned to origin due to customer unavailability or incorrect address, re-shipping
                charges may apply.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="Partial Shipments">
            <p>
              In certain cases, multi-item orders may be shipped in separate packages to improve delivery speed or due
              to production scheduling.
            </p>
          </PolicySection>

          <PolicySection title="Damaged or Tampered Package at Delivery">
            <p>
              If a package appears damaged or tampered at the time of delivery, record supporting photos/video and
              report it promptly through our{" "}
              <Link href="/contact" className="font-medium text-[#000000] underline underline-offset-4">
                Contact Us
              </Link>{" "}
              page with your order ID.
            </p>
          </PolicySection>

          <PolicySection title="International Shipping">
            <p>
              International shipping is currently limited and may be enabled on request for specific orders. Additional
              duties, taxes, and customs handling (if applicable) are borne by the customer.
            </p>
          </PolicySection>

          <PolicySection title="Related Policies">
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



