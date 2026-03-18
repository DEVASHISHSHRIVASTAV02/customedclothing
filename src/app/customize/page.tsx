import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getFallbackCatalog } from "@/lib/fallback-catalog";
import { getDisplayProductName } from "@/lib/product-display";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClothingImage } from "@/components/ui/clothing-image";

export const dynamic = "force-dynamic";

type CustomizeListProduct = {
  id: string;
  slug: string;
  name: string;
  variants: Array<{
    basePriceInr: number;
  }>;
};

async function getCustomizeListProducts(): Promise<CustomizeListProduct[]> {
  try {
    const dbProducts = await prisma.productType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        variants: {
          where: { active: true },
          orderBy: { basePriceInr: "asc" },
        },
      },
    });

    const usableProducts = dbProducts.filter((product) => product.variants.length > 0);
    if (usableProducts.length > 0) {
      return usableProducts;
    }
  } catch {
    // Fall back to seed-equivalent catalog when local DB is unavailable.
  }

  return getFallbackCatalog().map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    variants: product.variants.map((variant) => ({
      basePriceInr: variant.basePriceInr,
    })),
  }));
}

export default async function CustomizeIndexPage() {
  const products = await getCustomizeListProducts();

  return (
    <div className="w-full min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[#000000]">Step 1</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Choose your clothing item</h1>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => {
            const startingPrice = Math.min(...product.variants.map((variant) => variant.basePriceInr));
            const displayName = getDisplayProductName(product.slug, product.name);
            return (
              <Card key={product.id} className="overflow-hidden border-[#ffffff]/20 bg-[#000000] bg-none text-[#ffffff] shadow-none">
                <CardBody className="space-y-4 p-5">
                  <div className="aspect-[16/11] overflow-hidden rounded-xl border border-[#ffffff]/20 bg-[#000000]">
                    <ClothingImage
                      type={product.slug}
                      fit="cover"
                      className="h-full w-full rounded-none border-0 bg-[#ffffff]"
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-[#ffffff]">{displayName}</h2>
                    <p className="mt-1 text-sm text-[#ffffff]/80">Starting at Rs {startingPrice}</p>
                  </div>
                  <Link href={`/customize/${product.slug}`}>
                    <Button className="w-full !border-[#ffffff] !bg-[#ffffff] !text-[#000000] hover:!border-[#ffffff] hover:!bg-[#000000] hover:!text-[#ffffff] active:!border-[#ffffff] active:!bg-[#ffffff] active:!text-[#000000]">
                      Customize {displayName}
                    </Button>
                  </Link>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}



