import { OrderStatus } from "@prisma/client";
import type { NotificationChannel, NotificationStatus, Order } from "@prisma/client";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { buildAbsoluteUrl, formatInr } from "@/lib/utils";

type ChannelResult = {
  channel: NotificationChannel;
  status: NotificationStatus;
  error?: string;
  providerMessageId?: string;
};

type WelcomeEmailResult = {
  attempted: boolean;
  sent: boolean;
  providerMessageId?: string;
  error?: string;
};

type PasswordResetEmailResult = {
  attempted: boolean;
  sent: boolean;
  providerMessageId?: string;
  error?: string;
};

const MSG91_SMS_ENDPOINT_DEFAULT = "https://control.msg91.com/api/v5/flow";
const MSG91_WHATSAPP_ENDPOINT_DEFAULT =
  "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

function getDefaultCountryCode() {
  const configured = process.env.MSG91_DEFAULT_COUNTRY_CODE?.trim() || "+91";
  const digits = configured.replace(/[^0-9]/g, "");
  if (digits.length < 1 || digits.length > 4) {
    return "+91";
  }
  return `+${digits}`;
}

function normalizeRecipientPhone(rawPhone: string) {
  const raw = rawPhone.trim();
  if (!raw) {
    return null;
  }

  const value = raw.startsWith("whatsapp:") ? raw.slice("whatsapp:".length) : raw;
  const compact = value.replace(/\s+/g, "");

  if (compact.startsWith("+")) {
    const plusDigits = compact.slice(1).replace(/[^0-9]/g, "");
    if (plusDigits.length < 8 || plusDigits.length > 15) {
      return null;
    }
    return `+${plusDigits}`;
  }

  const digits = compact.replace(/[^0-9]/g, "");
  if (!digits) {
    return null;
  }

  if (digits.startsWith("00") && digits.length > 2) {
    return `+${digits.slice(2)}`;
  }

  if (digits.length === 10) {
    return `${getDefaultCountryCode()}${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return `${getDefaultCountryCode()}${digits.slice(1)}`;
  }

  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

function toMsg91Mobile(e164Phone: string) {
  return e164Phone.replace(/^\+/, "");
}

function normalizeIntegratedNumber(rawIntegratedNumber: string) {
  const digits = rawIntegratedNumber.replace(/[^0-9]/g, "");
  if (digits.length >= 8 && digits.length <= 15) {
    return digits;
  }
  return rawIntegratedNumber.trim();
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getMsg91AuthKey() {
  const authKey = process.env.MSG91_AUTH_KEY?.trim();
  if (!authKey) {
    return null;
  }
  return authKey;
}

function getMsg91RequestHeaders(authKey: string) {
  return {
    accept: "application/json",
    "content-type": "application/json",
    authkey: authKey,
  };
}

function extractProviderMessageId(rawBody: unknown) {
  const body = asRecord(rawBody);
  if (!body) {
    return undefined;
  }

  const directMessage = body.message;
  if (typeof directMessage === "string" && directMessage.trim()) {
    return directMessage.trim();
  }

  const directRequestId = body.request_id;
  if (typeof directRequestId === "string" && directRequestId.trim()) {
    return directRequestId.trim();
  }

  const data = asRecord(body.data);
  if (!data) {
    return undefined;
  }

  const nestedRequestId = data.request_id;
  if (typeof nestedRequestId === "string" && nestedRequestId.trim()) {
    return nestedRequestId.trim();
  }

  const nestedMessage = data.message;
  if (typeof nestedMessage === "string" && nestedMessage.trim()) {
    return nestedMessage.trim();
  }

  return undefined;
}

function extractMsg91Error(rawBody: unknown, fallback: string) {
  const body = asRecord(rawBody);
  if (!body) {
    return fallback;
  }

  const directMessage = body.message;
  if (typeof directMessage === "string" && directMessage.trim()) {
    return directMessage.trim();
  }

  const directErrors = body.errors;
  if (Array.isArray(directErrors) && directErrors.length > 0) {
    return directErrors
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .join("; ");
  }

  const data = asRecord(body.data);
  if (!data) {
    return fallback;
  }

  const nestedMessage = data.message;
  if (typeof nestedMessage === "string" && nestedMessage.trim()) {
    return nestedMessage.trim();
  }

  const nestedErrors = data.errors;
  if (Array.isArray(nestedErrors) && nestedErrors.length > 0) {
    return nestedErrors
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .join("; ");
  }

  return fallback;
}

function getNotificationTargetPhone(orderPhone: string) {
  const override = process.env.DEFAULT_NOTIFICATION_PHONE?.trim();
  if (override && override.length > 0) {
    return override;
  }
  return orderPhone;
}

function normalizeGreetingInput(value?: string | null) {
  const normalized = (value ?? "").trim().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }

  return normalized
    .split(" ")
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : part))
    .join(" ");
}

function getWelcomeGreetingName(params: {
  customerName?: string | null;
  loginId?: string | null;
  email?: string | null;
}) {
  const explicitName = normalizeGreetingInput(params.customerName);
  if (explicitName) {
    return explicitName;
  }

  const identifier = (params.email ?? params.loginId ?? "").trim();
  if (!identifier) {
    return "there";
  }

  const localPart = identifier.includes("@") ? identifier.split("@")[0] : identifier;
  return normalizeGreetingInput(localPart) ?? "there";
}

export async function sendCustomerWelcomeEmail(params: {
  toEmail?: string | null;
  customerName?: string | null;
  loginId?: string | null;
}): Promise<WelcomeEmailResult> {
  const toEmail = params.toEmail?.trim();
  if (!toEmail) {
    return {
      attempted: false,
      sent: false,
      error: "Customer email is unavailable.",
    };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    return {
      attempted: false,
      sent: false,
      error: "Resend email configuration is missing.",
    };
  }

  const greetingName = getWelcomeGreetingName({
    customerName: params.customerName,
    loginId: params.loginId,
    email: toEmail,
  });
  const customizeUrl = buildAbsoluteUrl("/customize");
  const accountUrl = buildAbsoluteUrl("/account");
  const subject = "Welcome to CUSTOMED";
  const text = [
    `Hi ${greetingName},`,
    "",
    "Welcome to CUSTOMED. Your account has been created successfully.",
    "You can now design custom clothing, save drafts, and place orders easily.",
    "",
    `Start designing: ${customizeUrl}`,
    `Your account: ${accountUrl}`,
    "",
    "Thanks for joining us.",
    "Team CUSTOMED",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111111">
      <h2 style="margin:0 0 12px;">Welcome to CUSTOMED, ${greetingName}!</h2>
      <p style="margin:0 0 10px;">
        Your account has been created successfully. You can now design custom clothing, save drafts, and place orders.
      </p>
      <p style="margin:0 0 10px;">
        <a href="${customizeUrl}">Start designing</a> |
        <a href="${accountUrl}">View your account</a>
      </p>
      <p style="margin:0;">Thanks for joining us.<br/>Team CUSTOMED</p>
    </div>
  `;

  try {
    const resend = new Resend(apiKey);
    const response = await resend.emails.send({
      from,
      to: toEmail,
      subject,
      html,
      text,
    });

    return {
      attempted: true,
      sent: true,
      providerMessageId: response.data?.id,
    };
  } catch (error) {
    return {
      attempted: true,
      sent: false,
      error: asErrorMessage(error, "Welcome email dispatch failed."),
    };
  }
}

export async function sendCustomerPasswordResetOtpEmail(params: {
  toEmail?: string | null;
  otp: string;
  expiresInMinutes: number;
}): Promise<PasswordResetEmailResult> {
  const toEmail = params.toEmail?.trim();
  if (!toEmail) {
    return {
      attempted: false,
      sent: false,
      error: "Customer email is unavailable.",
    };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    return {
      attempted: false,
      sent: false,
      error: "Resend email configuration is missing.",
    };
  }

  const accountUrl = buildAbsoluteUrl("/account");
  const subject = "CUSTOMED password reset OTP";
  const text = [
    "We received a request to reset your CUSTOMED account password.",
    "",
    `Your OTP is: ${params.otp}`,
    `This OTP expires in ${params.expiresInMinutes} minutes.`,
    "",
    "If you did not request this reset, you can ignore this email.",
    `Account page: ${accountUrl}`,
    "",
    "Team CUSTOMED",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111111">
      <h2 style="margin:0 0 12px;">Password reset request</h2>
      <p style="margin:0 0 8px;">Use this OTP to reset your CUSTOMED account password:</p>
      <p style="margin:0 0 8px;font-size:24px;font-weight:700;letter-spacing:4px;">${params.otp}</p>
      <p style="margin:0 0 10px;">This OTP expires in ${params.expiresInMinutes} minutes.</p>
      <p style="margin:0 0 10px;">
        If you did not request this reset, you can ignore this email.
      </p>
      <p style="margin:0;">
        <a href="${accountUrl}">Go to account</a><br/>
        Team CUSTOMED
      </p>
    </div>
  `;

  try {
    const resend = new Resend(apiKey);
    const response = await resend.emails.send({
      from,
      to: toEmail,
      subject,
      html,
      text,
    });

    return {
      attempted: true,
      sent: true,
      providerMessageId: response.data?.id,
    };
  } catch (error) {
    return {
      attempted: true,
      sent: false,
      error: asErrorMessage(error, "Password reset OTP email dispatch failed."),
    };
  }
}

async function sendEmail(order: Order): Promise<ChannelResult | null> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return null;
  }

  const resend = new Resend(apiKey);
  const subject = `Order confirmed: ${order.orderCode}`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <h2>Order ${order.orderCode} confirmed</h2>
      <p>Hi ${order.customerName},</p>
      <p>Your custom clothing order has been placed successfully.</p>
      <p><strong>Total:</strong> ${formatInr(order.totalInr)}</p>
      <p>Track your order: <a href="${buildAbsoluteUrl("/track-order")}">Track Order</a></p>
    </div>
  `;

  try {
    const response = await resend.emails.send({
      from,
      to: order.email,
      subject,
      html,
    });

    return {
      channel: "EMAIL",
      status: "SENT",
      providerMessageId: response.data?.id,
    };
  } catch (error) {
    return {
      channel: "EMAIL",
      status: "FAILED",
      error: error instanceof Error ? error.message : "Email dispatch failed.",
    };
  }
}

async function sendMsg91Request(params: {
  channel: "SMS" | "WHATSAPP";
  endpoint: string;
  body: Record<string, unknown>;
}): Promise<ChannelResult | null> {
  const authKey = getMsg91AuthKey();
  if (!authKey) {
    return null;
  }

  try {
    const response = await fetch(params.endpoint, {
      method: "POST",
      headers: getMsg91RequestHeaders(authKey),
      body: JSON.stringify(params.body),
      cache: "no-store",
    });

    const responseText = await response.text();
    let parsedBody: unknown = null;
    if (responseText.trim().length > 0) {
      try {
        parsedBody = JSON.parse(responseText);
      } catch {
        parsedBody = null;
      }
    }

    if (!response.ok) {
      return {
        channel: params.channel,
        status: "FAILED",
        error: extractMsg91Error(
          parsedBody,
          `MSG91 request failed with HTTP ${response.status}.`,
        ),
      };
    }

    return {
      channel: params.channel,
      status: "SENT",
      providerMessageId: extractProviderMessageId(parsedBody),
    };
  } catch (error) {
    return {
      channel: params.channel,
      status: "FAILED",
      error: asErrorMessage(error, "MSG91 dispatch failed."),
    };
  }
}

async function sendMsg91Sms(order: Order): Promise<ChannelResult | null> {
  const templateId = process.env.MSG91_SMS_TEMPLATE_ID?.trim();
  if (!templateId) {
    return null;
  }

  const targetPhone = getNotificationTargetPhone(order.phone);
  const toNumber = normalizeRecipientPhone(targetPhone);
  if (!toNumber) {
    return {
      channel: "SMS",
      status: "FAILED",
      error: "Invalid recipient phone format for MSG91 SMS delivery.",
    };
  }

  const recipients: Record<string, string>[] = [
    {
      mobiles: toMsg91Mobile(toNumber),
      VAR1: order.orderCode,
      VAR2: formatInr(order.totalInr),
      VAR3: buildAbsoluteUrl("/track-order"),
    },
  ];

  const payload: Record<string, unknown> = {
    template_id: templateId,
    short_url: process.env.MSG91_SMS_SHORT_URL?.trim() || "0",
    recipients,
  };

  const shortUrlExpiry = process.env.MSG91_SMS_SHORT_URL_EXPIRY?.trim();
  if (shortUrlExpiry) {
    payload.short_url_expiry = shortUrlExpiry;
  }

  const realTimeResponse = process.env.MSG91_SMS_REALTIME_RESPONSE?.trim();
  if (realTimeResponse) {
    payload.realTimeResponse = realTimeResponse;
  }

  return sendMsg91Request({
    channel: "SMS",
    endpoint: process.env.MSG91_SMS_ENDPOINT?.trim() || MSG91_SMS_ENDPOINT_DEFAULT,
    body: payload,
  });
}

async function sendMsg91WhatsApp(order: Order): Promise<ChannelResult | null> {
  const integratedNumberRaw = process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER?.trim();
  const templateName = process.env.MSG91_WHATSAPP_TEMPLATE_NAME?.trim();
  if (!integratedNumberRaw || !templateName) {
    return null;
  }

  const targetPhone = getNotificationTargetPhone(order.phone);
  const toNumber = normalizeRecipientPhone(targetPhone);
  if (!toNumber) {
    return {
      channel: "WHATSAPP",
      status: "FAILED",
      error: "Invalid recipient phone format for MSG91 WhatsApp delivery.",
    };
  }

  const payload = {
    integrated_number: normalizeIntegratedNumber(integratedNumberRaw),
    content_type: "template",
    payload: {
      type: "template",
      messaging_product: "whatsapp",
      template: {
        name: templateName,
        language: {
          code: process.env.MSG91_WHATSAPP_TEMPLATE_LANGUAGE_CODE?.trim() || "en",
          policy:
            process.env.MSG91_WHATSAPP_TEMPLATE_LANGUAGE_POLICY?.trim() ||
            "deterministic",
        },
        to_and_components: [
          {
            to: [toMsg91Mobile(toNumber)],
            components: {
              body_1: {
                type: "text",
                value: order.orderCode,
              },
              body_2: {
                type: "text",
                value: formatInr(order.totalInr),
              },
              body_3: {
                type: "text",
                value: buildAbsoluteUrl("/track-order"),
              },
            },
          },
        ],
      },
    },
  };

  return sendMsg91Request({
    channel: "WHATSAPP",
    endpoint:
      process.env.MSG91_WHATSAPP_ENDPOINT?.trim() ||
      MSG91_WHATSAPP_ENDPOINT_DEFAULT,
    body: payload as Record<string, unknown>,
  });
}

async function persistNotificationResult(orderId: string, result: ChannelResult) {
  await prisma.notificationLog.create({
    data: {
      orderId,
      channel: result.channel,
      status: result.status,
      providerMessageId: result.providerMessageId,
      error: result.error,
      attempts: 1,
    },
  });
}

export async function dispatchOrderNotifications(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new Error("Order not found.");
  }

  const results: ChannelResult[] = [];

  const emailResult = await sendEmail(order);
  if (emailResult) {
    results.push(emailResult);
  }

  const smsResult = await sendMsg91Sms(order);
  if (smsResult) {
    results.push(smsResult);
  }

  const whatsappResult = await sendMsg91WhatsApp(order);
  if (whatsappResult) {
    results.push(whatsappResult);
  }

  if (results.length === 0) {
    return [];
  }

  await Promise.all(results.map((result) => persistNotificationResult(order.id, result)));

  const hasFailure = results.some((result) => result.status === "FAILED");
  if (hasFailure && order.status !== OrderStatus.FAILED_NOTIFICATION) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.FAILED_NOTIFICATION },
    });
  }

  return results;
}

