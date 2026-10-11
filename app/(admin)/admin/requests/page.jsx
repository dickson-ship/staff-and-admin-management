
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  Loader2,
  Search,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";

import {
  collection,
  onSnapshot,
} from "firebase/firestore";

import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

export default function RequestsPage() {
  const { user, profile, loading: authLoading } = useAuth();

  const [requests, setRequests] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [projects, setProjects] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // ---------------------------------------------------------
  // LOAD DATA
  // ---------------------------------------------------------
  useEffect(() => {
    if (authLoading || !user || profile?.role !== "admin") {
      return;
    }

    setLoading(true);
    setError("");

    let requestsLoaded = false;
    let workersLoaded = false;
    let projectsLoaded = false;

    const checkLoading = () => {
      if (requestsLoaded && workersLoaded && projectsLoaded) {
        setLoading(false);
      }
    };

    const unsubscribeRequests = onSnapshot(
      collection(db, "moneyRequests"),
      (snapshot) => {
        const requestList = snapshot.docs.map((requestDoc) => ({
          id: requestDoc.id,
          ...requestDoc.data(),
        }));

        setRequests(requestList);
        requestsLoaded = true;
        checkLoading();
      },
      (err) => {
        console.error("Requests error:", err);
        setError("Unable to load requests.");
        requestsLoaded = true;
        checkLoading();
      }
    );

    const unsubscribeWorkers = onSnapshot(
      collection(db, "workers"),
      (snapshot) => {
        const workerList = snapshot.docs.map((workerDoc) => ({
          id: workerDoc.id,
          ...workerDoc.data(),
        }));

        setWorkers(workerList);
        workersLoaded = true;
        checkLoading();
      },
      (err) => {
        console.error("Workers error:", err);
        workersLoaded = true;
        checkLoading();
      }
    );

    const unsubscribeProjects = onSnapshot(
      collection(db, "projects"),
      (snapshot) => {
        const projectList = snapshot.docs.map((projectDoc) => ({
          id: projectDoc.id,
          ...projectDoc.data(),
        }));

        setProjects(projectList);
        projectsLoaded = true;
        checkLoading();
      },
      (err) => {
        console.error("Projects error:", err);
        projectsLoaded = true;
        checkLoading();
      }
    );

    return () => {
      unsubscribeRequests();
      unsubscribeWorkers();
      unsubscribeProjects();
    };
  }, [authLoading, user, profile]);

  // ---------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------
  function getWorker(workerId) {
    return workers.find((worker) => worker.id === workerId);
  }

  function getProject(projectId) {
    return projects.find((project) => project.id === projectId);
  }

  function getWorkerName(worker) {
    if (!worker) return "Unknown Worker";

    return (
      worker.name ||
      `${worker.firstName || ""} ${worker.lastName || ""}`.trim() ||
      "Unnamed Worker"
    );
  }

  function formatAmount(amount) {
    return `GH₵ ${Number(amount || 0).toLocaleString()}`;
  }

  function formatDate(value) {
    if (!value) return "—";

    try {
      if (typeof value?.toDate === "function") {
        return value.toDate().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      }

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return String(value);
      }

      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(value);
    }
  }

  function formatStatus(status) {
    if (!status) return "Unknown";

    return String(status)
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function getStatusClasses(status) {
    switch (String(status || "").toLowerCase()) {
      case "pending":
        return "border-amber-200 bg-amber-50 text-amber-700";

      case "approved":
        return "border-green-200 bg-green-50 text-green-700";

      case "rejected":
        return "border-red-200 bg-red-50 text-red-700";

      case "paid":
        return "border-blue-200 bg-blue-50 text-blue-700";

      default:
        return "border-gray-200 bg-gray-50 text-gray-700";
    }
  }

  // ---------------------------------------------------------
  // FILTER
  // ---------------------------------------------------------
  const filteredRequests = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return [...requests]
      .filter((request) => {
        if (statusFilter === "all") return true;

        return (
          String(request.status || "").toLowerCase() ===
          statusFilter
        );
      })
      .filter((request) => {
        if (!searchTerm) return true;

        const worker = getWorker(request.workerId);
        const project = getProject(request.projectId);

        const workerName = getWorkerName(worker);

        const searchableText = [
          workerName,
          worker?.email,
          worker?.phone,
          project?.name,
          project?.service,
          project?.location,
          request.type,
          request.reason,
          request.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(searchTerm);
      })
      .sort((a, b) => {
        const dateA =
          typeof a.createdAt?.toDate === "function"
            ? a.createdAt.toDate().getTime()
            : new Date(a.createdAt || 0).getTime();

        const dateB =
          typeof b.createdAt?.toDate === "function"
            ? b.createdAt.toDate().getTime()
            : new Date(b.createdAt || 0).getTime();

        return dateB - dateA;
      });
  }, [requests, workers, projects, search, statusFilter]);

  // ---------------------------------------------------------
  // STATS
  // ---------------------------------------------------------
  const stats = useMemo(() => {
    const pending = requests.filter(
      (request) =>
        String(request.status || "").toLowerCase() === "pending"
    );

    const approved = requests.filter(
      (request) =>
        String(request.status || "").toLowerCase() === "approved"
    );

    const rejected = requests.filter(
      (request) =>
        String(request.status || "").toLowerCase() === "rejected"
    );

    const pendingAmount = pending.reduce(
      (total, request) =>
        total + Number(request.amount || 0),
      0
    );

    return {
      total: requests.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      pendingAmount,
    };
  }, [requests]);

  // ---------------------------------------------------------
  // LOADING
  // ---------------------------------------------------------
  if (authLoading || loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#1769E0]" />

          <p className="text-sm text-[#667085]">
            Loading requests...
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // PAGE
  // ---------------------------------------------------------
  return (
    <div className="mx-auto max-w-7xl">
      {/* HEADER */}
      <div className="mb-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF4FF] text-[#1769E0]">
              <DollarSign className="h-6 w-6" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
              Money Requests
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085] sm:text-base">
              Review and manage transport, food, accommodation, and
              other money requests submitted by workers.
            </p>
          </div>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* STATS */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Total Requests"
          value={stats.total}
          icon={Users}
        />

        <StatCard
          label="Pending"
          value={stats.pending}
          icon={Clock3}
          highlighted
        />

        <StatCard
          label="Approved"
          value={stats.approved}
          icon={CheckCircle2}
        />

        <StatCard
          label="Rejected"
          value={stats.rejected}
          icon={XCircle}
        />

        <StatCard
          label="Pending Amount"
          value={formatAmount(stats.pendingAmount)}
          icon={DollarSign}
          amount
        />
      </div>

      {/* SEARCH + FILTERS */}
      <div className="mb-6 rounded-2xl border border-[#E5EDF5] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row">
          {/* SEARCH */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98A2B3]" />

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search worker, project, request type..."
              className="w-full rounded-xl border border-[#DCEAF8] bg-[#F8FBFF] py-3 pl-11 pr-4 text-sm text-[#172033] outline-none transition placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:bg-white focus:ring-4 focus:ring-[#1769E0]/10"
            />
          </div>

          {/* FILTER */}
          <div className="flex flex-wrap gap-2">
            {[
              ["all", "All"],
              ["pending", "Pending"],
              ["approved", "Approved"],
              ["rejected", "Rejected"],
              ["paid", "Paid"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  statusFilter === value
                    ? "bg-[#1769E0] text-white"
                    : "border border-[#DCEAF8] bg-white text-[#667085] hover:bg-[#F8FBFF]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* REQUESTS */}
      {filteredRequests.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#DCEAF8] bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8FBFF] text-[#98A2B3]">
            <DollarSign className="h-7 w-7" />
          </div>

          <h2 className="mt-5 text-lg font-semibold text-[#172033]">
            No requests found
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#667085]">
            Worker money requests will appear here when they are
            submitted.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => {
            const worker = getWorker(request.workerId);
            const project = getProject(request.projectId);

            const workerName = getWorkerName(worker);

            return (
              <Link
                key={request.id}
                href={`/admin/requests/${request.id}`}
                className="group block rounded-3xl border border-[#E5EDF5] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#DCEAF8] hover:shadow-md sm:p-6"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                  {/* LEFT */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-4">
                      {/* ICON */}
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF4FF] text-[#1769E0]">
                        <DollarSign className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-[#172033]">
                            {request.type
                              ? formatStatus(request.type)
                              : "Money Request"}
                          </h2>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                              request.status
                            )}`}
                          >
                            {formatStatus(
                              request.status || "pending"
                            )}
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-[#667085]">
                          {request.reason ||
                            "No reason provided"}
                        </p>
                      </div>
                    </div>

                    {/* DETAILS */}
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <InfoItem
                        icon={UserRound}
                        label="Worker"
                        value={workerName}
                      />

                      <InfoItem
                        icon={BriefcaseIcon}
                        label="Project"
                        value={
                          project?.name ||
                          "No project"
                        }
                      />

                      <InfoItem
                        icon={CalendarDays}
                        label="Requested"
                        value={formatDate(
                          request.createdAt
                        )}
                      />

                      <InfoItem
                        icon={DollarSign}
                        label="Amount"
                        value={formatAmount(
                          request.amount
                        )}
                        strong
                      />
                    </div>
                  </div>

                  {/* ARROW */}
                  <div className="hidden shrink-0 items-center justify-center rounded-xl border border-[#E5EDF5] p-3 text-[#98A2B3] transition group-hover:border-[#DCEAF8] group-hover:text-[#1769E0] xl:flex">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// STAT CARD
// ---------------------------------------------------------
function StatCard({
  label,
  value,
  icon: Icon,
  highlighted = false,
  amount = false,
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        highlighted
          ? "border-[#DCEAF8] bg-[#F8FBFF]"
          : "border-[#E5EDF5] bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <p className="mt-4 text-xs font-medium text-[#667085]">
        {label}
      </p>

      <p
        className={`mt-1 font-bold text-[#172033] ${
          amount ? "text-base" : "text-2xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------
// INFO ITEM
// ---------------------------------------------------------
function InfoItem({
  icon: Icon,
  label,
  value,
  strong = false,
}) {
  return (
    <div className="rounded-2xl bg-[#F8FBFF] p-3">
      <div className="flex items-center gap-2 text-[#98A2B3]">
        <Icon className="h-4 w-4" />

        <span className="text-xs">
          {label}
        </span>
      </div>

      <p
        className={`mt-1 truncate text-sm ${
          strong
            ? "font-bold text-[#172033]"
            : "font-medium text-[#172033]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------
// BRIEFCASE ICON WRAPPER
// ---------------------------------------------------------
function BriefcaseIcon(props) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        width="20"
        height="14"
        x="2"
        y="7"
        rx="2"
        ry="2"
      />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}