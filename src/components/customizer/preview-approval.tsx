"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AreaKey } from "@/lib/constants";
import { Product360Preview } from "@/components/viewer/product-360-preview";
import { PreviewDetailsCard } from "@/components/customizer/preview-details-card";

type Props = {
  draftId: string;
  productSlug: string;
  productName: string;
  colorCode: string;
  colorName: string;
  sizeCode: string;
  basePriceInr: number;
  designJsonByArea: Partial<Record<AreaKey, unknown>>;
  areaAddonByArea: Partial<Record<AreaKey, number>>;
  previewByArea: Partial<Record<AreaKey, string>>;
  selectedAreas: AreaKey[];
  initialStep6Message?: string;
};

export function PreviewApproval({
  draftId,
  productSlug,
  productName,
  colorCode,
  colorName,
  sizeCode,
  basePriceInr,
  designJsonByArea,
  areaAddonByArea,
  previewByArea,
  selectedAreas,
  initialStep6Message = "",
}: Props) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step6Message, setStep6Message] = useState(initialStep6Message);
  const scopedPreviewByArea = useMemo(
    () =>
      selectedAreas.reduce<Partial<Record<AreaKey, string>>>((acc, area) => {
        const source = previewByArea[area];
        if (typeof source === "string" && source.length > 0) {
          acc[area] = source;
        }
        return acc;
      }, {}),
    [previewByArea, selectedAreas],
  );

  const onPrevious = () => {
    const areas = encodeURIComponent(selectedAreas.join(","));
    router.push(`/customize/${productSlug}?draftId=${draftId}&areas=${areas}&step=5`);
  };

  const onApprove = async () => {
    setApproving(true);
    setError(null);

    try {
      const exportResponse = await fetch(`/api/designs/draft/${draftId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedAreas,
          areaDataUrls: scopedPreviewByArea,
        }),
      });

      const exportData = await exportResponse.json();
      if (!exportResponse.ok) {
        throw new Error(exportData.error ?? "Unable to generate print exports.");
      }

      const patchResponse = await fetch(`/api/designs/draft/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved3d: true,
          step6Message,
        }),
      });

      const patchData = await patchResponse.json();
      if (!patchResponse.ok) {
        throw new Error(patchData.error ?? "Unable to approve 3D preview.");
      }

      const areas = encodeURIComponent(selectedAreas.join(","));
      router.push(`/checkout?draftId=${draftId}&areas=${areas}&productSlug=${productSlug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,760px)_360px]">
      <div className="space-y-4">
        <Product360Preview
          productSlug={productSlug}
          colorCode={colorCode}
          previewByArea={scopedPreviewByArea}
          selectedAreas={selectedAreas}
          step6Message={step6Message}
          onStep6MessageChange={setStep6Message}
          onPrevious={onPrevious}
          onApprove={onApprove}
          approving={approving}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
      <PreviewDetailsCard
        productSlug={productSlug}
        productName={productName}
        colorLabel={colorName}
        sizeLabel={sizeCode}
        basePriceInr={basePriceInr}
        previewByArea={scopedPreviewByArea}
        selectedAreas={selectedAreas}
        designJsonByArea={designJsonByArea}
        areaAddonByArea={areaAddonByArea}
      />
    </div>
  );
}

