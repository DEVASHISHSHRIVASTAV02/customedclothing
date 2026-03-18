import bcrypt from "bcryptjs";
import { PrismaClient, PrintAreaCode, AdminRole } from "@prisma/client";
import {
  CATALOG_BASE_PRICE_BY_SLUG,
  CATALOG_COLORS,
  CATALOG_PRINT_AREAS,
  CATALOG_PRODUCT_TYPES,
  CATALOG_SIZES,
  CATALOG_SIZE_MULTIPLIER,
  DEFAULT_AUTOSAVE_MS,
  DEFAULT_FLAT_SHIPPING_INR,
} from "../src/lib/catalog-seed-config";

const prisma = new PrismaClient();

function toPrintAreaCode(code: "front" | "back") {
  return code === "front" ? PrintAreaCode.FRONT : PrintAreaCode.BACK;
}

function normalizeSeedKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function productTypeSeedId(slug: string) {
  return `seed_product_type_${normalizeSeedKey(slug)}`;
}

function printAreaSeedId(slug: string, code: PrintAreaCode) {
  return `seed_print_area_${normalizeSeedKey(slug)}_${normalizeSeedKey(code)}`;
}

function variantSeedId(slug: string, colorCode: string, sizeCode: string) {
  return `seed_variant_${normalizeSeedKey(slug)}_${normalizeSeedKey(colorCode)}_${normalizeSeedKey(sizeCode)}`;
}

async function seedCatalog() {
  const allowedProductSlugs = CATALOG_PRODUCT_TYPES.map((type) => type.slug);
  const allowedColorCodes = CATALOG_COLORS.map((color) => color.code);
  await prisma.productType.deleteMany({
    where: {
      slug: {
        notIn: allowedProductSlugs,
      },
    },
  });

  for (const type of CATALOG_PRODUCT_TYPES) {
    const product = await prisma.productType.upsert({
      where: { slug: type.slug },
      update: { name: type.name, active: true },
      create: {
        id: productTypeSeedId(type.slug),
        slug: type.slug,
        name: type.name,
        active: true,
      },
    });

    for (const area of CATALOG_PRINT_AREAS) {
      const areaCode = toPrintAreaCode(area.code);
      await prisma.printArea.upsert({
        where: {
          productTypeId_code: {
            productTypeId: product.id,
            code: areaCode,
          },
        },
        update: {
          addonPriceInr: area.addonPriceInr,
          textureSlot: area.textureSlot,
        },
        create: {
          id: printAreaSeedId(type.slug, areaCode),
          productTypeId: product.id,
          code: areaCode,
          addonPriceInr: area.addonPriceInr,
          textureSlot: area.textureSlot,
        },
      });
    }

    for (const color of CATALOG_COLORS) {
      for (const size of CATALOG_SIZES) {
        const basePrice = CATALOG_BASE_PRICE_BY_SLUG[type.slug] ?? 799;
        await prisma.productVariant.upsert({
          where: {
            productTypeId_colorCode_sizeCode: {
              productTypeId: product.id,
              colorCode: color.code,
              sizeCode: size,
            },
          },
          update: {
            colorName: color.name,
            basePriceInr: basePrice + CATALOG_SIZE_MULTIPLIER[size],
            active: true,
          },
          create: {
            id: variantSeedId(type.slug, color.code, size),
            productTypeId: product.id,
            colorCode: color.code,
            colorName: color.name,
            sizeCode: size,
            basePriceInr: basePrice + CATALOG_SIZE_MULTIPLIER[size],
            active: true,
          },
        });
      }
    }

    await prisma.productVariant.updateMany({
      where: {
        productTypeId: product.id,
        colorCode: {
          notIn: allowedColorCodes,
        },
      },
      data: {
        active: false,
      },
    });
  }
}

async function seedShopConfig() {
  await prisma.shopConfig.upsert({
    where: { id: "default" },
    update: {
      flatShippingInr: DEFAULT_FLAT_SHIPPING_INR,
      autosaveMs: DEFAULT_AUTOSAVE_MS,
    },
    create: {
      id: "default",
      flatShippingInr: DEFAULT_FLAT_SHIPPING_INR,
      autosaveMs: DEFAULT_AUTOSAVE_MS,
    },
  });
}

async function seedAdmin() {
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
  await seedCatalog();
  await seedShopConfig();
  await seedAdmin();
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

