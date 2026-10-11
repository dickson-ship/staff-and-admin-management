"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { useAuth } from "@/providers/AuthProvider";
import StaffSidebar from "@/components/staff/StaffSidebar";
import StaffHeader from "@/components/staff/StaffHeader";

export default function StaffLayout({ children }) {
  const router = useRouter();

  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (profile && profile.role !== "staff") {
      router.replace("/admin");
    }
  }, [user, profile, loading, router]);

  if (loading || !user || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FBFF]">
        <LoaderCircle
          size={32}
          className="animate-spin text-[#1769E0]"
        />
      </div>
    );
  }

  if (profile.role !== "staff") {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8FBFF]">
      <StaffSidebar />

      <div className="lg:pl-64">
        <StaffHeader />

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}