export const IST_TIME_ZONE = "Asia/Kolkata";

type DateInput = Date | string | number;

function toValidDate(value: DateInput) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const istDateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const istTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const istDatePartFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatDateTimeIst(value: DateInput) {
  const date = toValidDate(value);
  if (!date) {
    return "-";
  }

  return `${istDateTimeFormatter.format(date)} IST`;
}

export function formatTimeIst(value: DateInput) {
  const date = toValidDate(value);
  if (!date) {
    return "-";
  }

  return `${istTimeFormatter.format(date)} IST`;
}

export function getIstDatePart(value: DateInput = new Date()) {
  const date = toValidDate(value);
  if (!date) {
    return "00000000";
  }

  const parts = istDatePartFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}${month}${day}`;
}
