const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9]{10,15}$/;

type NormalizedCustomerLogin = {
  loginId: string;
  email: string | null;
  phone: string | null;
};

function normalizePhoneInput(value: string) {
  const compact = value.replace(/\s+/g, "");
  if (compact.startsWith("+")) {
    return `+${compact.slice(1).replace(/[^0-9]/g, "")}`;
  }
  return compact.replace(/[^0-9]/g, "");
}

export function normalizeCustomerLoginId(input: string): NormalizedCustomerLogin {
  const raw = input.trim();
  if (!raw) {
    throw new Error("Email ID or phone number is required.");
  }

  if (raw.includes("@")) {
    const normalizedEmail = raw.toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      throw new Error("Please enter a valid email ID.");
    }

    return {
      loginId: normalizedEmail,
      email: normalizedEmail,
      phone: null,
    };
  }

  const normalizedPhone = normalizePhoneInput(raw);
  if (!PHONE_REGEX.test(normalizedPhone)) {
    throw new Error("Please enter a valid phone number.");
  }

  return {
    loginId: normalizedPhone,
    email: null,
    phone: normalizedPhone,
  };
}
