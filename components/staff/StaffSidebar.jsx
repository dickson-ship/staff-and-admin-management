"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  CircleDollarSign,
  ClipboardList,
  Home,
  Package,
  UserCircle,
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

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-[#E5EDF5] bg-white lg:block">
      <div className="flex h-20 items-center gap-3 border-b border-[#E5EDF5] px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1769E0] text-sm font-bold text-white">
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
      </div>

      <nav className="space-y-1 px-3 py-5">
        {navigation.map((item) => {
          const Icon = item.icon;

          const active =
            item.href === "/staff"
              ? pathname === "/staff"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                active
                  ? "bg-[#EAF4FF] text-[#1769E0]"
                  : "text-[#667085] hover:bg-[#F8FBFF] hover:text-[#172033]"
              }`}
            >
              <Icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}