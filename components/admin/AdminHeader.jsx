"use client";

import { useState } from "react";
import { LogOut, UserCircle } from "lucide-react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

export default function AdminHeader() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await signOut(auth);

      // Navigate to login after Firebase signs out successfully.
      window.location.replace("/login");
    } catch (error) {
      console.error("Logout error:", error);
      setLoggingOut(false);
    }
  }

  const firstName =
    profile?.firstName ||
    profile?.name?.split(" ")[0] ||
    "Admin";

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-[#E5EDF5] bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div>
        <p className="text-xs font-medium text-[#98A2B3]">
          Administration
        </p>

        <h1 className="text-lg font-bold text-[#172033]">
          Welcome back, {profile?.name || firstName}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-3 rounded-xl border border-[#E5EDF5] bg-white px-3 py-2 sm:flex">
          <UserCircle size={28} className="text-[#1769E0]" />

          <div>
            <p className="text-xs font-semibold text-[#172033]">
              {profile?.name || firstName}
            </p>

            <p className="text-[11px] text-[#98A2B3]">
              Administrator
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          title="Sign out"
          aria-label="Sign out"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5EDF5] text-[#667085] transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loggingOut ? (
            <span className="text-xs">...</span>
          ) : (
            <LogOut size={18} />
          )}
        </button>
      </div>
    </header>
  );
}