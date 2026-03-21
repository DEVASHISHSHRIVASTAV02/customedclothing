import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Privacy Policy | Customed Clothing",
  description: "Read how Customed Clothing collects, uses, stores, and protects your personal information.",
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

export default function PrivacyPolicyPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <header className="max-w-3xl border-b border-[#000000]/20 pb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-[#000000]">Legal</p>
          <h1 className="mt-2 text-5xl font-semibold tracking-tight text-[#000000] md:text-6xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-base leading-relaxed text-[#000000] md:text-lg">
            Last updated: February 26, 2026
          </p>
          <p className="mt-3 text-base leading-relaxed text-[#000000] md:text-lg">
            This Privacy Policy explains how Customed Clothing collects, uses, stores, and protects your information when you
            use our website and services.
          </p>
        </header>

        <main className="mt-8 space-y-7">
          <PolicySection title="Scope and Consent">
            <p>
              By accessing or using Customed Clothing, you agree to this Privacy Policy and our handling of information as
              described below. If you do not agree, please discontinue using the website.
            </p>
          </PolicySection>

          <PolicySection title="Information We Collect">
            <p>We may collect the following categories of information:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Account and profile information, including login email ID or phone number and encrypted password
                credentials.
              </li>
              <li>
                Checkout and order information, including name, phone number, email address, shipping address, product
                selection, and order history.
              </li>
              <li>
                Custom design content, including text, artwork, uploaded images, freehand edits, and preview files
                required to process your order.
              </li>
              <li>
                Communication information submitted through our contact forms, order support requests, or follow-up
                conversations.
              </li>
              <li>
                Technical and usage information such as IP address, browser details, device metadata, and cookie or
                session data required for security and website functionality.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="How We Use Your Information">
            <p>We use your information to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Operate and improve the Customed Clothing platform and customization workflow.</li>
              <li>Create, verify, and fulfill customer orders.</li>
              <li>Provide order updates, support communication, and service notifications.</li>
              <li>Detect, prevent, and investigate fraud, abuse, or unauthorized activity.</li>
              <li>Comply with legal obligations and enforce our policies.</li>
            </ul>
          </PolicySection>

          <PolicySection title="Sharing and Disclosure">
            <p>We do not sell your personal information. We may share limited information only when required for:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Service providers that help us run operations such as hosting, storage, email, and messaging.</li>
              <li>Logistics or operational partners involved in order processing and delivery.</li>
              <li>Compliance with legal obligations, court orders, or lawful government requests.</li>
              <li>Protection of Customed Clothing, users, or the public from fraud or security risks.</li>
            </ul>
          </PolicySection>

          <PolicySection title="Payments and Transaction Data">
            <p>
              At launch, Customed Clothing supports Cash on Delivery (COD). If online payment methods are enabled in the future,
              payment processing will be handled by trusted third-party gateways. We do not intentionally store complete
              card details on our application servers.
            </p>
          </PolicySection>

          <PolicySection title="Cookies, Sessions, and Analytics">
            <p>
              We use cookies and session technologies to keep users signed in, secure user sessions, prevent misuse,
              and support core website features. Some technical data may also be used for performance monitoring and
              service improvements.
            </p>
          </PolicySection>

          <PolicySection title="Data Retention and Security">
            <p>
              We retain personal data for as long as needed to provide services, complete orders, resolve disputes,
              maintain business records, and meet legal requirements. We implement reasonable technical and
              organizational safeguards; however, no online system can guarantee absolute security.
            </p>
          </PolicySection>

          <PolicySection title="Your Rights and Choices">
            <p>
              You may request access, correction, or deletion of your personal information, subject to legal and
              operational requirements. You may also request closure of your account where applicable.
            </p>
            <p>
              To submit a privacy request, use our{" "}
              <Link href="/contact" className="font-medium text-[#000000] underline underline-offset-4">
                Contact Us
              </Link>{" "}
              page.
            </p>
          </PolicySection>

          <PolicySection title="Children&apos;s Privacy">
            <p>
              Customed Clothing is not intended for children under 13 years of age. We do not knowingly collect personal
              information from children under 13. If such information is discovered, we will take reasonable steps to
              remove it.
            </p>
          </PolicySection>

          <PolicySection title="Third-Party Links and Services">
            <p>
              Our website may include links or embedded services from third parties (for example, map providers). Their
              privacy practices are governed by their own policies, and we encourage users to review those policies
              independently.
            </p>
          </PolicySection>

          <PolicySection title="Policy Updates">
            <p>
              We may update this Privacy Policy from time to time to reflect legal, operational, or product changes.
              The revised version will be posted on this page with the latest effective date.
            </p>
          </PolicySection>

          <PolicySection title="Intellectual Property Claims (IPC)">
            <p>
              Customed Clothing respects the intellectual property rights of others. We may remove, restrict, or disable access
              to user-submitted content that appears to violate copyright, trademark, or other applicable intellectual
              property laws.
            </p>
            <p>If you believe your intellectual property rights are being infringed on our platform, please send us a written notice that includes:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Your physical or electronic signature.</li>
              <li>Identification of the work, mark, or right claimed to be infringed.</li>
              <li>Identification of the allegedly infringing material and where it appears on our platform.</li>
              <li>Your contact details, including name, postal address, phone number, and email address.</li>
              <li>
                A statement that you have a good-faith belief that the disputed use is not authorized by the rights
                holder, its agent, or the law.
              </li>
              <li>A statement that the information in your notice is accurate.</li>
              <li>
                A statement, under penalty of perjury, that you are authorized to act on behalf of the rights holder.
              </li>
            </ul>
            <p>
              You can submit claims through our{" "}
              <Link href="/contact" className="font-medium text-[#000000] underline underline-offset-4">
                Contact Us
              </Link>{" "}
              page.
            </p>
          </PolicySection>

          <PolicySection title="Contact Information">
            <p>
              If you have questions about this Privacy Policy or our data handling practices, please contact us through
              the Contact Us page.
            </p>
            <p>
              Correspondence address: Sy.No 6/3B, 2nd Cross, Begur Rd, Hongasandra, Bengaluru, Karnataka 560068, India.
            </p>
          </PolicySection>
        </main>
      </div>

      <SiteFooter />
    </>
  );
}






