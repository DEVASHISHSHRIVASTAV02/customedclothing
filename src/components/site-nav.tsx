"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useAuthModal } from "@/components/auth/customer-auth-modal-provider";

export function SiteNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { openAuthModal } = useAuthModal();
  const role = session?.user?.role;
  const isCustomer = status === "authenticated" && role === "CUSTOMER";
  const isAdmin = status === "authenticated" && role === "ADMIN";
  const navButtonClass = (href: string) => {
    const isAdminLink = href === "/admin/orders";
    const isActive = isAdminLink
      ? pathname.startsWith("/admin")
      : pathname === href || pathname.startsWith(`${href}/`);

    const baseClass = "rounded-full border px-3 py-1.5 transition-colors";
    const activeClass = "border-[#ffffff] bg-[#000000] text-[#ffffff]";
    const idleClass = "border-[#000000] bg-[#ffffff] text-[#000000] hover:border-[#ffffff] hover:bg-[#000000] hover:text-[#ffffff] active:border-[#ffffff] active:bg-[#000000] active:text-[#ffffff]";

    return `${baseClass} ${isActive ? activeClass : idleClass}`;
  };
  const navActionButtonClass = "rounded-full border border-[#000000] bg-[#ffffff] px-3 py-1.5 text-[#000000] transition-colors hover:border-[#ffffff] hover:bg-[#000000] hover:text-[#ffffff] active:border-[#ffffff] active:bg-[#000000] active:text-[#ffffff]";

  return (
    <nav className="flex flex-wrap items-center justify-end gap-2 text-sm">
      {!isCustomer && !isAdmin && (
        <button
          type="button"
          onClick={() => openAuthModal({ mode: "login" })}
          className={navActionButtonClass}
        >
          Sign In
        </button>
      )}

      {isCustomer && (
        <>
          <Link
            href="/account"
            className={`${navButtonClass("/account")} flex h-10 w-10 items-center justify-center px-0 py-0`}
            aria-label="My Account"
            title="My Account"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-100% w-100%"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="5" />
              <path d="M4.5 19c2-3.4 13-3.4 15 0" />
            </svg>
          </Link>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/" })}
            className={navActionButtonClass}
          >
            Logout
          </button>
        </>
      )}

      {isAdmin && (
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/" })}
          className={navActionButtonClass}
        >
          Admin Logout
        </button>
      )}
    </nav>
  );
}
