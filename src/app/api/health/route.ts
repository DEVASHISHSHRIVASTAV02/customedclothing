import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";

export async function GET() {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return ok({
      status: "ok",
      database: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown health check error.";
    return fail("Health check failed.", 503, process.env.NODE_ENV === "development" ? { detail } : undefined);
  }
}
