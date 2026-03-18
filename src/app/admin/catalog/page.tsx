import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { getCatalogColorOrder, normalizeCatalogColor } from "@/lib/color-catalog";
import { prisma } from "@/lib/prisma";
import { CatalogManager } from "@/components/admin/catalog-manager";
import { AdminSignOutButton } from "@/components/admin/signout-button";

export const dynamic = "force-dynamic";

export default async function AdminCatalogPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login?callbackUrl=/admin/catalog");
  }

  const [productTypes, variants, printAreas, config] = await Promise.all([
    prisma.productType.findMany({ orderBy: { name: "asc" } }),
    prisma.productVariant.findMany({ orderBy: [{ productTypeId: "asc" }, { colorName: "asc" }, { sizeCode: "asc" }] }),
    prisma.printArea.findMany({ orderBy: [{ productTypeId: "asc" }, { code: "asc" }] }),
    prisma.shopConfig.findUnique({ where: { id: "default" } }),
  ]);

  const normalizedVariants = variants
    .map((variant) => {
      const normalizedColor = normalizeCatalogColor({
        colorCode: variant.colorCode,
        colorName: variant.colorName,
      });

      return {
        id: variant.id,
        productTypeId: variant.productTypeId,
        colorName: normalizedColor.colorName,
        sizeCode: variant.sizeCode,
        basePriceInr: variant.basePriceInr,
        active: variant.active,
      };
    })
    .sort((left, right) => {
      const colorDelta = getCatalogColorOrder(left.colorName) - getCatalogColorOrder(right.colorName);
      if (colorDelta !== 0) {
        return colorDelta;
      }
      return left.sizeCode.localeCompare(right.sizeCode);
    });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#000000]">Admin dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Catalog</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/admin/orders"
            className="rounded-xl border border-[#000000] bg-[#000000] px-3 py-2 text-[#ffffff] transition-colors hover:border-[#000000] hover:bg-[#000000] active:border-[#000000] active:bg-[#000000]"
          >
            Orders
          </Link>
          <AdminSignOutButton />
        </div>
      </div>

      <CatalogManager
        productTypes={productTypes.map((item) => ({ id: item.id, name: item.name }))}
        variants={normalizedVariants}
        printAreas={printAreas.map((area) => ({
          id: area.id,
          productTypeId: area.productTypeId,
          code: area.code,
          addonPriceInr: area.addonPriceInr,
        }))}
        flatShippingInr={config?.flatShippingInr ?? 99}
      />
    </div>
  );
}
