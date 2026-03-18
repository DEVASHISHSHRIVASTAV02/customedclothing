import { type AreaKey, AREA_KEYS } from "@/lib/constants";

const GARMENT_LAYER_NAME = "__garment_backdrop__";

export const STEP3_TEXT_EDIT_COST_INR = 50;
export const STEP4_IMAGE_EDIT_COST_INR = 140;
export const STEP5_PAINT_EDIT_COST_INR = 60;

export type DesignEditCounts = {
  textEdits: number;
  imageEdits: number;
  paintEdits: number;
};

function parseAreaObjects(value: unknown) {
  if (!value || typeof value !== "object") {
    return [];
  }

  const objects = (value as { objects?: unknown }).objects;
  if (!Array.isArray(objects)) {
    return [];
  }

  return objects.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

function inferDesignEditType(object: Record<string, unknown>) {
  const name = typeof object.name === "string" ? object.name : "";
  if (name === GARMENT_LAYER_NAME) {
    return null;
  }

  const type = typeof object.type === "string" ? object.type.toLowerCase() : "";
  if (type === "textbox") {
    return "text" as const;
  }
  if (type === "image") {
    return "image" as const;
  }
  return "paint" as const;
}

function normalizeSelectedAreas(selectedAreas: AreaKey[]): AreaKey[] {
  const valid = selectedAreas.filter((area): area is AreaKey => AREA_KEYS.includes(area));
  return valid.length > 0 ? Array.from(new Set(valid)) : (["front"] as AreaKey[]);
}

export function getDesignEditCounts(
  designJsonByArea: Partial<Record<AreaKey, unknown>> | undefined,
  selectedAreas: AreaKey[],
): DesignEditCounts {
  const counts: DesignEditCounts = {
    textEdits: 0,
    imageEdits: 0,
    paintEdits: 0,
  };

  const areas = normalizeSelectedAreas(selectedAreas);
  areas.forEach((area) => {
    const objects = parseAreaObjects(designJsonByArea?.[area]);
    objects.forEach((object) => {
      const editType = inferDesignEditType(object);
      if (editType === "text") {
        counts.textEdits += 1;
        return;
      }
      if (editType === "image") {
        counts.imageEdits += 1;
        return;
      }
      if (editType === "paint") {
        counts.paintEdits += 1;
      }
    });
  });

  return counts;
}

export function calculateDesignEditPricePerItemInr(
  designJsonByArea: Partial<Record<AreaKey, unknown>> | undefined,
  selectedAreas: AreaKey[],
) {
  const counts = getDesignEditCounts(designJsonByArea, selectedAreas);
  return (
    counts.textEdits * STEP3_TEXT_EDIT_COST_INR
    + counts.imageEdits * STEP4_IMAGE_EDIT_COST_INR
    + counts.paintEdits * STEP5_PAINT_EDIT_COST_INR
  );
}
