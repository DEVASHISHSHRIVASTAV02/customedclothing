import { randomInt } from "crypto";
import { getIstDatePart } from "@/lib/time";

export function generateOrderCode() {
  const datePart = getIstDatePart();
  const rand = randomInt(100000, 999999);
  return `CC-${datePart}-${rand}`;
}

