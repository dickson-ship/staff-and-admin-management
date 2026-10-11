import { Suspense } from "react";
import WorkerDetailsClient from "./WorkerDetailsClient";

function WorkerDetailsFallback() {
  return (
    <div className="min-h-screen bg-[#F8FBFF] p-6">
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="h-8 w-64 rounded-lg bg-[#EAF4FF]" />

        <div className="mt-6 rounded-2xl border border-[#E5EDF5] bg-white p-6">
          <div className="h-6 w-48 rounded bg-[#F5FAFF]" />

          <div className="mt-6 space-y-4">
            <div className="h-12 rounded-lg bg-[#F5FAFF]" />
            <div className="h-12 rounded-lg bg-[#F5FAFF]" />
            <div className="h-12 rounded-lg bg-[#F5FAFF]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkerDetailsPage() {
  return (
    <Suspense fallback={<WorkerDetailsFallback />}>
      <WorkerDetailsClient />
    </Suspense>
  );
}