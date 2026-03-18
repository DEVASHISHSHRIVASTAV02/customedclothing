import { notFound } from "next/navigation";
import { AREA_KEYS, AreaKey } from "@/lib/constants";
import { getCustomerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCatalogColor } from "@/lib/color-catalog";
import { parseDraftStep6Message } from "@/lib/draft-preview-storage";
import { parseJsonObject } from "@/lib/utils";
import { CheckoutForm } from "@/components/customizer/checkout-form";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ draftId?: string; sessionId?: string; variantId?: string; productSlug?: string; approved?: string; areas?: string }>;
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

function extractAddress(value: unknown) {
  const source = parseJsonObject<Record<string, unknown>>(value, {});
  return {
    line1: typeof source.line1 === "string" ? source.line1 : "",
    line2: typeof source.line2 === "string" ? source.line2 : "",
    landmark: typeof source.landmark === "string" ? source.landmark : "",
    city: typeof source.city === "string" ? source.city : "",
    state: typeof source.state === "string" ? source.state : "",
    postalCode: typeof source.postalCode === "string" ? source.postalCode : "",
  };
}

export default async function CheckoutPage({ searchParams }: PageProps) {
  const customerSession = await getCustomerSession();
  const search = await searchParams;
  const selectedAreas = parseAreas(search.areas);

  const [config, customerProfile] = await Promise.all([
    prisma.shopConfig.findUnique({ where: { id: "default" } }),
    customerSession
      ? prisma.customerUser.findUnique({
        where: { id: customerSession.user.id },
        select: {
          fullName: true,
          email: true,
          phone: true,
          shippingAddressJson: true,
        },
      })
      : Promise.resolve(null),
  ]);
  const profileAddress = customerProfile ? extractAddress(customerProfile.shippingAddressJson) : null;

  if (search.draftId) {
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

    if (!draft) {
      notFound();
    }

    if (draft.customerId && draft.customerId !== customerSession?.user.id) {
      notFound();
    }
    const normalizedDraftColor = normalizeCatalogColor({
      colorCode: draft.productVariant.colorCode,
      colorName: draft.productVariant.colorName,
    });

    return (
      <div className="w-full min-h-screen">
        <div className="mx-auto w-full max-w-7xl px-6 py-8">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[#000000]/60">Checkout</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Finalize your custom order</h1>
          </div>

          <CheckoutForm
            orderSource={{ type: "draft", draftId: draft.id }}
            product={{
              productVariant: {
                id: draft.productVariant.id,
                sizeCode: draft.productVariant.sizeCode,
                colorName: normalizedDraftColor.colorName,
                basePriceInr: draft.productVariant.basePriceInr,
                productType: {
                  name: draft.productVariant.productType.name,
                  printAreas: draft.productVariant.productType.printAreas,
                },
              },
            }}
            selectedAreas={selectedAreas}
            shippingInr={config?.flatShippingInr ?? 99}
            designJsonByArea={parseJsonObject<Record<string, unknown>>(draft.designJsonByArea, {}) as Partial<Record<AreaKey, unknown>>}
            step6Message={parseDraftStep6Message(draft.previewImageUrls)}
            initialForm={customerProfile
              ? {
                customerName: customerProfile.fullName ?? "",
                email: customerProfile.email ?? "",
                phone: customerProfile.phone ?? "",
                line1: profileAddress?.line1 ?? "",
                line2: profileAddress?.line2 ?? "",
                landmark: profileAddress?.landmark ?? "",
                city: profileAddress?.city ?? "",
                state: profileAddress?.state ?? "",
                postalCode: profileAddress?.postalCode ?? "",
              }
              : undefined}
          />
        </div>
      </div>
    );
  }

  if (!search.sessionId || !search.variantId) {
    notFound();
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: search.variantId },
    include: {
      productType: {
        include: {
          printAreas: true,
        },
      },
    },
  });

  if (!variant || !variant.active || !variant.productType.active) {
    notFound();
  }

  if (search.productSlug && variant.productType.slug !== search.productSlug) {
    notFound();
  }
  const normalizedVariantColor = normalizeCatalogColor({
    colorCode: variant.colorCode,
    colorName: variant.colorName,
  });

  return (
    <div className="w-full min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[#000000]/60">Checkout</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Finalize your custom order</h1>
        </div>

        <CheckoutForm
          orderSource={{
            type: "session",
            sessionId: search.sessionId,
            productVariantId: variant.id,
            approved3d: search.approved === "1",
          }}
          product={{
            productVariant: {
              id: variant.id,
              sizeCode: variant.sizeCode,
              colorName: normalizedVariantColor.colorName,
              basePriceInr: variant.basePriceInr,
              productType: {
                name: variant.productType.name,
                printAreas: variant.productType.printAreas,
              },
            },
          }}
          selectedAreas={selectedAreas}
          shippingInr={config?.flatShippingInr ?? 99}
          initialForm={customerProfile
            ? {
              customerName: customerProfile.fullName ?? "",
              email: customerProfile.email ?? "",
              phone: customerProfile.phone ?? "",
              line1: profileAddress?.line1 ?? "",
              line2: profileAddress?.line2 ?? "",
              landmark: profileAddress?.landmark ?? "",
              city: profileAddress?.city ?? "",
              state: profileAddress?.state ?? "",
              postalCode: profileAddress?.postalCode ?? "",
            }
            : undefined}
        />
      </div>
    </div>
  );
}





