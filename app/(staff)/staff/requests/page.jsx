"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DollarSign,
  FileText,
  Plus,
  Search,
  XCircle,
  WalletCards,
} from "lucide-react";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

const filters = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "paid", label: "Paid" },
];

const statusConfig = {
  pending: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 border-amber-100",
    icon: Clock3,
  },
  approved: {
    label: "Approved",
    className: "bg-blue-50 text-blue-700 border-blue-100",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-50 text-red-700 border-red-100",
    icon: XCircle,
  },
  paid: {
    label: "Paid",
    className: "bg-green-50 text-green-700 border-green-100",
    icon: CheckCircle2,
  },
};

const typeLabels = {
  transport: "Transport",
  food: "Food",
  accommodation: "Accommodation",
  other: "Other",
};

function formatMoney(value) {
  const amount = Number(value || 0);

  return `GH₵ ${amount.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "Not set";

  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Not set";
    }

    return date.toLocaleDateString("en-GH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Not set";
  }
}

function getTime(value) {
  if (!value) return 0;

  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getStatus(status) {
  return (
    statusConfig[status] || {
      label: status || "Unknown",
      className: "bg-gray-50 text-gray-700 border-gray-100",
      icon: AlertCircle,
    }
  );
}

export default function StaffRequestsPage() {
  const { user, loading: authLoading } = useAuth();

  const [requests, setRequests] = useState([]);
  const [projects, setProjects] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    setLoading(true);
    setError("");

    const requestsQuery = query(
      collection(db, "moneyRequests"),
      where("workerId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      requestsQuery,
      async (snapshot) => {
        try {
          const requestData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          requestData.sort(
            (a, b) => getTime(b.createdAt) - getTime(a.createdAt)
          );

          setRequests(requestData);

          /*
           * Load project names for the requests.
           *
           * We use individual document reads instead of a
           * composite Firestore query.
           */
          const projectIds = [
            ...new Set(
              requestData
                .map((request) => request.projectId)
                .filter(Boolean)
            ),
          ];

          if (projectIds.length > 0) {
            const projectEntries = await Promise.all(
              projectIds.map(async (projectId) => {
                try {
                  const projectSnapshot = await import(
                    "firebase/firestore"
                  ).then(({ getDoc, doc }) =>
                    getDoc(doc(db, "projects", projectId))
                  );

                  if (!projectSnapshot.exists()) {
                    return [projectId, null];
                  }

                  return [
                    projectId,
                    {
                      id: projectSnapshot.id,
                      ...projectSnapshot.data(),
                    },
                  ];
                } catch (projectError) {
                  console.error(
                    "Error loading project:",
                    projectError
                  );

                  return [projectId, null];
                }
              })
            );

            setProjects(Object.fromEntries(projectEntries));
          } else {
            setProjects({});
          }

          setLoading(false);
        } catch (snapshotError) {
          console.error(
            "Error processing requests:",
            snapshotError
          );

          setError(
            "Unable to load your requests. Please try again."
          );

          setLoading(false);
        }
      },
      (snapshotError) => {
        console.error(
          "Money requests listener error:",
          snapshotError
        );

        setError(
          "Unable to load your requests. Please try again."
        );

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, authLoading]);

  const stats = useMemo(() => {
    const pending = requests.filter(
      (request) => request.status === "pending"
    );

    const approved = requests.filter(
      (request) => request.status === "approved"
    );

    const rejected = requests.filter(
      (request) => request.status === "rejected"
    );

    const paid = requests.filter(
      (request) => request.status === "paid"
    );

    const approvedAmount = approved.reduce(
      (total, request) =>
        total + Number(request.amount || 0),
      0
    );

    const pendingAmount = pending.reduce(
      (total, request) =>
        total + Number(request.amount || 0),
      0
    );

    const paidAmount = paid.reduce(
      (total, request) =>
        total + Number(request.amount || 0),
      0
    );

    return {
      total: requests.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      paid: paid.length,
      approvedAmount,
      pendingAmount,
      paidAmount,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return requests.filter((request) => {
      if (
        activeFilter !== "all" &&
        request.status !== activeFilter
      ) {
        return false;
      }

      if (!searchValue) {
        return true;
      }

      const project = projects[request.projectId];

      const searchableText = [
        request.type,
        request.reason,
        request.status,
        project?.name,
        project?.service,
        project?.location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(searchValue);
    });
  }, [requests, projects, search, activeFilter]);

  if (authLoading || loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-200" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-gray-100" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl border border-[#E5EDF5] bg-white"
            />
          ))}
        </div>

        <div className="h-20 animate-pulse rounded-2xl border border-[#E5EDF5] bg-white" />

        <div className="grid gap-5 lg:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-56 animate-pulse rounded-2xl border border-[#E5EDF5] bg-white"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-500" />

          <h2 className="mt-4 text-lg font-semibold text-[#172033]">
            You are not signed in
          </h2>

          <p className="mt-1 text-sm text-[#667085]">
            Please sign in to view your requests.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#1769E0]">
            Staff Portal
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
            My Requests
          </h1>

          <p className="mt-2 text-sm text-[#667085] sm:text-base">
            Track money you have requested for your jobs.
          </p>
        </div>

        <Link
          href="/staff/requests/new"
          className="inline-flex w-fit items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1259C2]"
        >
          <Plus className="h-4 w-4" />
          New Request
        </Link>
      </div>

      {/* STATS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Requests"
          value={stats.total}
          icon={FileText}
          iconClass="bg-blue-50 text-[#1769E0]"
        />

        <StatCard
          title="Pending"
          value={stats.pending}
          icon={Clock3}
          iconClass="bg-amber-50 text-amber-600"
          footer={formatMoney(stats.pendingAmount)}
        />

        <StatCard
          title="Approved"
          value={stats.approved}
          icon={CheckCircle2}
          iconClass="bg-green-50 text-green-600"
          footer={formatMoney(stats.approvedAmount)}
        />

        <StatCard
          title="Paid"
          value={stats.paid}
          icon={WalletCards}
          iconClass="bg-indigo-50 text-indigo-600"
          footer={formatMoney(stats.paidAmount)}
        />
      </div>

      {/* ERROR */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <div>
            <p className="font-semibold">
              Something went wrong
            </p>

            <p className="mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* SEARCH + FILTER */}
      <div className="rounded-2xl border border-[#E5EDF5] bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98A2B3]" />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search requests, projects, reasons..."
            className="h-11 w-full rounded-xl border border-[#DCEAF8] bg-[#F8FBFF] pl-10 pr-4 text-sm text-[#172033] outline-none transition focus:border-[#1769E0] focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeFilter === filter.value
                  ? "bg-[#1769E0] text-white shadow-sm"
                  : "bg-[#F5FAFF] text-[#667085] hover:bg-[#EAF4FF] hover:text-[#1769E0]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* REQUEST LIST */}
      {filteredRequests.length === 0 ? (
        <EmptyState
          hasRequests={requests.length > 0}
          search={search}
          filter={activeFilter}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filteredRequests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              project={projects[request.projectId]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  iconClass,
  footer,
}) {
  return (
    <div className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[#667085]">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-[#172033]">
            {value}
          </p>

          {footer && (
            <p className="mt-1 text-xs font-medium text-[#98A2B3]">
              {footer}
            </p>
          )}
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function RequestCard({ request, project }) {
  const status = getStatus(request.status);
  const StatusIcon = status.icon;

  const type =
    typeLabels[request.type] ||
    request.type ||
    "Other";

  return (
    <Link
      href={`/staff/requests/${request.id}`}
      className="group block rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#BFD8F7] hover:shadow-md"
    >
      {/* TOP */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
            <DollarSign className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-[#172033] group-hover:text-[#1769E0]">
              {type} Request
            </h2>

            <p className="mt-1 truncate text-sm text-[#667085]">
              {project?.name || "No project specified"}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          {status.label}
        </span>
      </div>

      {/* AMOUNT */}
      <div className="mt-5 rounded-xl bg-[#F8FBFF] p-4">
        <p className="text-xs font-medium text-[#667085]">
          Requested amount
        </p>

        <p className="mt-1 text-xl font-bold text-[#172033]">
          {formatMoney(request.amount)}
        </p>
      </div>

      {/* REASON */}
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
          Reason
        </p>

        <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#667085]">
          {request.reason || "No reason provided."}
        </p>
      </div>

      {/* PROJECT / DATE */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2 text-sm text-[#667085]">
          <CalendarDays className="h-4 w-4 shrink-0" />

          <span>{formatDate(request.createdAt)}</span>
        </div>

        {project?.location && (
          <div className="truncate text-sm text-[#667085]">
            {project.location}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="mt-5 flex items-center justify-between border-t border-[#EEF3F8] pt-4">
        <span className="text-xs text-[#98A2B3]">
          Request ID: {request.id.slice(0, 8)}...
        </span>

        <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#1769E0]">
          View request
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function EmptyState({ hasRequests, search, filter }) {
  let title = "No requests yet";
  let message =
    "When you request money for a job, your requests will appear here.";

  if (hasRequests && (search || filter !== "all")) {
    title = "No matching requests";
    message =
      "Try changing your search or selecting a different status.";
  }

  return (
    <div className="rounded-2xl border border-dashed border-[#DCEAF8] bg-white px-6 py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF4FF] text-[#1769E0]">
        <WalletCards className="h-7 w-7" />
      </div>

      <h2 className="mt-4 text-lg font-bold text-[#172033]">
        {title}
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#667085]">
        {message}
      </p>

      {!hasRequests && (
        <Link
          href="/staff/requests/new"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1769E0] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1259C2]"
        >
          <Plus className="h-4 w-4" />
          Make a Request
        </Link>
      )}
    </div>
  );
}
