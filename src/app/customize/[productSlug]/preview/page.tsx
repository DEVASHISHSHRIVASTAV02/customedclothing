import { notFound } from "next/navigation";
import { AreaKey, AREA_CODE_TO_KEY, AREA_KEYS } from "@/lib/constants";
import { getCustomerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCatalogColorOrder, normalizeCatalogColor } from "@/lib/color-catalog";
import { parseDraftStep6Message, resolveDraftPreviewMap } from "@/lib/draft-preview-storage";
import { getDisplayProductName } from "@/lib/product-display";
import { PreviewApproval } from "@/components/customizer/preview-approval";
import { SessionPreviewApproval } from "@/components/customizer/session-preview-approval";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ productSlug: string }>;
  searchParams: Promise<{ draftId?: string; sessionId?: string; areas?: string }>;
};

function parseAreas(raw: string | undefined): AreaKey[] {
  if (!raw) {
    return ["front"];
  }
  const requested = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is AreaKey => AREA_KEYS.includes(value as AreaKey));

  return requested.length ? Array.from(new Set(requested)) : ["front"];
}

function appendVersionToPreviewUrl(source: string, versionToken: string) {
  if (!source || source.startsWith("data:image/")) {
    return source;
  }

  try {
    const isAbsolute = source.startsWith("http://") || source.startsWith("https://");
    const url = isAbsolute ? new URL(source) : new URL(source, "http://localhost");
    url.searchParams.set("v", versionToken);
    return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const separator = source.includes("?") ? "&" : "?";
    return `${source}${separator}v=${encodeURIComponent(versionToken)}`;
  }
}

function withPreviewVersion(previewByArea: Partial<Record<AreaKey, string>>, versionToken: string) {
  return Object.fromEntries(
    Object.entries(previewByArea).map(([area, source]) => [
      area,
      typeof source === "string" && source.length > 0
        ? appendVersionToPreviewUrl(source, versionToken)
        : source,
    ]),
  ) as Partial<Record<AreaKey, string>>;
}

export default async function PreviewPage({ params, searchParams }: PageProps) {
  const customerSession = await getCustomerSession();
  const [{ productSlug }, search] = await Promise.all([params, searchParams]);
  const selectedAreas = parseAreas(search.areas);

  if (search.sessionId && !search.draftId) {
    const productType = await prisma.productType.findUnique({
      where: { slug: productSlug },
      select: {
        slug: true,
        name: true,
        variants: {
          where: { active: true },
          select: {
            id: true,
            colorCode: true,
            colorName: true,
            sizeCode: true,
            basePriceInr: true,
          },
        },
        printAreas: {
          select: {
            code: true,
            addonPriceInr: true,
          },
        },
      },
    });
    if (!productType) {
      notFound();
    }
    const areaAddonByArea = Object.fromEntries(
      productType.printAreas.map((area) => [AREA_CODE_TO_KEY[area.code], area.addonPriceInr]),
    ) as Partial<Record<AreaKey, number>>;
    const normalizedVariants = productType.variants
      .map((variant) => {
        const normalizedColor = normalizeCatalogColor({
          colorCode: variant.colorCode,
          colorName: variant.colorName,
        });

        return {
          ...variant,
          colorCode: normalizedColor.colorCode,
          colorName: normalizedColor.colorName,
        };
      })
      .sort((left, right) => {
        const colorDelta = getCatalogColorOrder(left.colorName, left.colorCode) - getCatalogColorOrder(right.colorName, right.colorCode);
        if (colorDelta !== 0) {
          return colorDelta;
        }
        return left.sizeCode.localeCompare(right.sizeCode);
      });

    return (
      <div className="w-full min-h-screen">
        <div className="mx-auto w-full max-w-7xl px-6 py-8">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[#000000]">Step 6</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">360 Product Finalization</h1>
          </div>
          <SessionPreviewApproval
            sessionId={search.sessionId}
            productSlug={productSlug}
            productName={getDisplayProductName(productType.slug, productType.name)}
            variants={normalizedVariants}
            areaAddonByArea={areaAddonByArea}
            requestedAreas={selectedAreas}
          />
        </div>
      </div>
    );
  }

  if (!search.draftId) {
    notFound();
  }

  const draft = await prisma.designDraft.findUnique({
    where: { id: search.draftId },
    include: {
      productVariant: {
        include: {
          productType: {
            include: {
              printAreas: true,
            },
          },
        },
      },
    },
  });

  if (!draft || draft.productVariant.productType.slug !== productSlug) {
    notFound();
  }

  if (draft.customerId && draft.customerId !== customerSession?.user.id) {
    notFound();
  }

  const previewByArea = withPreviewVersion(resolveDraftPreviewMap(draft.previewImageUrls), String(draft.updatedAt.getTime()));
  const areaAddonByArea = Object.fromEntries(
    draft.productVariant.productType.printAreas.map((area) => [AREA_CODE_TO_KEY[area.code], area.addonPriceInr]),
  ) as Partial<Record<AreaKey, number>>;
  const designJsonByArea = (
    draft.designJsonByArea && typeof draft.designJsonByArea === "object" ? draft.designJsonByArea : {}
  ) as Partial<Record<AreaKey, unknown>>;
  const productName = getDisplayProductName(
    draft.productVariant.productType.slug,
    draft.productVariant.productType.name,
  );
  const normalizedDraftColor = normalizeCatalogColor({
    colorCode: draft.productVariant.colorCode,
    colorName: draft.productVariant.colorName,
  });

  return (
    <div className="w-full min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[#000000]">Step 6</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">360 Product Finalization</h1>
        </div>
        <PreviewApproval
          draftId={draft.id}
          productSlug={productSlug}
          productName={productName}
          colorCode={normalizedDraftColor.colorCode}
          colorName={normalizedDraftColor.colorName}
          sizeCode={draft.productVariant.sizeCode}
          basePriceInr={draft.productVariant.basePriceInr}
          designJsonByArea={designJsonByArea}
          areaAddonByArea={areaAddonByArea}
          previewByArea={previewByArea}
          selectedAreas={selectedAreas}
          initialStep6Message={parseDraftStep6Message(draft.previewImageUrls)}
        />
      </div>
    </div>
  );
}




