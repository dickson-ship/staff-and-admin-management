
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/providers/AuthProvider";

export default function AdminAuthGuard({ children }) {
  const router = useRouter();

  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (profile?.role !== "admin") {
      router.replace("/staff");
    }
  }, [user, profile, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-150px)] items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#EAF4FF] border-t-[#1769E0]" />

          <p className="mt-4 text-sm text-[#667085]">
            Checking your access...
          </p>
        </div>
      </div>
    );
  }

  if (!user || profile?.role !== "admin") {
    return (
      <div className="flex min-h-[calc(100vh-150px)] items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#EAF4FF] border-t-[#1769E0]" />

          <p className="mt-4 text-sm text-[#667085]">
            Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return children;
}
