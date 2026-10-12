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

  const isStaff =
    !loading && Boolean(user) && profile?.role === "staff";

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (profile?.role && profile.role !== "staff") {
      router.replace("/admin");
    }
  }, [user, profile?.role, loading, router]);

  const message = loading
    ? "Checking your account..."
    : !user
      ? "Redirecting to sign in..."
      : profile?.role && profile.role !== "staff"
        ? "Redirecting to the correct dashboard..."
        : "Loading your staff profile...";

  return (
    <div className="min-h-screen bg-[#F8FBFF]">
      {/* Only show staff navigation after access is confirmed. */}
      {isStaff && <StaffSidebar />}

      <div className={isStaff ? "lg:pl-64" : ""}>
        {isStaff && <StaffHeader />}

        <main className="relative px-4 py-6 sm:px-6 lg:px-8">
          {/*
            IMPORTANT:
            Always render the routed page component.
            Do not conditionally remove {children} from the layout.
          */}
          <div
            aria-hidden={!isStaff}
            style={{
              visibility: isStaff ? "visible" : "hidden",
            }}
          >
            {children}
          </div>
        </main>
      </div>

      {/* Cover the page until authentication has been resolved. */}
      {!isStaff && (
        <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-[#F8FBFF]">
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center gap-3 rounded-2xl border border-[#DCE5F0] bg-white px-8 py-7 shadow-sm"
          >
            <LoaderCircle
              size={32}
              className="animate-spin text-[#1769E0]"
            />

            <p className="text-sm font-medium text-[#172033]">
              {message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}