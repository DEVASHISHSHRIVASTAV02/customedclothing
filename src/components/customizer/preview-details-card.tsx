"use client";

import NextImage from "next/image";
import { AreaKey, AREA_LABELS } from "@/lib/constants";
import { getCanvasClothingImageSrc } from "@/lib/clothing-assets";
import {
  STEP3_TEXT_EDIT_COST_INR,
  STEP4_IMAGE_EDIT_COST_INR,
  STEP5_PAINT_EDIT_COST_INR,
} from "@/lib/design-pricing";
import { isComposedPreviewSource } from "@/lib/preview-source";
import { formatInr } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

type PreviewMap = Partial<Record<AreaKey, string>>;

type DesignLine = {
  id: string;
  area: AreaKey;
  step: 3 | 4 | 5;
  label: string;
  costInr: number;
};

type Props = {
  productSlug: string;
  productName: string;
  colorLabel: string;
  sizeLabel: string;
  basePriceInr: number;
  previewByArea: PreviewMap;
  selectedAreas: AreaKey[];
  designJsonByArea: Partial<Record<AreaKey, unknown>>;
  areaAddonByArea: Partial<Record<AreaKey, number>>;
};

const DESIGN_OBJECT_TYPE_LABEL: Record<string, string> = {
  path: "Paint",
  rect: "Rectangle",
  circle: "Circle",
  ellipse: "Ellipse",
  triangle: "Triangle",
  polygon: "Polygon",
  polyline: "Polyline",
  line: "Line",
};

function parseAreaDesignLines(area: AreaKey, value: unknown): DesignLine[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const objects = (value as { objects?: unknown }).objects;
  if (!Array.isArray(objects)) {
    return [];
  }

  let textCount = 0;
  let imageCount = 0;
  let paintCount = 0;

  const lines: DesignLine[] = [];
  objects.forEach((object, index) => {
    if (!object || typeof object !== "object") {
      return;
    }

    const name = (object as { name?: unknown }).name;
    if (name === "__garment_backdrop__") {
      return;
    }

    const type = typeof (object as { type?: unknown }).type === "string"
      ? String((object as { type: string }).type).toLowerCase()
      : "";

    if (type === "textbox") {
      textCount += 1;
      lines.push({
        id: `${area}-text-${index}`,
        area,
        step: 3,
        label: `${AREA_LABELS[area]}: Text ${textCount}`,
        costInr: STEP3_TEXT_EDIT_COST_INR,
      });
      return;
    }

    if (type === "image") {
      imageCount += 1;
      lines.push({
        id: `${area}-image-${index}`,
        area,
        step: 4,
        label: `${AREA_LABELS[area]}: Image ${imageCount}`,
        costInr: STEP4_IMAGE_EDIT_COST_INR,
      });
      return;
    }

    paintCount += 1;
    const paintType = DESIGN_OBJECT_TYPE_LABEL[type] ?? "Paint";
    lines.push({
      id: `${area}-paint-${index}`,
      area,
      step: 5,
      label: `${AREA_LABELS[area]}: ${paintType} ${paintCount}`,
      costInr: STEP5_PAINT_EDIT_COST_INR,
    });
  });

  return lines;
}

function DesignPreviewThumbnail({
  area,
  label,
  baseSrc,
  overlaySrc,
}: {
  area: AreaKey;
  label: string;
  baseSrc: string | null;
  overlaySrc?: string;
}) {
  const overlayIsComposedPreview = isComposedPreviewSource(overlaySrc);
  const previewInsetClass = area === "back" ? "absolute inset-[5.5%]" : "absolute inset-[4%]";

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-[#000000]">{label}</p>
      <div className="rounded-xl border border-[#ffffff]/80 bg-[#ffffff]">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-[#ffffff]">
          <div className={previewInsetClass}>
            {overlayIsComposedPreview && overlaySrc ? (
              <NextImage
                src={overlaySrc}
                alt={`${label} preview`}
                fill
                unoptimized
                sizes="(max-width: 1024px) 50vw, 180px"
                className="pointer-events-none object-contain"
                priority={false}
              />
            ) : (
              <>
                {baseSrc ? (
                  <NextImage
                    src={baseSrc}
                    alt={`${label} base`}
                    fill
                    sizes="(max-width: 1024px) 50vw, 180px"
                    className="object-contain"
                    priority={false}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-[#000000]">No base image</div>
                )}
                {overlaySrc ? (
                  <NextImage
                    src={overlaySrc}
                    alt={`${label} design overlay`}
                    fill
                    unoptimized
                    sizes="(max-width: 1024px) 50vw, 180px"
                    className="pointer-events-none object-contain"
                    priority={false}
                  />
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PreviewDetailsCard({
  productSlug,
  productName,
  colorLabel,
  sizeLabel,
  basePriceInr,
  previewByArea,
  selectedAreas,
  designJsonByArea,
  areaAddonByArea,
}: Props) {
  const pricedDesignLines = selectedAreas.flatMap((area) => parseAreaDesignLines(area, designJsonByArea[area]));
  const designPriceInr = pricedDesignLines.reduce((sum, line) => sum + line.costInr, 0);
  const areaAddonTotalInr = selectedAreas.reduce(
    (sum, area) => sum + Math.max(0, Number(areaAddonByArea[area] ?? 0)),
    0,
  );
  const finalPriceInr = Math.max(0, basePriceInr) + areaAddonTotalInr + designPriceInr;

  const frontBaseSrc = getCanvasClothingImageSrc(productSlug, "front") ?? null;
  const backBaseSrc = getCanvasClothingImageSrc(productSlug, "back") ?? null;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">{productName}</h2>
      </CardHeader>
      <CardBody className="space-y-4 text-sm text-[#000000]">
        <div className="grid grid-cols-1 gap-4">
          <DesignPreviewThumbnail area="front" label="Front" baseSrc={frontBaseSrc} overlaySrc={previewByArea.front} />
          <DesignPreviewThumbnail area="back" label="Back" baseSrc={backBaseSrc} overlaySrc={previewByArea.back} />
        </div>

        <div className="space-y-1 rounded-xl border border-[#ffffff]/80 bg-[#ffffff]/75 p-3">
          <p><strong>Color:</strong> {colorLabel}</p>
          <p><strong>Size:</strong> {sizeLabel}</p>
        </div>

        <div className="space-y-2 rounded-xl border border-[#ffffff]/80 bg-[#ffffff]/75 p-3">
          <h3 className="font-medium">Design Price (Step 3/4/5)</h3>
          {pricedDesignLines.length > 0 ? (
            <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
              {pricedDesignLines.map((line) => (
                <div key={line.id} className="flex items-start justify-between gap-2 text-xs">
                  <p>{line.label} (Step {line.step})</p>
                  <p className="whitespace-nowrap">{formatInr(line.costInr)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#000000]">No priced design entries found.</p>
          )}
        </div>

        <div className="space-y-2 rounded-xl border border-[#ffffff]/80 bg-[#ffffff]/75 p-3">
          <div className="flex items-center justify-between">
            <p>Base Product Price</p>
            <p>{formatInr(Math.max(0, basePriceInr))}</p>
          </div>
          <div className="flex items-center justify-between">
            <p>Print Area Add-ons</p>
            <p>{formatInr(areaAddonTotalInr)}</p>
          </div>
          <div className="flex items-center justify-between">
            <p>Design Price</p>
            <p>{formatInr(designPriceInr)}</p>
          </div>
          <div className="flex items-center justify-between border-t border-[#ffffff]/80 pt-2 font-semibold">
            <p>Final Price</p>
            <p>{formatInr(finalPriceInr)}</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}



