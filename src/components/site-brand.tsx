"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const HOME_BUTTON_CLASS =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#000000] bg-[#ffffff] text-[#000000] transition-colors hover:border-[#ffffff] hover:bg-[#000000] hover:text-[#ffffff] active:border-[#ffffff] active:bg-[#000000] active:text-[#ffffff]";

export function SiteBrand() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  if (isHomePage) {
    return (
      <Link href="/" className="inline-flex items-center">
        <Image
          src="/logo/company-and-website-logo.png"
          alt="CUSTOMED"
          width={170}
          height={41}
          priority
          className="h-auto w-[170px]"
        />
      </Link>
    );
  }

  return (
    <Link href="/" aria-label="Go to home page" title="Home" className={HOME_BUTTON_CLASS}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M6.5 10.5V20h11V10.5" />
      </svg>
    </Link>
  );
}



