import { NextRequest } from "next/server";
import { OrderStatus, PrintAreaCode, Prisma } from "@prisma/client";
import { getCustomerSession } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { buildStoragePublicUrl } from "@/lib/storage";
import { AREA_CODE_TO_KEY, AREA_KEYS, type AreaKey } from "@/lib/constants";
import { parseDraftPreviewMap, resolveDraftPreviewMap } from "@/lib/draft-preview-storage";
import { normalizeCatalogColor } from "@/lib/color-catalog";
import { parseJsonObject } from "@/lib/utils";
import { updateCustomerProfileSchema } from "@/lib/validation";

const EMPTY_PREVIEW_DATA_URL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

function toAreaKeyFromPrintCode(value: unknown): AreaKey | null {
  if (typeof value !== "string") {
    return null;
  }

  const resolved = AREA_CODE_TO_KEY[value as PrintAreaCode];
  return resolved ?? null;
}

function uniqueAreas(input: AreaKey[]) {
  return input.length > 0 ? Array.from(new Set(input)) : ["front"];
}

function areaHasDesignObjects(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const objects = (value as { objects?: unknown }).objects;
  if (Array.isArray(objects)) {
    return objects.some((entry) => {
      if (!entry || typeof entry !== "object") {
        return false;
      }
      return (entry as { name?: unknown }).name !== "__garment_backdrop__";
    });
  }

  return Object.keys(value as Record<string, unknown>).length > 0;
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

function normalizeDraftPreviewUrls(value: unknown, versionToken: string) {
  const previewByArea = resolveDraftPreviewMap(value);

  return Object.fromEntries(
    AREA_KEYS.map((area) => {
      const preview = previewByArea[area];
      if (typeof preview === "string" && preview.trim().length > 0) {
        return [area, appendVersionToPreviewUrl(preview, versionToken)];
      }
      return [area, EMPTY_PREVIEW_DATA_URL];
    }),
  ) as Record<AreaKey, string>;
}

function deriveAreasFromDraftJson(
  designJsonByArea: unknown,
  previewImageUrls: unknown,
) {
  const designByArea = parseJsonObject<Record<string, unknown>>(designJsonByArea, {});
  const designedAreas = AREA_KEYS.filter((area) => areaHasDesignObjects(designByArea[area]));
  if (designedAreas.length > 0) {
    return uniqueAreas(designedAreas);
  }

  const previewByArea = parseDraftPreviewMap(previewImageUrls);

  const matchedAreas = AREA_KEYS.filter((area) => {
    const previewValue = previewByArea[area];
    return typeof previewValue === "string"
      && previewValue.trim().length > 0
      && previewValue !== EMPTY_PREVIEW_DATA_URL;
  });

  return uniqueAreas(matchedAreas);
}

function deriveAreasFromOrderSnapshot(value: unknown) {
  if (!Array.isArray(value)) {
    return ["front"] as AreaKey[];
  }

  const matchedAreas = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      return toAreaKeyFromPrintCode((entry as { code?: unknown }).code);
    })
    .filter((area): area is AreaKey => area !== null);

  return uniqueAreas(matchedAreas);
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
    country: typeof source.country === "string" ? source.country : "India",
  };
}

function hasAddressValue(address: ReturnType<typeof extractAddress>) {
  return (
    address.line1.trim().length > 0
    || address.line2.trim().length > 0
    || address.landmark.trim().length > 0
    || address.city.trim().length > 0
    || address.state.trim().length > 0
    || address.postalCode.trim().length > 0
  );
}

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return fail("Unauthorized", 401);
  }

  const customer = await prisma.customerUser.findUnique({
    where: { id: session.user.id },
    include: {
      drafts: {
        where: {
          savedToAccount: true,
        },
        orderBy: { updatedAt: "desc" },
        include: {
          productVariant: {
            include: {
              productType: true,
            },
          },
          _count: {
            select: {
              orders: true,
            },
          },
        },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            orderBy: { createdAt: "asc" },
            take: 1,
          },
          draft: {
            select: {
              productVariant: {
                select: {
                  productType: {
                    select: {
                      slug: true,
                    },
                  },
                },
              },
            },
          },
          statusLogs: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!customer) {
    return fail("Customer account not found.", 404);
  }

  const savedDrafts = customer.drafts
    .filter((draft) => draft._count.orders === 0)
    .map((draft) => {
      const selectedAreas = deriveAreasFromDraftJson(draft.designJsonByArea, draft.previewImageUrls);
      const previewByArea = normalizeDraftPreviewUrls(draft.previewImageUrls, String(draft.updatedAt.getTime()));
      const normalizedColor = normalizeCatalogColor({
        colorCode: draft.productVariant.colorCode,
        colorName: draft.productVariant.colorName,
      });

      return {
        id: draft.id,
        productSlug: draft.productVariant.productType.slug,
        productName: draft.productVariant.productType.name,
        colorName: normalizedColor.colorName,
        sizeCode: draft.productVariant.sizeCode,
        selectedAreas,
        previewImageUrls: previewByArea,
        updatedAt: draft.updatedAt,
        approved3d: draft.approved3d,
      };
    });

  const orders = customer.orders.map((order) => {
    const item = order.items[0] ?? null;
    const variantSnapshot = parseJsonObject<Record<string, unknown>>(item?.productVariantSnapshotJson, {});
    const rawColorCode = typeof variantSnapshot.colorCode === "string" ? variantSnapshot.colorCode : "";
    const rawColorName = typeof variantSnapshot.colorName === "string" ? variantSnapshot.colorName : "";
    const normalizedColor = normalizeCatalogColor({
      colorCode: rawColorCode,
      colorName: rawColorName,
    });
    const printSnapshot = item ? item.printAreaSnapshotJson : [];
    const designExportPaths = parseJsonObject<Record<string, string>>(item?.designExportPathsJson, {});
    const selectedAreas = deriveAreasFromOrderSnapshot(printSnapshot);
    const shippedAt = order.statusLogs.find((log) => log.toStatus === OrderStatus.SHIPPED)?.createdAt ?? null;
    const address = extractAddress(order.addressJson);

    const imageUrls = Object.fromEntries(
      AREA_KEYS.map((area) => {
        const relativePath = designExportPaths[area];
        if (!relativePath || typeof relativePath !== "string") {
          return [area, null];
        }
        return [area, buildStoragePublicUrl("orders", relativePath)];
      }),
    ) as Record<AreaKey, string | null>;

    return {
      id: order.id,
      orderCode: order.orderCode,
      status: order.status,
      paymentState: order.paymentState,
      totalInr: order.totalInr,
      createdAt: order.createdAt,
      shippedAt,
      quantity: item?.quantity ?? 1,
      lineTotalInr: item?.lineTotalInr ?? order.totalInr,
      productName: typeof variantSnapshot.productType === "string" ? variantSnapshot.productType : "Custom Product",
      productSlug: order.draft?.productVariant.productType.slug ?? "",
      sizeCode: typeof variantSnapshot.size === "string" ? variantSnapshot.size : "",
      colorName: normalizedColor.colorName,
      colorCode: normalizedColor.colorCode,
      selectedAreas,
      imageUrls,
      shippingContact: {
        customerName: order.customerName,
        email: order.email,
        phone: order.phone,
      },
      shippingAddress: address,
    };
  });

  const latestOrder = orders[0] ?? null;
  const storedAddress = extractAddress(customer.shippingAddressJson);
  const profileAddress = hasAddressValue(storedAddress)
    ? storedAddress
    : latestOrder?.shippingAddress ?? extractAddress({});
  const profileName = typeof customer.fullName === "string" && customer.fullName.trim().length > 0
    ? customer.fullName
    : latestOrder?.shippingContact.customerName ?? "";
  const profileEmail = customer.email ?? latestOrder?.shippingContact.email ?? null;
  const profilePhone = customer.phone ?? latestOrder?.shippingContact.phone ?? null;

  return ok({
    customer: {
      id: customer.id,
      loginId: customer.loginId,
      email: profileEmail,
      phone: profilePhone,
      fullName: profileName,
      shippingAddress: profileAddress,
      createdAt: customer.createdAt,
    },
    savedDrafts,
    orders,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getCustomerSession();
  if (!session) {
    return fail("Unauthorized", 401);
  }

  const json = await request.json().catch(() => null);
  const parsed = updateCustomerProfileSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Invalid customer profile payload.", 400, { issues: parsed.error.flatten() });
  }

  const payload = parsed.data;

  try {
    const updatedCustomer = await prisma.customerUser.update({
      where: { id: session.user.id },
      data: {
        fullName: payload.customerName.trim(),
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone.trim(),
        shippingAddressJson: {
          line1: payload.address.line1,
          line2: payload.address.line2 ?? "",
          landmark: payload.address.landmark ?? "",
          city: payload.address.city,
          state: payload.address.state,
          postalCode: payload.address.postalCode,
          country: payload.address.country || "India",
        } as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        loginId: true,
        email: true,
        phone: true,
        fullName: true,
        shippingAddressJson: true,
        createdAt: true,
      },
    });

    return ok({
      customer: {
        id: updatedCustomer.id,
        loginId: updatedCustomer.loginId,
        email: updatedCustomer.email,
        phone: updatedCustomer.phone,
        fullName: updatedCustomer.fullName ?? "",
        shippingAddress: extractAddress(updatedCustomer.shippingAddressJson),
        createdAt: updatedCustomer.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("That email or phone is already in use by another account.", 409);
    }

    const detail = error instanceof Error ? error.message : "Unexpected error.";
    return fail(
      "Unable to update shipping and contact information right now.",
      500,
      process.env.NODE_ENV === "development" ? { detail } : undefined,
    );
  }
}
