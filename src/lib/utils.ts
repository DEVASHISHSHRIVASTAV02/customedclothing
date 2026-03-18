import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function parseJsonObject<T>(value: unknown, fallback: T): T {
  if (!value || typeof value !== "object") {
    return fallback;
  }
  return value as T;
}

export function buildAbsoluteUrl(pathname: string) {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return new URL(pathname, base).toString();
}

