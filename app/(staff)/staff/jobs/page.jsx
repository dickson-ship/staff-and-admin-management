"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  Search,
  Loader2,
  AlertCircle,
  XCircle,
} from "lucide-react";

import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

const statusConfig = {
  assigned: {
    label: "Assigned",
    className: "bg-blue-50 text-blue-700 border-blue-100",
    icon: Clock3,
  },
  "in-progress": {
    label: "In Progress",
    className: "bg-amber-50 text-amber-700 border-amber-100",
    icon: BriefcaseBusiness,
  },
  completed: {
    label: "Completed",
    className: "bg-green-50 text-green-700 border-green-100",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-50 text-red-700 border-red-100",
    icon: XCircle,
  },
};

const filters = [
  { value: "all", label: "All Jobs" },
  { value: "assigned", label: "Assigned" },
  { value: "in-progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function formatDate(value) {
  if (!value) return "Not set";

  try {
    let date;

    if (typeof value?.toDate === "function") {
      date = value.toDate();
    } else {
      date = new Date(value);
    }

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

function getCreatedTime(value) {
  if (!value) return 0;

  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getProgress(project) {
  const progress = Number(project?.progress);

  if (Number.isNaN(progress)) return 0;

  return Math.min(Math.max(progress, 0), 100);
}

function getStatus(status) {
  return statusConfig[status] || {
    label: status || "Unknown",
    className: "bg-gray-50 text-gray-700 border-gray-100",
    icon: AlertCircle,
  };
}

export default function StaffJobsPage() {
  const { user, profile, loading: authLoading } = useAuth();

  const [assignments, setAssignments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      return;
    }

    let unsubscribeAssignments;

    async function loadJobs() {
      try {
        setLoading(true);
        setError("");

        /*
         * We query only assignments belonging to the
         * currently logged-in staff member.
         */
        const assignmentsQuery = query(
          collection(db, "assignments"),
          where("workerId", "==", user.uid)
        );

        unsubscribeAssignments = onSnapshot(
          assignmentsQuery,
          async (assignmentSnapshot) => {
            try {
              const assignmentData = assignmentSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              }));

              setAssignments(assignmentData);

              /*
               * Get all projects referenced by the worker's assignments.
               *
               * We fetch the projects separately because an assignment
               * only stores projectId.
               */
              const projectIds = [
                ...new Set(
                  assignmentData
                    .map((assignment) => assignment.projectId)
                    .filter(Boolean)
                ),
              ];

              if (projectIds.length === 0) {
                setProjects([]);
                setLoading(false);
                return;
              }

              const projectResults = await Promise.all(
                projectIds.map((projectId) =>
                  getDocs(
                    query(
                      collection(db, "projects"),
                      where("__name__", "==", projectId)
                    )
                  )
                )
              );

              const projectData = [];

              projectResults.forEach((snapshot) => {
                snapshot.forEach((doc) => {
                  projectData.push({
                    id: doc.id,
                    ...doc.data(),
                  });
                });
              });

              setProjects(projectData);
              setLoading(false);
            } catch (innerError) {
              console.error("Error loading staff jobs:", innerError);
              setError("Unable to load your jobs. Please try again.");
              setLoading(false);
            }
          },
          (snapshotError) => {
            console.error("Assignments listener error:", snapshotError);
            setError("Unable to load your jobs. Please try again.");
            setLoading(false);
          }
        );
      } catch (loadError) {
        console.error("Error setting up jobs:", loadError);
        setError("Unable to load your jobs. Please try again.");
        setLoading(false);
      }
    }

    loadJobs();

    return () => {
      if (unsubscribeAssignments) {
        unsubscribeAssignments();
      }
    };
  }, [user, authLoading]);

  const jobs = useMemo(() => {
    const projectMap = new Map(
      projects.map((project) => [project.id, project])
    );

    return assignments
      .map((assignment) => {
        const project = projectMap.get(assignment.projectId);

        return {
          ...assignment,
          project: project || null,
        };
      })
      .sort(
        (a, b) =>
          getCreatedTime(b.createdAt) - getCreatedTime(a.createdAt)
      );
  }, [assignments, projects]);

  const filteredJobs = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return jobs.filter((job) => {
      const project = job.project;

      const matchesFilter =
        activeFilter === "all" || job.status === activeFilter;

      if (!matchesFilter) {
        return false;
      }

      if (!searchValue) {
        return true;
      }

      const searchableText = [
        project?.name,
        project?.service,
        project?.location,
        project?.customer?.name,
        project?.customer?.firstName,
        project?.customer?.lastName,
        job.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(searchValue);
    });
  }, [jobs, search, activeFilter]);

  const stats = useMemo(() => {
    return {
      total: jobs.length,
      assigned: jobs.filter((job) => job.status === "assigned").length,
      inProgress: jobs.filter(
        (job) => job.status === "in-progress"
      ).length,
      completed: jobs.filter((job) => job.status === "completed").length,
    };
  }, [jobs]);

  if (authLoading || loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-200" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-100" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl border border-[#E5EDF5] bg-white"
            />
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-64 animate-pulse rounded-2xl border border-[#E5EDF5] bg-white"
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
            Please sign in to view your assigned jobs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <p className="text-sm font-medium text-[#1769E0]">
          Staff Portal
        </p>

        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
          My Jobs
        </h1>

        <p className="mt-2 text-sm text-[#667085] sm:text-base">
          View and manage the projects assigned to you.
        </p>
      </div>

      {/* STATS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Jobs"
          value={stats.total}
          icon={BriefcaseBusiness}
          iconClass="bg-blue-50 text-[#1769E0]"
        />

        <StatCard
          title="Assigned"
          value={stats.assigned}
          icon={Clock3}
          iconClass="bg-indigo-50 text-indigo-600"
        />

        <StatCard
          title="In Progress"
          value={stats.inProgress}
          icon={BriefcaseBusiness}
          iconClass="bg-amber-50 text-amber-600"
        />

        <StatCard
          title="Completed"
          value={stats.completed}
          icon={CheckCircle2}
          iconClass="bg-green-50 text-green-600"
        />
      </div>

      {/* ERROR */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* SEARCH + FILTERS */}
      <div className="rounded-2xl border border-[#E5EDF5] bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98A2B3]" />

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search jobs, services, locations..."
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

      {/* JOBS */}
      {filteredJobs.length === 0 ? (
        <EmptyState
          hasJobs={jobs.length > 0}
          search={search}
          filter={activeFilter}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filteredJobs.map((job) => (
            <JobCard key={job.id} job={job} />
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
}) {
  return (
    <div className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[#667085]">{title}</p>
          <p className="mt-2 text-2xl font-bold text-[#172033]">
            {value}
          </p>
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

function JobCard({ job }) {
  const project = job.project;
  const status = getStatus(job.status);
  const StatusIcon = status.icon;

  const progress = getProgress(project);

  const customerName =
    project?.customer?.name ||
    [project?.customer?.firstName, project?.customer?.lastName]
      .filter(Boolean)
      .join(" ") ||
    "Customer";

  return (
    <Link
      href={`/staff/jobs/${job.id}`}
      className="group block rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#BFD8F7] hover:shadow-md"
    >
      {/* TOP */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
            <BriefcaseBusiness className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-[#172033] group-hover:text-[#1769E0]">
              {project?.name || "Project"}
            </h2>

            <p className="mt-1 truncate text-sm text-[#667085]">
              {project?.service || "Construction project"}
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

      {/* DETAILS */}
      <div className="mt-5 space-y-3">
        <DetailRow
          icon={MapPin}
          label="Location"
          value={project?.location || "Location not set"}
        />

        <DetailRow
          icon={CalendarDays}
          label="Expected completion"
          value={formatDate(job.expectedCompletion)}
        />

        <DetailRow
          icon={BriefcaseBusiness}
          label="Customer"
          value={customerName}
        />
      </div>

      {/* PROGRESS */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[#667085]">
            Project progress
          </span>

          <span className="text-xs font-bold text-[#172033]">
            {progress}%
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-[#EAF4FF]">
          <div
            className="h-full rounded-full bg-[#1769E0] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-5 flex items-center justify-between border-t border-[#EEF3F8] pt-4">
        <span className="text-xs text-[#98A2B3]">
          Assigned {formatDate(job.createdAt)}
        </span>

        <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#1769E0]">
          View job
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F5FAFF] text-[#667085]">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[#98A2B3]">
          {label}
        </p>

        <p className="truncate text-sm font-medium text-[#172033]">
          {value}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ hasJobs, search, filter }) {
  let title = "No jobs assigned yet";
  let message =
    "When an administrator assigns a project to you, it will appear here.";

  if (hasJobs && (search || filter !== "all")) {
    title = "No matching jobs";
    message =
      "Try changing your search or selecting a different status.";
  }

  return (
    <div className="rounded-2xl border border-dashed border-[#DCEAF8] bg-white px-6 py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF4FF] text-[#1769E0]">
        <BriefcaseBusiness className="h-7 w-7" />
      </div>

      <h2 className="mt-4 text-lg font-bold text-[#172033]">
        {title}
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#667085]">
        {message}
      </p>
    </div>
  );
}