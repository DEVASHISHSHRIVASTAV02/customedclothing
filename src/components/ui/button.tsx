import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      data-variant={variant}
      className={cn(
        "inline-flex items-center justify-center rounded-xl border border-[#000000] bg-[#000000] px-4 py-2 text-sm font-medium text-[#ffffff] transition-colors hover:border-[#000000] hover:bg-[#ffffff] hover:text-[#000000] active:border-[#000000] active:bg-[#ffffff] active:text-[#000000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#000000]/25 disabled:cursor-not-allowed disabled:border-[#000000]/25 disabled:bg-[#ffffff] disabled:text-[#000000]/45 disabled:opacity-100 disabled:hover:border-[#000000]/25 disabled:hover:bg-[#ffffff]",
        className,
      )}
      {...props}
    />
  );
}



