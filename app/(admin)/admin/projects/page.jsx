
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Plus,
  Search,
  Users,
} from "lucide-react";

import {
  collection,
  onSnapshot,
} from "firebase/firestore";

import { db } from "@/config/Firebase";

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function formatDate(value) {
  if (!value) {
    return "No deadline";
  }

  try {
    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleDateString("en-GH", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

    return new Date(`${value}T00:00:00`).toLocaleDateString("en-GH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Invalid date";
  }
}

function getStatusClasses(status) {
  switch (status) {
    case "Completed":
      return "bg-green-50 text-green-700 border-green-200";

    case "In Progress":
      return "bg-blue-50 text-blue-700 border-blue-200";

    case "Planning":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "Cancelled":
      return "bg-red-50 text-red-700 border-red-200";

    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function getProgressBar(progress) {
  if (progress >= 100) {
    return "bg-green-500";
  }

  if (progress >= 50) {
    return "bg-[#1769E0]";
  }

  return "bg-amber-500";
}

function ProjectCard({ project }) {
  const customerName =
    project.customer?.name ||
    `${project.customer?.firstName || ""} ${
      project.customer?.lastName || ""
    }`.trim() ||
    "No customer";

  const progress = Math.min(
    100,
    Math.max(0, Number(project.progress || 0))
  );

  return (
    <Link
      href={`/admin/projects/${project.id}`}
      className="group block rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#D0E2F7] hover:shadow-md"
    >
      {/* TOP */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FF]">
            <BriefcaseBusiness className="h-5 w-5 text-[#1769E0]" />
          </div>

          <div className="min-w-0">
            <h3 className="truncate font-semibold text-[#172033]">
              {project.name || "Unnamed Project"}
            </h3>

            <p className="mt-1 truncate text-sm text-[#667085]">
              {customerName}
            </p>
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(
            project.status
          )}`}
        >
          {project.status || "Unknown"}
        </span>
      </div>

      {/* DETAILS */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2 text-sm text-[#667085]">
          <BriefcaseBusiness className="h-4 w-4 text-[#98A2B3]" />
          <span className="truncate">
            {project.service || "No service"}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-[#667085]">
          <MapPin className="h-4 w-4 text-[#98A2B3]" />
          <span className="truncate">
            {project.location || "No location"}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-[#667085]">
          <CalendarDays className="h-4 w-4 text-[#98A2B3]" />
          <span>
            Due {formatDate(project.deadline)}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm font-medium text-[#172033]">
          <span className="text-[#98A2B3]">GH₵</span>
          {formatCurrency(project.amount)}
        </div>
      </div>

      {/* PROGRESS */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[#667085]">
            Project progress
          </span>

          <span className="text-xs font-semibold text-[#172033]">
            {progress}%
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-[#EAF4FF]">
          <div
            className={`h-full rounded-full transition-all ${getProgressBar(
              progress
            )}`}
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-5 flex items-center justify-between border-t border-[#F0F3F7] pt-4">
        <span className="text-xs text-[#98A2B3]">
          Updated{" "}
          {project.updatedAt
            ? project.updatedAt.toDate
              ? project.updatedAt.toDate().toLocaleDateString()
              : "recently"
            : "recently"}
        </span>

        <span className="flex items-center gap-1 text-sm font-semibold text-[#1769E0] transition group-hover:gap-2">
          View project
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

function ProjectSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-[#E5EDF5] bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-xl bg-[#EAF4FF]" />

        <div className="flex-1">
          <div className="h-4 w-2/3 rounded bg-[#EAF4FF]" />
          <div className="mt-2 h-3 w-1/3 rounded bg-[#F5FAFF]" />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="h-3 w-full rounded bg-[#F5FAFF]" />
        <div className="h-3 w-4/5 rounded bg-[#F5FAFF]" />
        <div className="h-2 w-full rounded bg-[#EAF4FF]" />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}) {
  return (
    <div className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[#667085]">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-[#172033]">
            {value}
          </p>

          <p className="mt-1 text-xs text-[#98A2B3]">
            {description}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF4FF]">
          <Icon className="h-5 w-5 text-[#1769E0]" />
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    const projectsRef = collection(db, "projects");

    const unsubscribe = onSnapshot(
      projectsRef,
      (snapshot) => {
        const projectList = snapshot.docs.map((projectDoc) => ({
          id: projectDoc.id,
          ...projectDoc.data(),
        }));

        projectList.sort((a, b) => {
          const aTime = a.updatedAt?.toMillis?.() || 0;
          const bTime = b.updatedAt?.toMillis?.() || 0;

          return bTime - aTime;
        });

        setProjects(projectList);
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        console.error("Projects error:", snapshotError);

        setError(
          "Unable to load projects. Please check your Firebase connection and permissions."
        );

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredProjects = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return projects.filter((project) => {
      const customerName =
        project.customer?.name ||
        `${project.customer?.firstName || ""} ${
          project.customer?.lastName || ""
        }`.trim();

      const matchesSearch =
        !searchValue ||
        project.name?.toLowerCase().includes(searchValue) ||
        project.service?.toLowerCase().includes(searchValue) ||
        project.location?.toLowerCase().includes(searchValue) ||
        customerName?.toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === "All" ||
        project.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: projects.length,

      planning: projects.filter(
        (project) => project.status === "Planning"
      ).length,

      inProgress: projects.filter(
        (project) => project.status === "In Progress"
      ).length,

      completed: projects.filter(
        (project) => project.status === "Completed"
      ).length,
    };
  }, [projects]);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#1769E0]">
            Operations
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
            Projects
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-[#667085]">
            Manage company projects, track progress and monitor
            project deadlines.
          </p>
        </div>

        <Link
          href="/admin/projects/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1259C1]"
        >
          <Plus className="h-4 w-4" />
          New Project
        </Link>
      </div>

      {/* STATS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Projects"
          value={stats.total}
          description="All projects"
          icon={BriefcaseBusiness}
        />

        <StatCard
          title="Planning"
          value={stats.planning}
          description="Projects being prepared"
          icon={Clock3}
        />

        <StatCard
          title="In Progress"
          value={stats.inProgress}
          description="Currently active"
          icon={ActivityIcon}
        />

        <StatCard
          title="Completed"
          value={stats.completed}
          description="Successfully completed"
          icon={CheckCircle2}
        />
      </div>

      {/* SEARCH + FILTER */}
      <div className="rounded-2xl border border-[#E5EDF5] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search projects, customers, locations..."
              className="h-11 w-full rounded-xl border border-[#DCEAF8] bg-[#F8FBFF] pl-10 pr-4 text-sm text-[#172033] outline-none transition placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:ring-2 focus:ring-[#1769E0]/10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              "All",
              "Planning",
              "In Progress",
              "Completed",
              "Cancelled",
            ].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  statusFilter === status
                    ? "bg-[#1769E0] text-white"
                    : "bg-[#F5FAFF] text-[#667085] hover:bg-[#EAF4FF] hover:text-[#1769E0]"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <div>
            <p className="font-semibold">
              Could not load projects
            </p>

            <p className="mt-1">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* RESULTS */}
      {loading ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <ProjectSkeleton />
          <ProjectSkeleton />
          <ProjectSkeleton />
          <ProjectSkeleton />
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DCEAF8] bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF4FF]">
            <BriefcaseBusiness className="h-6 w-6 text-[#1769E0]" />
          </div>

          <h2 className="mt-4 text-lg font-semibold text-[#172033]">
            {projects.length === 0
              ? "No projects yet"
              : "No matching projects"}
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm text-[#667085]">
            {projects.length === 0
              ? "Create your first project to start assigning workers and tracking company work."
              : "Try changing your search or status filter."}
          </p>

          {projects.length === 0 && (
            <Link
              href="/admin/projects/new"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1769E0] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1259C1]"
            >
              <Plus className="h-4 w-4" />
              Create Project
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#667085]">
              Showing{" "}
              <span className="font-semibold text-[#172033]">
                {filteredProjects.length}
              </span>{" "}
              project
              {filteredProjects.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ActivityIcon(props) {
  return <Users {...props} />;
}
