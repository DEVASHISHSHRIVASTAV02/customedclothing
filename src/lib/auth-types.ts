import { AdminRole } from "@prisma/client";

export type AppRole = AdminRole | "CUSTOMER";
