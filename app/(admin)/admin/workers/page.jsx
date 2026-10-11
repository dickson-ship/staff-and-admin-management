"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Users,
  UserCheck,
  UserX,
  ArrowRight,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "@/config/Firebase";

export default function WorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const workersQuery = query(
      collection(db, "workers"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      workersQuery,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setWorkers(data);
        setLoading(false);
      },
      (error) => {
        console.error("Workers error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredWorkers = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return workers;

    return workers.filter((worker) => {
      const fullName = `${worker.firstName || ""} ${
        worker.lastName || ""
      }`.toLowerCase();

      return (
        fullName.includes(value) ||
        (worker.email || "").toLowerCase().includes(value) ||
        (worker.phone || "").toLowerCase().includes(value) ||
        (worker.role || "").toLowerCase().includes(value)
      );
    });
  }, [workers, search]);

  const activeWorkers = workers.filter(
    (worker) => worker.status !== "inactive"
  );

  const inactiveWorkers = workers.filter(
    (worker) => worker.status === "inactive"
  );

  return (
    <div className="space-y-7">
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-[#1769E0]">
            Workforce
          </p>

          <h2 className="mt-1 text-2xl font-bold text-[#172033]">
            Workers
          </h2>

          <p className="mt-1 text-sm text-[#667085]">
            Manage your company's workers and staff members.
          </p>
        </div>

        <Link
          href="/admin/workers/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1259C4]"
        >
          <Plus size={18} />
          Add Worker
        </Link>
      </section>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Users}
          label="Total Workers"
          value={workers.length}
        />

        <StatCard
          icon={UserCheck}
          label="Active"
          value={activeWorkers.length}
        />

        <StatCard
          icon={UserX}
          label="Inactive"
          value={inactiveWorkers.length}
        />
      </section>

      {/* Search */}
      <section className="rounded-2xl border border-[#E5EDF5] bg-white p-4 shadow-sm">
        <div className="relative">
          <Search
            size={19}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
          />

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, email or role..."
            className="w-full rounded-xl border border-[#E5EDF5] bg-[#F8FBFF] py-3 pl-10 pr-4 text-sm text-[#172033] outline-none transition focus:border-[#1769E0] focus:ring-4 focus:ring-blue-100"
          />
        </div>
      </section>

      {/* Workers */}
      <section className="rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
        <div className="border-b border-[#E5EDF5] px-5 py-4">
          <h3 className="font-bold text-[#172033]">
            All workers
          </h3>

          <p className="mt-1 text-xs text-[#98A2B3]">
            {filteredWorkers.length} worker
            {filteredWorkers.length !== 1 ? "s" : ""}
          </p>
        </div>

        {loading ? (
          <LoadingState />
        ) : filteredWorkers.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          <div className="divide-y divide-[#E5EDF5]">
            {filteredWorkers.map((worker) => (
              <WorkerRow
                key={worker.id}
                worker={worker}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
        <Icon size={21} />
      </div>

      <p className="mt-4 text-sm text-[#667085]">
        {label}
      </p>

      <p className="mt-1 text-2xl font-bold text-[#172033]">
        {value}
      </p>
    </div>
  );
}

function WorkerRow({ worker }) {
  const initials = `${worker.firstName?.[0] || ""}${
    worker.lastName?.[0] || ""
  }`.toUpperCase();

  const active = worker.status !== "inactive";

  return (
    <Link
      href={`/admin/workers/${worker.id}`}
      className="flex items-center gap-4 px-5 py-4 transition hover:bg-[#F8FBFF]"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EAF4FF] text-sm font-bold text-[#1769E0]">
        {initials || "W"}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#172033]">
          {worker.firstName} {worker.lastName}
        </p>

        <p className="truncate text-xs text-[#667085]">
          {worker.role || "Worker"}
          {worker.phone ? ` · ${worker.phone}` : ""}
        </p>
      </div>

      <div className="hidden sm:block">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            active
              ? "bg-green-50 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {active ? "Active" : "Inactive"}
        </span>
      </div>

      <ArrowRight
        size={18}
        className="text-[#98A2B3]"
      />
    </Link>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4 p-5">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="flex animate-pulse items-center gap-4"
        >
          <div className="h-11 w-11 rounded-full bg-[#EAF4FF]" />

          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 rounded bg-gray-100" />
            <div className="h-2 w-24 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ search }) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5FAFF] text-[#1769E0]">
        <Users size={25} />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-[#172033]">
        {search ? "No workers found" : "No workers yet"}
      </h3>

      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[#98A2B3]">
        {search
          ? "Try changing your search."
          : "Add your first worker to start managing your workforce."}
      </p>
    </div>
  );
}