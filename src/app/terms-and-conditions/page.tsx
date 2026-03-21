import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Terms and Conditions | Customed Clothing",
  description: "Review the terms and conditions for using Customed Clothing and placing orders.",
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

export default function TermsAndConditionsPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <header className="max-w-3xl border-b border-[#000000]/20 pb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-[#000000]">Legal</p>
          <h1 className="mt-2 text-5xl font-semibold tracking-tight text-[#000000] md:text-6xl">
            Terms and Conditions
          </h1>
          <p className="mt-3 text-base leading-relaxed text-[#000000] md:text-lg">Last updated: March 17, 2026</p>
          <p className="mt-3 text-base leading-relaxed text-[#000000] md:text-lg">
            These Terms and Conditions govern your use of Customed Clothing and all purchases made through our platform.
          </p>
        </header>

        <main className="mt-8 space-y-7">
          <PolicySection title="Acceptance of Terms">
            <p>
              By accessing or using Customed Clothing, you agree to be bound by these Terms and Conditions, our Privacy Policy,
              and all related policies published on this website.
            </p>
          </PolicySection>

          <PolicySection title="Eligibility and Account Responsibility">
            <ul className="list-disc space-y-2 pl-5">
              <li>You must provide accurate and complete information while creating an account or placing orders.</li>
              <li>You are responsible for keeping your account credentials secure and for all activity under your account.</li>
              <li>We may suspend or terminate accounts involved in misuse, fraud, or policy violations.</li>
            </ul>
          </PolicySection>

          <PolicySection title="Custom Content and Intellectual Property">
            <ul className="list-disc space-y-2 pl-5">
              <li>You are solely responsible for text, images, logos, or artwork submitted for customization.</li>
              <li>
                You confirm that your submitted content does not violate copyright, trademark, publicity, privacy, or
                any other third-party rights.
              </li>
              <li>
                We reserve the right to reject, remove, or refuse to print content that is unlawful, abusive,
                defamatory, explicit, hateful, or infringing.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="Product Representation and Quality">
            <p>
              We make reasonable efforts to display product previews accurately. Final print output may vary slightly
              due to screen settings, fabric texture, print method, and production tolerances.
            </p>
          </PolicySection>

          <PolicySection title="Orders, Pricing, and Acceptance">
            <ul className="list-disc space-y-2 pl-5">
              <li>All orders are subject to acceptance and serviceability.</li>
              <li>Prices, offers, and product availability may change without prior notice.</li>
              <li>
                We may cancel or hold an order in case of pricing errors, suspected fraud, or incomplete order
                information.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="Policy Links for Checkout and Fulfillment">
            <p>Order-related terms are also governed by the following policy pages:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <Link href="/shipping-policy" className="font-medium text-[#000000] underline underline-offset-4">
                  Shipping Policy
                </Link>
              </li>
              <li>
                <Link href="/return-and-refunds" className="font-medium text-[#000000] underline underline-offset-4">
                  Return and Refunds Policy
                </Link>
              </li>
              <li>
                <Link href="/cancellation-policy" className="font-medium text-[#000000] underline underline-offset-4">
                  Cancellation Policy
                </Link>
              </li>
              <li>
                <Link href="/payment-policy" className="font-medium text-[#000000] underline underline-offset-4">
                  Payment Policy
                </Link>
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="Prohibited Use">
            <p>You agree not to misuse the platform by:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Attempting unauthorized access to any account, system, or data.</li>
              <li>Uploading malware, harmful scripts, or disruptive content.</li>
              <li>Using Customed Clothing for unlawful transactions or prohibited goods/services.</li>
            </ul>
          </PolicySection>

          <PolicySection title="Limitation of Liability">
            <p>
              To the maximum extent permitted by law, Customed Clothing is not liable for indirect, incidental, special, or
              consequential damages arising from your use of the website or purchase of products.
            </p>
          </PolicySection>

          <PolicySection title="Indemnity">
            <p>
              You agree to indemnify and hold harmless Customed Clothing, its team, and service providers from claims, losses,
              liabilities, and expenses arising from your content submissions, policy violations, or unlawful use of
              the platform.
            </p>
          </PolicySection>

          <PolicySection title="Governing Law and Jurisdiction">
            <p>
              These terms are governed by the laws of India. Any disputes are subject to the courts in Bengaluru,
              Karnataka, unless otherwise required by applicable consumer law.
            </p>
          </PolicySection>

          <PolicySection title="Policy Updates">
            <p>
              We may revise these Terms and Conditions at any time. Updated versions will be posted on this page with
              a revised effective date.
            </p>
          </PolicySection>

          <PolicySection title="Contact Us">
            <p>
              For questions regarding these terms, please use our{" "}
              <Link href="/contact" className="font-medium text-[#000000] underline underline-offset-4">
                Contact Us
              </Link>{" "}
              page.
            </p>
          </PolicySection>
        </main>
      </div>

      <SiteFooter />
    </>
  );
}



