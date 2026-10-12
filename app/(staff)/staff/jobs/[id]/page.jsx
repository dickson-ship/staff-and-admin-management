import { Suspense } from "react";
import StaffJobDetailsPage from "./StaffJobDetailsPage";

export default function StaffJobDetails() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-80 items-center justify-center bg-[#F8FBFF]">
          <div className="rounded-2xl border border-[#DCE5F0] bg-white px-6 py-5 text-center shadow-sm">
            <p className="font-semibold text-[#172033]">
              Loading staff job details...
            </p>
            <p className="mt-1 text-sm text-[#667085]">
              Please wait while the job is loaded.
            </p>
          </div>
        </div>
      }
    >
      <StaffJobDetailsPage />
    </Suspense>
  );
}