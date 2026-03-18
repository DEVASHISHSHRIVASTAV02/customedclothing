"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ContactFormState = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

type AccountContactResponse = {
  customer?: {
    fullName?: string;
    email?: string | null;
    phone?: string | null;
  };
};

const initialFormState: ContactFormState = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
};

async function readResponseJson<T extends Record<string, unknown>>(response: Response) {
  const text = await response.text();
  if (!text) {
    return {} as Partial<T> & { error?: unknown };
  }

  try {
    return JSON.parse(text) as Partial<T> & { error?: unknown };
  } catch {
    return {} as Partial<T> & { error?: unknown };
  }
}

function responseErrorMessage(data: { error?: unknown }, fallback: string) {
  if (typeof data.error !== "string") {
    const parsed = data as {
      issues?: {
        fieldErrors?: Record<string, string[] | undefined>;
        formErrors?: string[];
      };
    };

    if (Array.isArray(parsed.issues?.formErrors) && parsed.issues.formErrors.length > 0) {
      return parsed.issues.formErrors[0];
    }

    if (parsed.issues?.fieldErrors) {
      for (const errors of Object.values(parsed.issues.fieldErrors)) {
        if (Array.isArray(errors) && errors.length > 0) {
          return errors[0];
        }
      }
    }

    return fallback;
  }

  const value = data.error.trim();
  return value.length > 0 ? value : fallback;
}

export function ContactForm() {
  const { data: session, status } = useSession();
  const attemptedAutofillRef = useRef(false);
  const [form, setForm] = useState<ContactFormState>(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || session?.user.role !== "CUSTOMER" || attemptedAutofillRef.current) {
      return;
    }
    attemptedAutofillRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/customer/account", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = await readResponseJson<AccountContactResponse>(response);
        const customer = data.customer;
        if (!customer || cancelled) {
          return;
        }

        setForm((prev) => ({
          ...prev,
          name: prev.name.trim().length > 0 ? prev.name : (customer.fullName?.trim() ?? ""),
          email: prev.email.trim().length > 0 ? prev.email : (customer.email?.trim() ?? ""),
          phone: prev.phone.trim().length > 0 ? prev.phone : (customer.phone?.trim() ?? ""),
        }));
      } catch {
        // Autofill is best-effort; ignore fetch failures.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user.role, status]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await readResponseJson<{ delivered?: boolean }>(response);
      if (!response.ok) {
        throw new Error(responseErrorMessage(data, "Unable to submit contact form."));
      }

      setSuccess("Your message has been submitted successfully.");
      setForm((prev) => ({
        ...prev,
        subject: "",
        message: "",
      }));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit contact form.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-2xl font-semibold tracking-tight">Contact Us</h2>
        <p className="text-sm text-[#000000]">Fill in your details and message below.</p>
      </CardHeader>
      <CardBody>
        <form className="space-y-3" onSubmit={onSubmit}>
          <Input
            required
            placeholder="Name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <Input
            required
            type="email"
            placeholder="Mail ID"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <Input
            required
            placeholder="Phone No"
            value={form.phone}
            onChange={(event) => {
              const value = event.target.value;
              const normalized = value.startsWith("+")
                ? `+${value.slice(1).replace(/[^0-9]/g, "")}`
                : value.replace(/[^0-9]/g, "");
              setForm((prev) => ({ ...prev, phone: normalized }));
            }}
          />
          <Input
            required
            placeholder="Subject"
            value={form.subject}
            onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
          />
          <Textarea
            required
            placeholder="Message"
            rows={6}
            value={form.message}
            onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
          />

          {error && <p className="text-sm text-danger">{error}</p>}
          {success && <p className="text-sm text-[#000000]">{success}</p>}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}



