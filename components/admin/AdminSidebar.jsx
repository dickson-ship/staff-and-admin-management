import { Suspense } from "react";
import AdminSidebarClient from "./AdminSidebarClient";

function SidebarFallback() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-[#E5EDF5] bg-white lg:block">
      <div className="h-full animate-pulse p-4">
        <div className="h-10 rounded-lg bg-[#F5FAFF]" />

        <div className="mt-6 space-y-3">
          <div className="h-10 rounded-lg bg-[#F5FAFF]" />
          <div className="h-10 rounded-lg bg-[#F5FAFF]" />
          <div className="h-10 rounded-lg bg-[#F5FAFF]" />
          <div className="h-10 rounded-lg bg-[#F5FAFF]" />
        </div>
      </div>
    </aside>
  );
}

export default function AdminSidebar() {
  return (
    <Suspense fallback={<SidebarFallback />}>
      <AdminSidebarClient />
    </Suspense>
  );
}