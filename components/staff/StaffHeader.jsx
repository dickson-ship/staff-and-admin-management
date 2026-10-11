"use client";

import { LogOut, UserCircle } from "lucide-react";
import { signOut } from "firebase/auth";

import { auth } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

export default function StaffHeader() {
  const { profile } = useAuth();

  async function handleLogout() {
    await signOut(auth);
  }

  const firstName =
    profile?.firstName ||
    profile?.name?.split(" ")[0] ||
    "Worker";

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-[#E5EDF5] bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div>
        <p className="text-xs text-[#98A2B3]">
          Staff Portal
        </p>

        <h1 className="text-lg font-bold text-[#172033]">
          Hello, {firstName} 👋
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <UserCircle
          size={30}
          className="text-[#1769E0]"
        />

        <button
          onClick={handleLogout}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5EDF5] text-[#667085] hover:bg-red-50 hover:text-red-500"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}