import Image, { type StaticImageData } from "next/image";
import { getClothingImageAsset } from "@/lib/clothing-assets";
import { cn } from "@/lib/utils";

type ClothingImageProps = {
  type: string;
  className?: string;
  fit?: "contain" | "cover";
};

export function ClothingImage({ type, className, fit = "contain" }: ClothingImageProps) {
  const source: StaticImageData = getClothingImageAsset(type);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-[#ffffff]",
        className,
      )}
    >
      <Image
        src={source}
        alt={`${type.replace(/-/g, " ")} preview`}
        fill
        sizes="(max-width: 768px) 100vw, 480px"
        className={fit === "cover" ? "object-cover" : "object-contain p-2"}
        priority={false}
      />
    </div>
  );
}



