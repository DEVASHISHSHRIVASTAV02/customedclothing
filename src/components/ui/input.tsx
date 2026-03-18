import * as React from "react";
import { cn } from "@/lib/utils";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-xl border border-[#000000]/20 bg-[#ffffff] px-3 py-2 text-sm text-[#000000] shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)] outline-none transition placeholder:text-[#000000]/45 focus:border-[#000000] focus:ring-2 focus:ring-[#000000]/15",
        props.className,
      )}
    />
  );
}




