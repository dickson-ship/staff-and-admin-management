"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BriefcaseBusiness,
  ClipboardCheck,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Package,
  Settings,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import { useState } from "react";

const navigation = [
  {
    label: "Overview",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    label: "Workers",
    href: "/admin/workers",
    icon: Users,
  },
  {
    label: "Projects",
    href: "/admin/projects",
    icon: FolderKanban,
  },
  {
    label: "Assignments",
    href: "/admin/assignments",
    icon: BriefcaseBusiness,
  },
  {
    label: "Requests",
    href: "/admin/requests",
    icon: ClipboardCheck,
  },
  {
    label: "Resources",
    href: "/admin/resources",
    icon: Package,
  },
  {
    label: "Approvals",
    href: "/admin/approvals",
    icon: FileText,
  },
  {
    label: "Finance",
    href: "/admin/finance",
    icon: WalletCards,
  },
  {
    label: "Reports",
    href: "/admin/reports",
    icon: BarChart3,
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#E5EDF5] bg-white transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-20 items-center justify-between border-b border-[#E5EDF5] px-5">
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1769E0] text-sm font-bold text-white shadow-md shadow-blue-200">
              AP
            </div>

            <div>
              <p className="text-sm font-bold text-[#0F3D70]">
                Abes Power
              </p>

              <p className="text-xs text-[#98A2B3]">
                Management
              </p>
            </div>
          </Link>

          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 text-[#667085] hover:bg-[#F5FAFF] lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3]">
            Management
          </p>

          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;

              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-[#EAF4FF] text-[#1769E0]"
                      : "text-[#667085] hover:bg-[#F8FBFF] hover:text-[#172033]"
                  }`}
                >
                  <Icon size={19} />

                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="my-6 border-t border-[#E5EDF5]" />

          <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3]">
            System
          </p>

          <Link
            href="/admin/settings"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              pathname.startsWith("/admin/settings")
                ? "bg-[#EAF4FF] text-[#1769E0]"
                : "text-[#667085] hover:bg-[#F8FBFF] hover:text-[#172033]"
            }`}
          >
            <Settings size={19} />
            <span>Settings</span>
          </Link>
        </nav>

        {/* Bottom */}
        <div className="border-t border-[#E5EDF5] p-4">
          <div className="rounded-2xl bg-[#F5FAFF] p-4">
            <p className="text-xs font-semibold text-[#0F3D70]">
              Abes Staff System
            </p>

            <p className="mt-1 text-[11px] leading-5 text-[#98A2B3]">
              Manage workers, projects, resources and finances.
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#1769E0] text-white shadow-lg shadow-blue-200 lg:hidden"
      >
        <LayoutDashboard size={21} />
      </button>
    </>
  );
}