"use client";

import { signOut } from "next-auth/react";

export function AdminSignOutButton() {
  return (
    <button
      className="rounded-xl border border-[#000000] bg-[#000000] px-3 py-2 text-[#ffffff] transition-colors hover:border-[#000000] hover:bg-[#000000] active:border-[#000000] active:bg-[#000000]"
      type="button"
      onClick={() => void signOut({ callbackUrl: "/" })}
    >
      Sign out
    </button>
  );
}




