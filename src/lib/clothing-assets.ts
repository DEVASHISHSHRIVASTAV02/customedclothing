import type { StaticImageData } from "next/image";
import tshirtFrame1Image from "../../PreviewImages/Tshirt/Tshirt_1.png";
import tshirtFrame2Image from "../../PreviewImages/Tshirt/Tshirt_2.png";
import tshirtFrame3Image from "../../PreviewImages/Tshirt/Tshirt_3.png";
import tshirtFrame4Image from "../../PreviewImages/Tshirt/Tshirt_4.png";
import tshirtFrame5Image from "../../PreviewImages/Tshirt/Tshirt_5.png";
import tshirtFrame6Image from "../../PreviewImages/Tshirt/Tshirt_6.png";
import tshirtFrame7Image from "../../PreviewImages/Tshirt/Tshirt_7.png";
import tshirtFrame8Image from "../../PreviewImages/Tshirt/Tshirt_8.png";
import tshirtFrame9Image from "../../PreviewImages/Tshirt/Tshirt_9.png";
import tshirtFrame10Image from "../../PreviewImages/Tshirt/Tshirt_10.png";
import tshirtFrame11Image from "../../PreviewImages/Tshirt/Tshirt_11.png";
import tshirtFrame12Image from "../../PreviewImages/Tshirt/Tshirt_12.png";

type CanvasArea = "front" | "back";

const IMAGE_BY_TYPE: Record<string, StaticImageData> = {
  shirt: tshirtFrame1Image,
};

type CanvasImageSet = {
  front: StaticImageData;
  back?: StaticImageData;
  fallback: StaticImageData;
};

const CANVAS_IMAGE_BY_TYPE: Record<string, CanvasImageSet> = {
  shirt: {
    front: tshirtFrame1Image,
    back: tshirtFrame7Image,
    fallback: tshirtFrame1Image,
  },
};

const PREVIEW_360_FRAMES_BY_TYPE: Record<string, StaticImageData[]> = {
  shirt: [
    tshirtFrame1Image,
    tshirtFrame2Image,
    tshirtFrame3Image,
    tshirtFrame4Image,
    tshirtFrame5Image,
    tshirtFrame6Image,
    tshirtFrame7Image,
    tshirtFrame8Image,
    tshirtFrame9Image,
    tshirtFrame10Image,
    tshirtFrame11Image,
    tshirtFrame12Image,
  ],
};

const DEFAULT_CLOTHING_IMAGE = tshirtFrame1Image;

export function getClothingImageAsset(type: string) {
  return IMAGE_BY_TYPE[type] ?? DEFAULT_CLOTHING_IMAGE;
}

export function getClothingImageSrc(type: string) {
  return getClothingImageAsset(type).src;
}

export function getCanvasClothingImageSrc(type: string, area: CanvasArea) {
  const imageSet = CANVAS_IMAGE_BY_TYPE[type];

  if (!imageSet) {
    return getClothingImageSrc(type);
  }

  if (area === "front") {
    return imageSet.front.src;
  }

  if (area === "back") {
    return imageSet.back?.src;
  }

  return imageSet.fallback.src;
}

export function getPreview360FrameSources(type: string) {
  const frames = PREVIEW_360_FRAMES_BY_TYPE[type];
  if (!frames) {
    return [];
  }
  return frames.map((frame) => frame.src);
}
