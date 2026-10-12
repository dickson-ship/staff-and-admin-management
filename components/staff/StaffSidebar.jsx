
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  CircleDollarSign,
  ClipboardList,
  Home,
  Menu,
  Package,
  UserCircle,
  X,
} from "lucide-react";

const navigation = [
  {
    label: "Home",
    href: "/staff",
    icon: Home,
  },
  {
    label: "My Jobs",
    href: "/staff/jobs",
    icon: BriefcaseBusiness,
  },
  {
    label: "Money Requests",
    href: "/staff/requests",
    icon: ClipboardList,
  },
  {
    label: "My Resources",
    href: "/staff/resources",
    icon: Package,
  },
  {
    label: "My Payments",
    href: "/staff/payments",
    icon: CircleDollarSign,
  },
  {
    label: "My Profile",
    href: "/staff/profile",
    icon: UserCircle,
  },
];

export default function StaffSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the menu after route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close the menu using the Escape key.
  useEffect(() => {
    if (!mobileOpen) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  // Prevent background scrolling while the mobile menu is open.
  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  function closeSidebar() {
    setMobileOpen(false);
  }

  function isActive(href) {
    if (href === "/staff") {
      return pathname === "/staff";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={closeSidebar}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        id="staff-sidebar"
        aria-label="Staff navigation"
        aria-hidden={!mobileOpen}
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#E5EDF5] bg-white shadow-sm transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-[#E5EDF5] px-5">
          <Link
            href="/staff"
            onClick={closeSidebar}
            tabIndex={mobileOpen ? 0 : undefined}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1769E0] text-sm font-bold text-white shadow-md shadow-blue-200">
              AP
            </div>

            <div>
              <p className="text-sm font-bold text-[#0F3D70]">
                Abes Power
              </p>

              <p className="text-xs text-[#98A2B3]">
                Staff Portal
              </p>
            </div>
          </Link>

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={closeSidebar}
            aria-label="Close sidebar"
            className="rounded-lg p-2 text-[#667085] transition hover:bg-[#F5FAFF] hover:text-[#172033] lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3]">
            My Workspace
          </p>

          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeSidebar}
                  aria-current={active ? "page" : undefined}
                  tabIndex={mobileOpen ? 0 : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-[#EAF4FF] text-[#1769E0]"
                      : "text-[#667085] hover:bg-[#F8FBFF] hover:text-[#172033]"
                  }`}
                >
                  <Icon size={20} className="shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-[#E5EDF5] p-4">
          <div className="rounded-2xl bg-[#F5FAFF] p-4">
            <p className="text-xs font-semibold text-[#0F3D70]">
              Abes Staff System
            </p>

            <p className="mt-1 text-[11px] leading-5 text-[#667085]">
              Manage your jobs, resources, payments, and requests.
            </p>
          </div>
        </div>
      </aside>

      {/* Floating mobile menu button */}
      <button
        type="button"
        onClick={() => setMobileOpen((open) => !open)}
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-controls="staff-sidebar"
        aria-expanded={mobileOpen}
        className={`fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-[#1769E0] text-white shadow-lg shadow-blue-200 transition hover:bg-[#0F3D70] focus:outline-none focus:ring-4 focus:ring-blue-200 lg:hidden ${
          mobileOpen ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <Menu size={23} />
      </button>
    </>
  );
}
