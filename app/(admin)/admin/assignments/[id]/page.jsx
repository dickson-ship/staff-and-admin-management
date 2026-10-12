import { Suspense } from "react";
import AssignmentDetailsClient from "./AssignmentDetailsClient";

export default function AssignmentDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-80 items-center justify-center bg-[#F8FBFF]">
          <div className="rounded-2xl border border-[#DCE5F0] bg-white px-6 py-5 text-center shadow-sm">
            <p className="font-semibold text-[#172033]">
              Loading assignment details...
            </p>
            <p className="mt-1 text-sm text-[#667085]">
              Please wait while the assignment is loaded.
            </p>
          </div>
        </div>
      }
    >
      <AssignmentDetailsClient />
    </Suspense>
  );
}