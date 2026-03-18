import { ContactForm } from "@/components/contact/contact-form";

export const metadata = {
  title: "Contact Us | CUSTOMED",
};

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <p className="text-xs uppercase tracking-[0.2em] text-[#000000]">Support</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Get in touch</h1>
      <p className="mt-2 text-sm text-[#000000]">
        Share your query and we will get back to you.
      </p>

      <div className="mt-6">
        <ContactForm />
      </div>
    </div>
  );
}




