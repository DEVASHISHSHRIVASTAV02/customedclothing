import crypto from "crypto";

const OTP_LENGTH = 6;

function toBoundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function getOtpSecret() {
  return (
    process.env.PASSWORD_RESET_OTP_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "cc-dev-password-reset-secret"
  );
}

export function normalizeResetEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getPasswordResetOtpTtlMinutes() {
  return toBoundedInteger(process.env.PASSWORD_RESET_OTP_TTL_MINUTES, 10, 5, 30);
}

export function getPasswordResetOtpMaxAttempts() {
  return toBoundedInteger(process.env.PASSWORD_RESET_OTP_MAX_ATTEMPTS, 5, 3, 10);
}

export function generatePasswordResetOtp() {
  const max = 10 ** OTP_LENGTH;
  return crypto.randomInt(0, max).toString().padStart(OTP_LENGTH, "0");
}

export function hashPasswordResetOtp(otp: string) {
  const normalized = otp.trim();
  return crypto.createHash("sha256").update(`${normalized}:${getOtpSecret()}`).digest("hex");
}

export function getPasswordResetOtpExpiryDate() {
  return new Date(Date.now() + getPasswordResetOtpTtlMinutes() * 60_000);
}
