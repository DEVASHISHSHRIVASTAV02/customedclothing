"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { type AreaKey } from "@/lib/constants";
import { readPreviewSession, savePreviewSession } from "@/lib/client-session";
import { Product360Preview } from "@/components/viewer/product-360-preview";
import { PreviewDetailsCard } from "@/components/customizer/preview-details-card";

type Props = {
  sessionId: string;
  productSlug: string;
  productName: string;
  areaAddonByArea: Partial<Record<AreaKey, number>>;
  variants: Array<{
    id: string;
    colorCode: string;
    colorName: string;
    sizeCode: string;
    basePriceInr: number;
  }>;
  requestedAreas: AreaKey[];
};

function subscribeNoop() {
  return () => {};
}

export function SessionPreviewApproval({
  sessionId,
  productSlug,
  productName,
  areaAddonByArea,
  variants,
  requestedAreas,
}: Props) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step6MessageDraft, setStep6MessageDraft] = useState<string | null>(null);
  const isHydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const sessionData = useMemo(
    () => (isHydrated ? readPreviewSession(sessionId) : null),
    [isHydrated, sessionId],
  );

  const loadError = useMemo(() => {
    if (!isHydrated) {
      return null;
    }

    return !sessionData || sessionData.productSlug !== productSlug
      ? "Unable to load your current design preview. Please return to customization."
      : null;
  }, [isHydrated, productSlug, sessionData]);

  const selectedAreas = useMemo(() => {
    if (!sessionData) {
      return requestedAreas.length > 0 ? requestedAreas : (["front"] as AreaKey[]);
    }

    const source = requestedAreas.length > 0 ? requestedAreas : sessionData.selectedAreas;
    const filtered = source.filter((area) => sessionData.selectedAreas.includes(area));
    return filtered.length > 0 ? Array.from(new Set(filtered)) : sessionData.selectedAreas;
  }, [requestedAreas, sessionData]);
  const step6Message = step6MessageDraft ?? sessionData?.step6Message ?? "";
  const scopedPreviewByArea = useMemo(
    () =>
      selectedAreas.reduce<Partial<Record<AreaKey, string>>>((acc, area) => {
        const source = sessionData?.previewImageUrls[area];
        if (typeof source === "string" && source.length > 0) {
          acc[area] = source;
        }
        return acc;
      }, {}),
    [selectedAreas, sessionData],
  );
  const selectedVariant = useMemo(() => {
    if (!sessionData) {
      return null;
    }

    return (
      variants.find((variant) => variant.id === sessionData.productVariantId)
      ?? variants.find(
        (variant) =>
          variant.colorCode === sessionData.selectedColor
          && variant.sizeCode === sessionData.selectedSize,
      )
      ?? null
    );
  }, [sessionData, variants]);

  const onPrevious = () => {
    if (sessionData) {
      savePreviewSession(sessionId, {
        ...sessionData,
        step6Message: step6Message.trim(),
      });
    }
    const areas = encodeURIComponent(selectedAreas.join(","));
    router.push(`/customize/${productSlug}?sessionId=${sessionId}&areas=${areas}&step=5`);
  };

  const onApprove = () => {
    if (!sessionData || loadError) {
      setError("Unable to continue. Please return to customization and try again.");
      return;
    }

    setApproving(true);
    savePreviewSession(sessionId, {
      ...sessionData,
      step6Message: step6Message.trim(),
    });
    const areas = encodeURIComponent(selectedAreas.join(","));
    router.push(
      `/checkout?sessionId=${sessionId}&variantId=${sessionData.productVariantId}&areas=${areas}&productSlug=${productSlug}&approved=1`,
    );
  };

  if (!isHydrated) {
    return <p className="text-sm text-[#000000]">Loading preview...</p>;
  }

  if (!sessionData || loadError) {
    return <p className="text-sm text-danger">{error ?? loadError}</p>;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,760px)_360px]">
      <div className="space-y-4">
        <Product360Preview
          productSlug={productSlug}
          colorCode={sessionData.selectedColor}
          previewByArea={scopedPreviewByArea}
          selectedAreas={selectedAreas}
          step6Message={step6Message}
          onStep6MessageChange={setStep6MessageDraft}
          onPrevious={onPrevious}
          onApprove={onApprove}
          approving={approving}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
      <PreviewDetailsCard
        productSlug={productSlug}
        productName={productName}
        colorLabel={selectedVariant?.colorName ?? sessionData.selectedColor}
        sizeLabel={selectedVariant?.sizeCode ?? sessionData.selectedSize}
        basePriceInr={selectedVariant?.basePriceInr ?? 0}
        previewByArea={scopedPreviewByArea}
        selectedAreas={selectedAreas}
        designJsonByArea={sessionData.designJsonByArea}
        areaAddonByArea={areaAddonByArea}
      />
    </div>
  );
}



