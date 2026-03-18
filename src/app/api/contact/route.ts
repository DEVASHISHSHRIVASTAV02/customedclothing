import { NextRequest } from "next/server";
import { Resend } from "resend";
import { fail, ok } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { contactSubmissionSchema } from "@/lib/validation";

function normalizeContactPhone(value: string) {
  const compact = value.replace(/\s+/g, "");
  if (compact.startsWith("+")) {
    return `+${compact.slice(1).replace(/[^0-9]/g, "")}`;
  }
  return compact.replace(/[^0-9]/g, "");
}

function normalizeContactPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const input = value as Record<string, unknown>;
  const asTrimmed = (field: string) => (typeof input[field] === "string" ? input[field].trim() : input[field]);

  return {
    ...input,
    name: asTrimmed("name"),
    email: asTrimmed("email"),
    phone: typeof input.phone === "string" ? normalizeContactPhone(input.phone) : input.phone,
    subject: asTrimmed("subject"),
    message: asTrimmed("message"),
  };
}

function firstValidationIssue(flattened: { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] }) {
  if (flattened.formErrors.length > 0) {
    return flattened.formErrors[0];
  }

  for (const errors of Object.values(flattened.fieldErrors)) {
    if (Array.isArray(errors) && errors.length > 0) {
      return errors[0];
    }
  }

  return null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await checkRateLimit(`contact:${ip}`, 10, 10 * 60_000);
  if (!limit.allowed) {
    return fail("Too many contact requests. Please wait and retry.", 429);
  }

  const json = await request.json().catch(() => null);
  const normalizedPayload = normalizeContactPayload(json);
  const parsed = contactSubmissionSchema.safeParse(normalizedPayload);
  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    const detail = firstValidationIssue(flattened);
    return fail(detail ?? "Invalid contact form payload.", 400, { issues: flattened });
  }

  const { name, email, phone, subject, message } = parsed.data;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.CONTACT_TO_EMAIL ?? process.env.ADMIN_EMAIL;

  if (!apiKey || !from || !to) {
    return ok({
      submitted: true,
      delivered: false,
    });
  }

  try {
    const resend = new Resend(apiKey);
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);
    const mailSubject = `[Contact] ${subject}`;
    const textBody = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Subject: ${subject}`,
      "",
      "Message:",
      message,
    ].join("\n");
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111111">
        <h2 style="margin:0 0 12px;">New contact form submission</h2>
        <p style="margin:0 0 6px;"><strong>Name:</strong> ${safeName}</p>
        <p style="margin:0 0 6px;"><strong>Email:</strong> ${safeEmail}</p>
        <p style="margin:0 0 6px;"><strong>Phone:</strong> ${safePhone}</p>
        <p style="margin:0 0 10px;"><strong>Subject:</strong> ${safeSubject}</p>
        <p style="margin:0 0 4px;"><strong>Message:</strong></p>
        <pre style="white-space:pre-wrap;font-family:inherit;margin:0;">${safeMessage}</pre>
      </div>
    `;

    await resend.emails.send({
      from,
      to,
      replyTo: email,
      subject: mailSubject,
      text: textBody,
      html: htmlBody,
    });

    return ok({
      submitted: true,
      delivered: true,
    });
  } catch (error) {
    return fail(
      "Unable to submit contact form right now. Please try again.",
      502,
      process.env.NODE_ENV === "development"
        ? { detail: error instanceof Error ? error.message : "Unknown email dispatch error." }
        : undefined,
    );
  }
}
