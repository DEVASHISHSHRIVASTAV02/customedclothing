"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const HOME_BUTTON_CLASS =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#000000] bg-[#ffffff] text-[#000000] transition-colors hover:border-[#ffffff] hover:bg-[#000000] hover:text-[#ffffff] active:border-[#ffffff] active:bg-[#000000] active:text-[#ffffff]";
const ABOUT_US_FOOTER_PATHS = new Set([
  "/our-story",
  "/contact",
  "/privacy-policy",
  "/payment-policy",
  "/return-and-refunds",
  "/shipping-policy",
  "/cancellation-policy",
  "/terms-and-conditions",
]);

export function SiteBrand() {
  const pathname = usePathname();
  const router = useRouter();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const normalizedPath = pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const isHomePage = pathname === "/";
  const isTrackOrderPage = pathname.startsWith("/track-order");
  const isStep1CustomizePage = normalizedPath === "/customize";
  const isAboutUsFooterPage = ABOUT_US_FOOTER_PATHS.has(normalizedPath);
  const isMyAccountPage = normalizedPath === "/account" || normalizedPath.startsWith("/account/");
  const shouldConfirmBeforeLeavingForHome = !isTrackOrderPage && !isStep1CustomizePage && !isAboutUsFooterPage && !isMyAccountPage;

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

  const openLeaveConfirm = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setShowLeaveConfirm(true);
  };

  const confirmLeaveForHome = () => {
    setShowLeaveConfirm(false);
    router.push("/");
  };

  return (
    <>
      <Link
        href="/"
        aria-label="Go to home page"
        title="Home"
        className={HOME_BUTTON_CLASS}
        onClick={shouldConfirmBeforeLeavingForHome ? openLeaveConfirm : undefined}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M6.5 10.5V20h11V10.5" />
        </svg>
      </Link>
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#000000]/45 px-4 py-8 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setShowLeaveConfirm(false)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-for-home-title"
            className="relative z-[91] w-full max-w-md border border-[#000000] bg-[#ffffff] p-5 text-[#000000] shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
          >
            <h2 id="leave-for-home-title" className="text-base font-semibold">Leave for Home?</h2>
            <p className="mt-2 text-sm">
              All the unsaved work will be unrecoverable. Are you sure you want to leave for home?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="border border-[#000000] bg-[#ffffff] px-4 py-2 text-sm text-[#000000] transition-colors hover:bg-[#f2f2f2]"
              >
                No
              </button>
              <button
                type="button"
                onClick={confirmLeaveForHome}
                className="border border-[#000000] bg-[#000000] px-4 py-2 text-sm text-[#ffffff] transition-colors hover:bg-[#1a1a1a]"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}



