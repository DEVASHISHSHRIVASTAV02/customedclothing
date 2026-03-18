"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import NextImage from "next/image";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, RoundedBox } from "@react-three/drei";
import { Color, LinearFilter, SRGBColorSpace, Texture, TextureLoader } from "three";
import { AreaKey } from "@/lib/constants";
import { getCanvasClothingImageSrc, getPreview360FrameSources } from "@/lib/clothing-assets";
import { isComposedPreviewSource } from "@/lib/preview-source";
import { Button } from "@/components/ui/button";

type PreviewMap = Partial<Record<AreaKey, string>>;
const FLOW_BUTTON_WHITE_CLASS = "!border-[#000000] !bg-[#ffffff] !text-[#000000] hover:!border-[#000000] hover:!bg-[#000000] hover:!text-[#ffffff] active:!border-[#000000] active:!bg-[#000000] active:!text-[#ffffff] disabled:!border-[#000000]/20 disabled:!bg-[#ffffff] disabled:!text-[#000000]/45 disabled:hover:!border-[#000000]/20 disabled:hover:!bg-[#ffffff] disabled:hover:!text-[#000000]/45";

type Props = {
  productSlug: string;
  colorCode: string;
  previewByArea: PreviewMap;
  selectedAreas: AreaKey[];
  step6Message: string;
  onStep6MessageChange: (value: string) => void;
  onPrevious: () => void;
  onApprove: () => void;
  approving: boolean;
};

type BoxStyle = {
  width: number;
  height: number;
  depth: number;
};

type OverlayPlacement = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotation: number;
  skewX?: number;
};

type OverlaySourceRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

const modelStyleBySlug: Record<string, BoxStyle> = {
  shirt: { width: 2.2, height: 2.4, depth: 1.1 },
};

const EDITOR_CANVAS_SIZE = 640;
const EDITOR_CANVAS_PADDING = 16;
const AREA_VISIBILITY_THRESHOLD = 0.08;

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

function useLoadedImage(source?: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let disposed = false;

    if (!source || source.trim().length === 0) {
      void Promise.resolve().then(() => {
        if (!disposed) {
          setImage(null);
        }
      });
      return () => {
        disposed = true;
      };
    }

    void loadImage(source).then((loaded) => {
      if (!disposed) {
        setImage(loaded);
      }
    });

    return () => {
      disposed = true;
    };
  }, [source]);

  return image;
}

function useLoadedImages(sources: string[]) {
  const [images, setImages] = useState<(HTMLImageElement | null)[]>([]);

  useEffect(() => {
    let disposed = false;

    if (sources.length === 0) {
      void Promise.resolve().then(() => {
        if (!disposed) {
          setImages([]);
        }
      });
      return () => {
        disposed = true;
      };
    }

    void Promise.all(sources.map((source) => loadImage(source))).then((loaded) => {
      if (!disposed) {
        setImages(loaded);
      }
    });

    return () => {
      disposed = true;
    };
  }, [sources]);

  return images;
}

function drawOverlay(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  placement: OverlayPlacement,
  alpha: number,
  sourceRect?: OverlaySourceRect | null,
) {
  if (!image || alpha <= 0.01 || placement.width <= 0 || placement.height <= 0) {
    return;
  }

  context.save();
  context.globalAlpha = Math.min(1, Math.max(0, alpha));
  context.translate(placement.centerX, placement.centerY);
  context.rotate(placement.rotation);
  if (placement.skewX && Math.abs(placement.skewX) > 0.0001) {
    // Skew simulates Y-axis (3D-like) turning instead of flat Z-axis spin.
    context.transform(1, 0, placement.skewX, 1, 0, 0);
  }
  if (sourceRect && sourceRect.sw > 0 && sourceRect.sh > 0) {
    context.drawImage(
      image,
      sourceRect.sx,
      sourceRect.sy,
      sourceRect.sw,
      sourceRect.sh,
      -placement.width / 2,
      -placement.height / 2,
      placement.width,
      placement.height,
    );
  } else {
    context.drawImage(
      image,
      -placement.width / 2,
      -placement.height / 2,
      placement.width,
      placement.height,
    );
  }
  context.restore();
}

function getFittedRectInEditorCanvas(sourceWidth: number, sourceHeight: number) {
  const availableSize = EDITOR_CANVAS_SIZE - EDITOR_CANVAS_PADDING * 2;
  const fitScale = Math.min(availableSize / sourceWidth, availableSize / sourceHeight);
  const fittedWidth = sourceWidth * fitScale;
  const fittedHeight = sourceHeight * fitScale;
  return {
    x: (EDITOR_CANVAS_SIZE - fittedWidth) / 2,
    y: (EDITOR_CANVAS_SIZE - fittedHeight) / 2,
    width: fittedWidth,
    height: fittedHeight,
  };
}

function getOverlaySourceRect(
  overlay: HTMLImageElement | null,
  editorBase: HTMLImageElement | null,
) {
  if (!overlay || !editorBase) {
    return null;
  }

  const baseWidth = editorBase.naturalWidth || editorBase.width;
  const baseHeight = editorBase.naturalHeight || editorBase.height;
  const overlayWidth = overlay.naturalWidth || overlay.width;
  const overlayHeight = overlay.naturalHeight || overlay.height;
  if (baseWidth <= 0 || baseHeight <= 0 || overlayWidth <= 0 || overlayHeight <= 0) {
    return null;
  }

  const editorRect = getFittedRectInEditorCanvas(baseWidth, baseHeight);
  const scaleX = overlayWidth / EDITOR_CANVAS_SIZE;
  const scaleY = overlayHeight / EDITOR_CANVAS_SIZE;
  const sx = Math.max(0, Math.min(overlayWidth - 1, editorRect.x * scaleX));
  const sy = Math.max(0, Math.min(overlayHeight - 1, editorRect.y * scaleY));
  const sw = Math.max(1, Math.min(overlayWidth - sx, editorRect.width * scaleX));
  const sh = Math.max(1, Math.min(overlayHeight - sy, editorRect.height * scaleY));

  return { sx, sy, sw, sh };
}

function buildGarmentMaskCanvas(image: HTMLImageElement) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (width <= 0 || height <= 0) {
    return null;
  }

  const analysisCanvas = document.createElement("canvas");
  analysisCanvas.width = width;
  analysisCanvas.height = height;
  const context = analysisCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, width, height);
  const maskData = context.getImageData(0, 0, width, height);
  const pixels = maskData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] ?? 255;
    const g = pixels[i + 1] ?? 255;
    const b = pixels[i + 2] ?? 255;
    const a = pixels[i + 3] ?? 255;
    const isForeground = a > 8 && !(r > 245 && g > 245 && b > 245);
    pixels[i] = 255;
    pixels[i + 1] = 255;
    pixels[i + 2] = 255;
    pixels[i + 3] = isForeground ? 255 : 0;
  }

  context.putImageData(maskData, 0, 0);
  return analysisCanvas;
}

function getOpaqueImageBounds(image: HTMLImageElement) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (width <= 0 || height <= 0) {
    return null;
  }

  const analysisCanvas = document.createElement("canvas");
  analysisCanvas.width = width;
  analysisCanvas.height = height;
  const context = analysisCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3] ?? 0;
      if (alpha <= 8) {
        continue;
      }

      if (x < minX) {
        minX = x;
      }
      if (y < minY) {
        minY = y;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (y > maxY) {
        maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function normalizeGarmentImageToFrame(
  image: HTMLImageElement | null,
  targetWidth: number,
  targetHeight: number,
) {
  if (!image || targetWidth <= 0 || targetHeight <= 0) {
    return "";
  }

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return "";
  }

  const bounds = getOpaqueImageBounds(image);
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
    return "";
  }

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;
  const sourceContext = sourceCanvas.getContext("2d");
  if (!sourceContext) {
    return "";
  }
  sourceContext.drawImage(image, 0, 0, sourceWidth, sourceHeight);

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = targetWidth;
  outputCanvas.height = targetHeight;
  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) {
    return "";
  }

  const padding = 0.02;
  const availableWidth = targetWidth * (1 - padding * 2);
  const availableHeight = targetHeight * (1 - padding * 2);
  const scale = Math.min(availableWidth / bounds.width, availableHeight / bounds.height);
  if (!Number.isFinite(scale) || scale <= 0) {
    return "";
  }

  const drawWidth = bounds.width * scale;
  const drawHeight = bounds.height * scale;
  const drawX = (targetWidth - drawWidth) / 2;
  const drawY = (targetHeight - drawHeight) / 2;

  outputContext.drawImage(
    sourceCanvas,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    drawX,
    drawY,
    drawWidth,
    drawHeight,
  );

  try {
    return outputCanvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

function normalizeAreaVisibility(facing: number) {
  if (facing <= AREA_VISIBILITY_THRESHOLD) {
    return 0;
  }

  const normalized = (facing - AREA_VISIBILITY_THRESHOLD) / (1 - AREA_VISIBILITY_THRESHOLD);
  return Math.pow(Math.min(1, Math.max(0, normalized)), 0.85);
}

function normalizeAngleDelta(angle: number) {
  let normalized = angle;
  while (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }
  while (normalized < -Math.PI) {
    normalized += Math.PI * 2;
  }
  return normalized;
}

function fitPlacementToSourceAspect(
  maxWidth: number,
  maxHeight: number,
  sourceRect?: OverlaySourceRect | null,
) {
  const clampedWidth = Math.max(0, maxWidth);
  const clampedHeight = Math.max(0, maxHeight);
  if (clampedWidth <= 0 || clampedHeight <= 0) {
    return { width: 0, height: 0 };
  }

  if (!sourceRect || sourceRect.sw <= 0 || sourceRect.sh <= 0) {
    return { width: clampedWidth, height: clampedHeight };
  }

  const sourceAspect = sourceRect.sw / sourceRect.sh;
  let width = clampedWidth;
  let height = width / sourceAspect;

  if (height > clampedHeight) {
    height = clampedHeight;
    width = height * sourceAspect;
  }

  return { width, height };
}

function softenedPerspectiveScale(facing: number) {
  const clampedFacing = Math.min(1, Math.max(0, facing));
  // Keep angled frames closer to frame 1 size while preserving depth effect.
  return 0.72 + 0.28 * clampedFacing;
}

function composeBaseAndOverlay(
  baseImage: HTMLImageElement | null,
  overlayImage: HTMLImageElement | null,
  sourceRect?: OverlaySourceRect | null,
) {
  if (!baseImage) {
    return "";
  }

  const width = baseImage.naturalWidth || baseImage.width;
  const height = baseImage.naturalHeight || baseImage.height;
  if (width <= 0 || height <= 0) {
    return "";
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return "";
  }

  context.drawImage(baseImage, 0, 0, width, height);

  if (overlayImage) {
    if (sourceRect && sourceRect.sw > 0 && sourceRect.sh > 0) {
      context.drawImage(
        overlayImage,
        sourceRect.sx,
        sourceRect.sy,
        sourceRect.sw,
        sourceRect.sh,
        0,
        0,
        width,
        height,
      );
    } else {
      context.drawImage(overlayImage, 0, 0, width, height);
    }
  }

  const garmentMask = buildGarmentMaskCanvas(baseImage);
  if (garmentMask) {
    // Keep only the apparel silhouette so no rectangular frame/background is visible.
    context.save();
    context.globalCompositeOperation = "destination-in";
    context.drawImage(garmentMask, 0, 0, width, height);
    context.restore();
  }

  try {
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

function TshirtFramePreview({
  previewByArea,
}: {
  previewByArea: PreviewMap;
}) {
  const useCameraPreview = true;
  const frameSources = useMemo(() => getPreview360FrameSources("shirt"), []);
  const [frameIndex, setFrameIndex] = useState(0);
  const frameImages = useLoadedImages(frameSources);
  const directFrontBaseImage = useLoadedImage(getCanvasClothingImageSrc("shirt", "front"));
  const directBackBaseImage = useLoadedImage(
    getCanvasClothingImageSrc("shirt", "back") ?? getCanvasClothingImageSrc("shirt", "front"),
  );
  const editorFrontBaseImage = directFrontBaseImage ?? frameImages[0] ?? null;
  const editorBackBaseImage = directBackBaseImage ?? frameImages[6] ?? editorFrontBaseImage;

  const frontOverlay = useLoadedImage(previewByArea.front);
  const backOverlay = useLoadedImage(previewByArea.back);
  const frontOverlaySource = useMemo(
    () => getOverlaySourceRect(frontOverlay, editorFrontBaseImage),
    [editorFrontBaseImage, frontOverlay],
  );
  const backOverlaySource = useMemo(
    () => getOverlaySourceRect(backOverlay, editorBackBaseImage),
    [backOverlay, editorBackBaseImage],
  );
  const frontUsesComposedPreview = isComposedPreviewSource(previewByArea.front);
  const backUsesComposedPreview = isComposedPreviewSource(previewByArea.back);
  const composedFrontSource = useMemo(
    () => (frontUsesComposedPreview ? previewByArea.front ?? "" : composeBaseAndOverlay(editorFrontBaseImage, frontOverlay, frontOverlaySource)),
    [editorFrontBaseImage, frontOverlay, frontOverlaySource, frontUsesComposedPreview, previewByArea.front],
  );
  const composedBackSource = useMemo(
    () => (backUsesComposedPreview ? previewByArea.back ?? "" : composeBaseAndOverlay(editorBackBaseImage, backOverlay, backOverlaySource)),
    [backOverlay, backOverlaySource, backUsesComposedPreview, editorBackBaseImage, previewByArea.back],
  );
  const composedFrontImage = useLoadedImage(composedFrontSource);
  const composedBackImage = useLoadedImage(composedBackSource);
  const frontOpaqueBounds = useMemo(
    () => (composedFrontImage ? getOpaqueImageBounds(composedFrontImage) : null),
    [composedFrontImage],
  );
  const backOpaqueBounds = useMemo(
    () => (composedBackImage ? getOpaqueImageBounds(composedBackImage) : null),
    [composedBackImage],
  );
  const normalizedFrameSize = useMemo(() => {
    const frontBoundsWidth = frontOpaqueBounds?.width ?? 0;
    const frontBoundsHeight = frontOpaqueBounds?.height ?? 0;
    const backBoundsWidth = backOpaqueBounds?.width ?? 0;
    const backBoundsHeight = backOpaqueBounds?.height ?? 0;
    const frontWidth = composedFrontImage?.naturalWidth ?? composedFrontImage?.width ?? 0;
    const frontHeight = composedFrontImage?.naturalHeight ?? composedFrontImage?.height ?? 0;
    const backWidth = composedBackImage?.naturalWidth ?? composedBackImage?.width ?? 0;
    const backHeight = composedBackImage?.naturalHeight ?? composedBackImage?.height ?? 0;

    if (frontBoundsWidth > 0 && frontBoundsHeight > 0) {
      return { width: frontBoundsWidth, height: frontBoundsHeight };
    }

    if (backBoundsWidth > 0 && backBoundsHeight > 0) {
      return { width: backBoundsWidth, height: backBoundsHeight };
    }

    if (frontWidth > 0 && frontHeight > 0) {
      return { width: frontWidth, height: frontHeight };
    }

    if (backWidth > 0 && backHeight > 0) {
      return { width: backWidth, height: backHeight };
    }

    return { width: 880, height: 900 };
  }, [backOpaqueBounds, composedBackImage, composedFrontImage, frontOpaqueBounds]);
  const normalizedFrontSource = useMemo(
    () => normalizeGarmentImageToFrame(composedFrontImage, normalizedFrameSize.width, normalizedFrameSize.height),
    [composedFrontImage, normalizedFrameSize.height, normalizedFrameSize.width],
  );
  const normalizedBackSource = useMemo(
    () => normalizeGarmentImageToFrame(composedBackImage, normalizedFrameSize.width, normalizedFrameSize.height),
    [composedBackImage, normalizedFrameSize.height, normalizedFrameSize.width],
  );
  const frontTextureSource = normalizedFrontSource || composedFrontSource;
  const backTextureSource = normalizedBackSource || composedBackSource;
  const frontTexture = useTexture(frontTextureSource);
  const backTexture = useTexture(backTextureSource);
  const commonPlaneArgs = useMemo<[number, number]>(() => {
    if (normalizedFrameSize.width > 0 && normalizedFrameSize.height > 0) {
      const planeHeight = 2.4;
      return [planeHeight * (normalizedFrameSize.width / normalizedFrameSize.height), planeHeight];
    }
    return [2.2, 2.4];
  }, [normalizedFrameSize.height, normalizedFrameSize.width]);

  const frameCount = frameSources.length;
  const safeFrameIndex = frameCount > 0 ? Math.min(frameIndex, frameCount - 1) : 0;
  const currentBaseFrame = frameImages[safeFrameIndex] ?? null;
  const frameGarmentMasks = useMemo(
    () => frameImages.map((image) => (image ? buildGarmentMaskCanvas(image) : null)),
    [frameImages],
  );
  const currentFrameMask = frameGarmentMasks[safeFrameIndex] ?? null;
  const swipeStartXRef = useRef<number | null>(null);
  const swipeConsumedRef = useRef(false);

  const goToPreviousFrame = useCallback(() => {
    if (frameCount <= 0) {
      return;
    }
    setFrameIndex((index) => (index - 1 + frameCount) % frameCount);
  }, [frameCount]);

  const goToNextFrame = useCallback(() => {
    if (frameCount <= 0) {
      return;
    }
    setFrameIndex((index) => (index + 1) % frameCount);
  }, [frameCount]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    swipeStartXRef.current = event.clientX;
    swipeConsumedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (swipeConsumedRef.current) {
        return;
      }

      const swipeStartX = swipeStartXRef.current;
      if (swipeStartX === null) {
        return;
      }

      const deltaX = event.clientX - swipeStartX;
      const swipeThreshold = 30;
      if (Math.abs(deltaX) < swipeThreshold) {
        return;
      }

      if (deltaX > 0) {
        goToPreviousFrame();
      } else {
        goToNextFrame();
      }

      swipeConsumedRef.current = true;
    },
    [goToNextFrame, goToPreviousFrame],
  );

  const handlePointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    swipeStartXRef.current = null;
    swipeConsumedRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const renderedFrame = useMemo(() => {
    if (useCameraPreview) {
      return "";
    }

    if (!currentBaseFrame) {
      return "";
    }

    const width = currentBaseFrame.naturalWidth || currentBaseFrame.width;
    const height = currentBaseFrame.naturalHeight || currentBaseFrame.height;
    if (width <= 0 || height <= 0) {
      return "";
    }

    const workingCanvas = document.createElement("canvas");
    workingCanvas.width = width;
    workingCanvas.height = height;
    const context = workingCanvas.getContext("2d");
    if (!context) {
      return "";
    }

    context.drawImage(currentBaseFrame, 0, 0, width, height);

    const totalFrames = Math.max(1, frameCount);
    const theta = (safeFrameIndex / totalFrames) * (Math.PI * 2);
    const frontDelta = normalizeAngleDelta(theta);
    const backDelta = normalizeAngleDelta(theta - Math.PI);

    const frontFacing = Math.max(0, Math.cos(frontDelta));
    const backFacing = Math.max(0, Math.cos(backDelta));
    const frontVisibility = normalizeAreaVisibility(frontFacing);
    const backVisibility = normalizeAreaVisibility(backFacing);
    const sinFront = Math.sin(frontDelta);
    const sinBack = Math.sin(backDelta);

    const frontBodyMax = fitPlacementToSourceAspect(
      width * softenedPerspectiveScale(frontFacing),
      height,
      frontOverlaySource,
    );
    const backBodyMax = fitPlacementToSourceAspect(
      width * softenedPerspectiveScale(backFacing),
      height,
      backOverlaySource,
    );

    const frontPlacement: OverlayPlacement = {
      centerX: width / 2 - width * 0.14 * sinFront,
      centerY: height / 2,
      width: frontBodyMax.width,
      height: frontBodyMax.height,
      rotation: -sinFront * 0.045,
      skewX: -sinFront * 0.55,
    };

    const backPlacement: OverlayPlacement = {
      centerX: width / 2 - width * 0.14 * sinBack,
      centerY: height / 2,
      width: backBodyMax.width,
      height: backBodyMax.height,
      rotation: -sinBack * 0.045,
      skewX: -sinBack * 0.55,
    };

    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = width;
    overlayCanvas.height = height;
    const overlayContext = overlayCanvas.getContext("2d");
    if (!overlayContext) {
      return "";
    }

    drawOverlay(
      overlayContext,
      frontOverlay,
      frontPlacement,
      frontOverlay ? frontVisibility : 0,
      frontOverlaySource,
    );
    drawOverlay(
      overlayContext,
      backOverlay,
      backPlacement,
      backOverlay ? backVisibility : 0,
      backOverlaySource,
    );

    if (currentFrameMask) {
      overlayContext.save();
      overlayContext.globalCompositeOperation = "destination-in";
      overlayContext.drawImage(currentFrameMask, 0, 0, width, height);
      overlayContext.restore();
    }

    context.drawImage(overlayCanvas, 0, 0, width, height);

    try {
      return workingCanvas.toDataURL("image/png");
    } catch {
      return "";
    }
  }, [
    backOverlay,
    backOverlaySource,
    currentBaseFrame,
    currentFrameMask,
    frameCount,
    frontOverlay,
    frontOverlaySource,
    safeFrameIndex,
    useCameraPreview,
  ]);

  if (frameCount === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-[#000000]">
        360 frame previews are not configured for this item yet.
      </div>
    );
  }

  if (useCameraPreview) {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-lg bg-[#ffffff]">
        <div className="absolute inset-0">
          <Canvas camera={{ position: [0, 0.12, 5.8], fov: 26 }} gl={{ alpha: false, antialias: true }} dpr={[1, 2]}>
            <color attach="background" args={["#ffffff"]} />

            <group>
              <mesh position={[0, 0, 0.003]}>
                <planeGeometry args={commonPlaneArgs} />
                <meshBasicMaterial
                  map={frontTexture ?? undefined}
                  transparent
                  opacity={frontTexture ? 1 : 0}
                  toneMapped={false}
                  alphaTest={0.01}
                  color={frontTexture ? "#ffffff" : "#ffffff"}
                />
              </mesh>

              <mesh position={[0, 0, -0.003]} rotation={[0, Math.PI, 0]}>
                <planeGeometry args={commonPlaneArgs} />
                <meshBasicMaterial
                  map={backTexture ?? undefined}
                  transparent
                  opacity={backTexture ? 1 : 0}
                  toneMapped={false}
                  alphaTest={0.01}
                  color={backTexture ? "#ffffff" : "#ffffff"}
                />
              </mesh>
            </group>

            <OrbitControls
              enablePan={false}
              enableDamping
              dampingFactor={0.08}
              enableZoom={false}
              minDistance={5.8}
              maxDistance={5.8}
              minPolarAngle={Math.PI / 2}
              maxPolarAngle={Math.PI / 2}
            />
          </Canvas>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-center gap-3 px-3 py-3">
        <Button
          type="button"
          onClick={goToPreviousFrame}
          disabled={frameCount <= 1}
          className="h-10 w-10 rounded-full border border-[#ffffff]/80 bg-[#ffffff]/90 p-0 text-xl text-[#000000] shadow-sm hover:bg-[#ffffff]"
          aria-label="Previous frame"
        >
          {"<"}
        </Button>
        <div
          className="relative h-full flex-1 overflow-hidden rounded-xl border border-[#ffffff]/70 bg-[#ffffff] touch-pan-y"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          {renderedFrame ? (
            <NextImage
              src={renderedFrame}
              alt={`T-Shirt preview frame ${safeFrameIndex + 1}`}
              fill
              unoptimized
              draggable={false}
              className="select-none object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[#000000]">
              Generating preview...
            </div>
          )}
        </div>
        <Button
          type="button"
          onClick={goToNextFrame}
          disabled={frameCount <= 1}
          className="h-10 w-10 rounded-full border border-[#ffffff]/80 bg-[#ffffff]/90 p-0 text-xl text-[#000000] shadow-sm hover:bg-[#ffffff]"
          aria-label="Next frame"
        >
          {">"}
        </Button>
      </div>

      <div className="space-y-1 border-t border-[#ffffff]/80 bg-[#ffffff]/70 px-4 py-3">
        <div className="flex items-center justify-between text-xs text-[#000000]">
          <span>Frame {safeFrameIndex + 1} / {frameCount}</span>
          <span>Angle {Math.round((safeFrameIndex / frameCount) * 360)}deg</span>
        </div>
        <p className="text-xs text-[#000000]">Swipe left/right or use arrow buttons.</p>
      </div>
    </div>
  );
}

function useTexture(url?: string) {
  return useMemo(() => {
    if (!url) {
      return null;
    }
    const loader = new TextureLoader();
    const texture = loader.load(url);
    texture.colorSpace = SRGBColorSpace;
    texture.flipY = true;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }, [url]);
}

function AreaPlane({
  area,
  texture,
  selected,
}: {
  area: AreaKey;
  texture: Texture | null;
  selected: boolean;
}) {
  const common = selected ? 1 : 0.2;

  if (area === "front") {
    return (
      <mesh position={[0, 0, 0.57]}>
        <planeGeometry args={[1.9, 2]} />
        <meshStandardMaterial map={texture ?? undefined} color={texture ? "#ffffff" : "#ffffff"} transparent opacity={common} />
      </mesh>
    );
  }

  if (area === "back") {
    return (
      <mesh position={[0, 0, -0.57]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.9, 2]} />
        <meshStandardMaterial map={texture ?? undefined} color={texture ? "#ffffff" : "#ffffff"} transparent opacity={common} />
      </mesh>
    );
  }

  return null;
}

function ApparelModel({
  slug,
  colorCode,
  previewByArea,
  selectedAreas,
}: {
  slug: string;
  colorCode: string;
  previewByArea: PreviewMap;
  selectedAreas: AreaKey[];
}) {
  const style = modelStyleBySlug[slug] ?? modelStyleBySlug.shirt;
  const baseColor = useMemo(() => new Color(colorCode || "#000000"), [colorCode]);

  const frontTexture = useTexture(previewByArea.front);
  const backTexture = useTexture(previewByArea.back);

  return (
    <group>
      <RoundedBox args={[style.width, style.height, style.depth]} radius={0.18} smoothness={4}>
        <meshStandardMaterial color={baseColor} metalness={0.15} roughness={0.75} />
      </RoundedBox>

      <AreaPlane area="front" texture={frontTexture} selected={selectedAreas.includes("front")} />
      <AreaPlane area="back" texture={backTexture} selected={selectedAreas.includes("back")} />
    </group>
  );
}

export function Product360Preview({
  productSlug,
  colorCode,
  previewByArea,
  selectedAreas,
  step6Message,
  onStep6MessageChange,
  onPrevious,
  onApprove,
  approving,
}: Props) {
  const isMounted = useHydrated();

  const isShirtFramePreview = productSlug === "shirt" && getPreview360FrameSources(productSlug).length === 12;

  if (!isMounted) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[#ffffff]/80 bg-[#ffffff]/75 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.12)] backdrop-blur-sm">
          <div className="mx-auto w-full max-w-[520px] rounded-lg border border-[#ffffff]/80 bg-[#ffffff]">
            <div className="relative aspect-square w-full overflow-hidden rounded-lg" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#ffffff]/80 bg-[#ffffff]/72 px-4 py-3 backdrop-blur">
          <p className="text-sm text-[#000000]">Loading preview...</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled className={FLOW_BUTTON_WHITE_CLASS}>
              Previous: Step 5
            </Button>
            <Button disabled className={FLOW_BUTTON_WHITE_CLASS}>
              Approve & Continue to Checkout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#ffffff]/80 bg-[#ffffff]/75 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.12)] backdrop-blur-sm">
        <div className="mx-auto w-full max-w-[520px] rounded-lg border border-[#ffffff]/80 bg-[#ffffff]">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg">
            {isShirtFramePreview ? (
              <TshirtFramePreview previewByArea={previewByArea} />
            ) : (
              <Canvas camera={{ position: [0, 0.5, 4], fov: 42 }} gl={{ alpha: false }}>
                <color attach="background" args={["#ffffff"]} />
                <ambientLight intensity={0.7} />
                <directionalLight intensity={1.2} position={[4, 3, 2]} />
                <directionalLight intensity={0.6} position={[-3, -2, -2]} />

                <ApparelModel
                  slug={productSlug}
                  colorCode={colorCode}
                  previewByArea={previewByArea}
                  selectedAreas={selectedAreas}
                />

                <OrbitControls enablePan={false} minDistance={2.8} maxDistance={6.2} />
              </Canvas>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-[#ffffff]/80 bg-[#ffffff]/72 px-4 py-3 backdrop-blur">
        <p className="text-sm text-[#000000]">
          {isShirtFramePreview
            ? "Use camera controls to inspect front and back from any angle. Approval is required before checkout."
            : "Rotate, zoom, and inspect all sides. Approval is required before checkout."}
        </p>
        <div className="space-y-1">
          <label htmlFor="step6-message-box" className="block text-lg font-medium text-[#000000]">Message Box</label>
          <textarea
            id="step6-message-box"
            value={step6Message}
            onChange={(event) => onStep6MessageChange(event.target.value)}
            placeholder="Share important design instructions (for example sleeve placement on sides)."
            rows={4}
            className="w-full rounded-xl border border-[#000000] bg-[#ffffff] px-3 py-2 text-sm text-[#000000] outline-none transition-colors focus:border-[#000000]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onPrevious} disabled={approving} className={FLOW_BUTTON_WHITE_CLASS}>
            Previous: Step 5
          </Button>
          <Button onClick={onApprove} disabled={approving} className={FLOW_BUTTON_WHITE_CLASS}>
            {approving ? "Approving..." : "Approve & Continue to Checkout"}
          </Button>
        </div>
      </div>
    </div>
  );
}





