import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const PRISMA_DB_NAME = "db";
const IST_TIMEZONE_OPTION = "-c TimeZone=Asia/Kolkata";

function withIstTimezoneInDatabaseUrl(databaseUrl: string | undefined) {
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    return undefined;
  }

  try {
    const parsed = new URL(databaseUrl);
    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
      return databaseUrl;
    }

    const existingOptions = parsed.searchParams.get("options");
    const decodedOptions = existingOptions ? decodeURIComponent(existingOptions) : "";
    if (/(\s|^)-c\s+TimeZone=/.test(decodedOptions)) {
      return databaseUrl;
    }

    const nextOptions = decodedOptions.length > 0
      ? `${decodedOptions} ${IST_TIMEZONE_OPTION}`
      : IST_TIMEZONE_OPTION;
    parsed.searchParams.set("options", nextOptions);
    return parsed.toString();
  } catch {
    return databaseUrl;
  }
}

function createPrismaClient() {
  const datasourceUrl = withIstTimezoneInDatabaseUrl(process.env.DATABASE_URL);

  return new PrismaClient({
    datasources: datasourceUrl ? { [PRISMA_DB_NAME]: { url: datasourceUrl } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

