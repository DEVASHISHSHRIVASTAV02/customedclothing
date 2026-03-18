import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { type AreaKey, AREA_KEYS, AREA_LABELS } from "@/lib/constants";
import { normalizeCatalogColor } from "@/lib/color-catalog";
import { type DraftLayerPreviewKey } from "@/lib/draft-preview-storage";
import { parseJsonObject } from "@/lib/utils";

type BuildDesignWordReportInput = {
  context: "saved-draft" | "order";
  referenceId: string;
  product: {
    slug: string;
    colorCode?: string;
    colorName?: string;
    sizeCode?: string;
  };
  step6Message?: string;
  designJsonByArea: Partial<Record<AreaKey, unknown>>;
  layerPreviewPathsByArea?: Partial<Record<AreaKey, Partial<Record<DraftLayerPreviewKey, string>>>>;
};

type TextEditRow = {
  area: AreaKey;
  text: string;
  fontFamily: string;
  textColor: string;
  weight: string;
  style: string;
  underline: boolean;
  underlineColor: string;
  textBackgroundOn: boolean;
  textBackgroundColor: string;
  rotationDegree: number;
  flip: string;
  textLayerPngPath: string;
};

type ImageEditRow = {
  area: AreaKey;
  removeBackground: boolean;
  imageBackgroundOn: boolean;
  backgroundColor: string;
  rotationDegree: number;
  uploadLayerPngPath: string;
};

type Step5EditRow = {
  area: AreaKey;
  type: string;
  brushColor: string;
  brushWidth: number;
  editLayerPngPath: string;
};

function asString(value: unknown, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

function asBoolean(value: unknown, fallback = false) {
  if (typeof value !== "boolean") {
    return fallback;
  }
  return value;
}

function parseAreaObjects(value: unknown) {
  if (!value || typeof value !== "object") {
    return [];
  }

  const objects = (value as { objects?: unknown }).objects;
  if (!Array.isArray(objects)) {
    return [];
  }

  return objects.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
}

function toFlipLabel(flipX: boolean, flipY: boolean) {
  if (flipX && flipY) {
    return "both";
  }
  if (flipX) {
    return "left_to_right";
  }
  if (flipY) {
    return "upside_down";
  }
  return "none";
}

function toOnOff(value: boolean) {
  return value ? "on" : "off";
}

function formatSignedDegree(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const normalized = Math.abs(safeValue) < 0.000001 ? 0 : safeValue;
  const absoluteValue = Math.abs(normalized);
  const degreeValue = Number.isInteger(absoluteValue)
    ? String(absoluteValue)
    : absoluteValue.toFixed(2).replace(/\.?0+$/, "");
  const sign = normalized < 0 ? "-" : "+";
  return `${sign}${degreeValue}\u00B0`;
}

function addHeading(
  children: Paragraph[],
  text: string,
  level: (typeof HeadingLevel)[keyof typeof HeadingLevel],
) {
  children.push(new Paragraph({ text, heading: level }));
}

function addBlank(children: Paragraph[]) {
  children.push(new Paragraph({ text: "" }));
}

function addLine(children: Paragraph[], label: string, value: string) {
  children.push(new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: value }),
    ],
  }));
}

function addText(children: Paragraph[], value: string) {
  children.push(new Paragraph({ children: [new TextRun({ text: value })] }));
}

export async function buildDesignWordReportDocxBuffer(input: BuildDesignWordReportInput) {
  const normalizedDesignByArea = AREA_KEYS.reduce<Partial<Record<AreaKey, Record<string, unknown>>>>((acc, area) => {
    const areaJson = input.designJsonByArea[area];
    if (areaJson && typeof areaJson === "object") {
      acc[area] = parseJsonObject<Record<string, unknown>>(areaJson, {});
    }
    return acc;
  }, {});

  const textRows: TextEditRow[] = [];
  const imageRows: ImageEditRow[] = [];
  const step5Rows: Step5EditRow[] = [];

  const rectCountByArea = AREA_KEYS.reduce<Record<AreaKey, number>>((acc, area) => {
    acc[area] = 0;
    return acc;
  }, {} as Record<AreaKey, number>);
  const circleCountByArea = AREA_KEYS.reduce<Record<AreaKey, number>>((acc, area) => {
    acc[area] = 0;
    return acc;
  }, {} as Record<AreaKey, number>);

  for (const area of AREA_KEYS) {
    const objects = parseAreaObjects(normalizedDesignByArea[area]);
    const textLayerPngPath = asString(input.layerPreviewPathsByArea?.[area]?.text, "N/A");
    const uploadLayerPngPath = asString(input.layerPreviewPathsByArea?.[area]?.upload, "N/A");
    const editLayerPngPath = asString(input.layerPreviewPathsByArea?.[area]?.edit, "N/A");

    for (const object of objects) {
      const type = asString(object.type).toLowerCase();
      const name = asString(object.name);
      if (name === "__garment_backdrop__") {
        continue;
      }

      if (type === "textbox") {
        const underline = asBoolean(object.underline, false);
        const textBackgroundColor = asString(object.textBackgroundColor);
        textRows.push({
          area,
          text: asString(object.text),
          fontFamily: asString(object.fontFamily, "N/A"),
          textColor: asString(object.fill, "N/A"),
          weight: String(object.fontWeight ?? "normal"),
          style: asString(object.fontStyle, "normal"),
          underline,
          // Custom underline color is stored on stroke in canvas object.
          underlineColor: underline ? asString(object.stroke, "N/A") : "N/A",
          textBackgroundOn: textBackgroundColor.length > 0,
          textBackgroundColor: textBackgroundColor.length > 0 ? textBackgroundColor : "N/A",
          rotationDegree: asNumber(object.angle, 0),
          flip: toFlipLabel(asBoolean(object.flipX, false), asBoolean(object.flipY, false)),
          textLayerPngPath,
        });
        continue;
      }

      if (type === "image") {
        const backgroundColor = asString(object.backgroundColor);
        const originalUploadSource = asString((object as { __originalUploadSrc?: unknown }).__originalUploadSrc);
        const currentSource = asString(object.src);
        const explicitRemoveBackground = (object as { __backgroundRemoved?: unknown }).__backgroundRemoved;
        const removeBackground = typeof explicitRemoveBackground === "boolean"
          ? explicitRemoveBackground
          : originalUploadSource.length > 0
          && currentSource.length > 0
          && originalUploadSource !== currentSource;

        imageRows.push({
          area,
          removeBackground,
          imageBackgroundOn: backgroundColor.length > 0,
          backgroundColor: backgroundColor.length > 0 ? backgroundColor : "N/A",
          rotationDegree: asNumber(object.angle, 0),
          uploadLayerPngPath,
        });
        continue;
      }

      if (type === "rect") {
        rectCountByArea[area] += 1;
      }
      if (type === "circle") {
        circleCountByArea[area] += 1;
      }

      step5Rows.push({
        area,
        type: type.length > 0 ? type : "unknown",
        brushColor: asString(object.stroke, asString(object.fill, "N/A")),
        brushWidth: asNumber(object.strokeWidth, 0),
        editLayerPngPath,
      });
    }
  }

  const totalRectangles = AREA_KEYS.reduce((sum, area) => sum + rectCountByArea[area], 0);
  const totalCircles = AREA_KEYS.reduce((sum, area) => sum + circleCountByArea[area], 0);
  const normalizedProductColor = normalizeCatalogColor({
    colorCode: input.product.colorCode,
    colorName: input.product.colorName,
  });
  const clothingColor = normalizedProductColor.colorName || normalizedProductColor.colorCode || "N/A";
  const clothingSize = asString(input.product.sizeCode, "N/A");
  const step6Message = asString(input.step6Message);

  const children: Paragraph[] = [];
  addHeading(children, "Design Report", HeadingLevel.HEADING_1);
  addLine(children, "Generated At", new Date().toISOString());
  addLine(children, "Context", input.context);
  addLine(children, "Reference ID", input.referenceId);
  addBlank(children);

  addHeading(children, "Product Details", HeadingLevel.HEADING_2);
  addLine(children, "1. Clothing Color", clothingColor);
  addLine(children, "2. Clothing Size", clothingSize);
  addLine(children, "Product Slug", input.product.slug);
  addBlank(children);

  addHeading(children, "3. Text Edits (Step 3) - Final Canvas State", HeadingLevel.HEADING_2);
  if (textRows.length === 0) {
    addText(children, "No text edits in final canvas.");
  } else {
    textRows.forEach((row, index) => {
      addHeading(children, `Text #${index + 1}`, HeadingLevel.HEADING_3);
      addLine(children, "Design Area", AREA_LABELS[row.area]);
      addLine(children, "Text", row.text || "N/A");
      addLine(children, "Font Family", row.fontFamily);
      addLine(children, "Text Color", row.textColor);
      addLine(children, "Weight", row.weight);
      addLine(children, "Style", row.style);
      addLine(children, "Underline", toOnOff(row.underline));
      addLine(children, "Underline Color", row.underlineColor);
      addLine(children, "Text Background", toOnOff(row.textBackgroundOn));
      addLine(children, "Background Color", row.textBackgroundColor);
      addLine(children, "Rotation Degree", String(row.rotationDegree));
      addLine(children, "Flip", row.flip);
      addLine(children, "PNG File (Text Layer)", row.textLayerPngPath);
      addBlank(children);
    });
  }

  addHeading(children, "4. Image Edits (Step 4) - Final Canvas State", HeadingLevel.HEADING_2);
  if (imageRows.length === 0) {
    addText(children, "No image edits in final canvas.");
  } else {
    imageRows.forEach((row, index) => {
      addHeading(children, `Image #${index + 1}`, HeadingLevel.HEADING_3);
      addLine(children, "Design Area", AREA_LABELS[row.area]);
      addLine(children, "Remove Background", row.removeBackground ? "true" : "false");
      addLine(children, "Image Background", toOnOff(row.imageBackgroundOn));
      addLine(children, "Background Color", row.backgroundColor);
      addLine(children, "Rotation Degree (+/-)", formatSignedDegree(row.rotationDegree));
      addLine(children, "PNG File (Upload Layer)", row.uploadLayerPngPath);
      addBlank(children);
    });
  }

  addHeading(children, "5. Paint/Shape Edits (Step 5) - Final Canvas State", HeadingLevel.HEADING_2);
  if (step5Rows.length === 0) {
    addText(children, "No Step 5 edits in final canvas.");
  } else {
    step5Rows.forEach((row, index) => {
      addHeading(children, `Step 5 Edit #${index + 1}`, HeadingLevel.HEADING_3);
      addLine(children, "Design Area", AREA_LABELS[row.area]);
      addLine(children, "Type", row.type);
      addLine(children, "Brush Color", row.brushColor);
      addLine(children, "Brush Width", String(row.brushWidth));
      addLine(children, "PNG File (Edit Layer)", row.editLayerPngPath);
      addBlank(children);
    });
  }

  addHeading(children, "6. Step 6 Message Box", HeadingLevel.HEADING_2);
  addText(children, step6Message.length > 0 ? step6Message : "No message provided.");
  addBlank(children);

  addHeading(children, "7. Rectangle/Circle Frequency (Step 5)", HeadingLevel.HEADING_2);
  addLine(children, "Total Rectangles", String(totalRectangles));
  addLine(children, "Total Circles", String(totalCircles));
  AREA_KEYS.forEach((area) => {
    addText(children, `${AREA_LABELS[area]} -> Rectangles: ${rectCountByArea[area]}, Circles: ${circleCountByArea[area]}`);
  });
  addBlank(children);
  addText(children, "Note: This report includes only objects present in final canvas state.");

  const doc = new Document({
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
