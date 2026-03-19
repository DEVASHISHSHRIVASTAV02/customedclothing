import bcrypt from "bcryptjs";
import { AdminRole, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedAdminOnly() {
  const fallbackEmail = "admin@cc.local";
  const fallbackPassword = "ChangeMe123!";
  const email = process.env.ADMIN_EMAIL ?? fallbackEmail;
  const password = process.env.ADMIN_PASSWORD ?? fallbackPassword;

  if (process.env.NODE_ENV === "production") {
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required in production.");
    }

    if (email === fallbackEmail || password === fallbackPassword) {
      throw new Error("Default admin credentials are not allowed in production.");
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.adminUser.upsert({
    where: { email },
    update: {
      passwordHash,
      active: true,
      role: AdminRole.ADMIN,
    },
    create: {
      id: "seed_admin_primary",
      email,
      passwordHash,
      active: true,
      role: AdminRole.ADMIN,
    },
  });
}

async function main() {
  await seedAdminOnly();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
