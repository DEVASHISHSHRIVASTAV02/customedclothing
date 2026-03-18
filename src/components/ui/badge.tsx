import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border border-[#000000] bg-[#000000] px-3 py-1 text-xs font-medium text-[#ffffff]",
        className,
      )}
    >
      {children}
    </span>
  );
}



