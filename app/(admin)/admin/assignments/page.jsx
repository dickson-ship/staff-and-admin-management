
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
  Plus,
  Search,
  User,
  Users,
} from "lucide-react";

import { collection, onSnapshot } from "firebase/firestore";

import { db } from "@/config/Firebase";

function formatDate(value) {
  if (!value) return "Not specified";

  try {
    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleDateString("en-GH", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

    return new Date(`${value}T00:00:00`).toLocaleDateString(
      "en-GH",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  } catch {
    return "Invalid date";
  }
}

function getStatusClasses(status) {
  switch (status) {
    case "completed":
      return "border-green-200 bg-green-50 text-green-700";

    case "in-progress":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function StatCard({ title, value, description, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[#667085]">{title}</p>

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

function AssignmentCard({ assignment }) {
  const workerName =
    assignment.worker?.name ||
    `${assignment.worker?.firstName || ""} ${
      assignment.worker?.lastName || ""
    }`.trim() ||
    "Unknown worker";

  const projectName =
    assignment.project?.name || "Unknown project";

  return (
    <Link
      href={`/admin/assignments/${assignment.id}`}
      className="group block rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#D0E2F7] hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FF]">
            <User className="h-5 w-5 text-[#1769E0]" />
          </div>

          <div className="min-w-0">
            <h3 className="truncate font-semibold text-[#172033]">
              {workerName}
            </h3>

            <p className="mt-1 truncate text-sm text-[#667085]">
              {projectName}
            </p>
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
            assignment.status
          )}`}
        >
          {assignment.status || "assigned"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2 text-sm text-[#667085]">
          <BriefcaseBusiness className="h-4 w-4 text-[#98A2B3]" />

          <span className="truncate">
            {assignment.project?.service ||
              "No service"}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-[#667085]">
          <CalendarDays className="h-4 w-4 text-[#98A2B3]" />

          <span>
            Due{" "}
            {formatDate(
              assignment.expectedCompletion
            )}
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-[#F0F3F7] pt-4">
        <span className="text-xs text-[#98A2B3]">
          Assigned{" "}
          {formatDate(assignment.startDate)}
        </span>

        <span className="flex items-center gap-1 text-sm font-semibold text-[#1769E0] transition group-hover:gap-2">
          View assignment
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [projects, setProjects] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All");

  useEffect(() => {
    let assignmentsData = [];
    let workersData = [];
    let projectsData = [];

    let assignmentsReady = false;
    let workersReady = false;
    let projectsReady = false;

    const updateAssignments = () => {
      if (
        !assignmentsReady ||
        !workersReady ||
        !projectsReady
      ) {
        return;
      }

      const workerMap = Object.fromEntries(
        workersData.map((worker) => [
          worker.id,
          worker,
        ])
      );

      const projectMap = Object.fromEntries(
        projectsData.map((project) => [
          project.id,
          project,
        ])
      );

      const enriched = assignmentsData.map(
        (assignment) => ({
          ...assignment,
          worker:
            workerMap[assignment.workerId] ||
            null,
          project:
            projectMap[assignment.projectId] ||
            null,
        })
      );

      enriched.sort((a, b) => {
        const aTime =
          a.createdAt?.toMillis?.() || 0;

        const bTime =
          b.createdAt?.toMillis?.() || 0;

        return bTime - aTime;
      });

      setAssignments(enriched);
      setLoading(false);
    };

    const unsubAssignments = onSnapshot(
      collection(db, "assignments"),
      (snapshot) => {
        assignmentsData = snapshot.docs.map(
          (assignmentDoc) => ({
            id: assignmentDoc.id,
            ...assignmentDoc.data(),
          })
        );

        assignmentsReady = true;
        updateAssignments();
      },
      (snapshotError) => {
        console.error(
          "Assignments error:",
          snapshotError
        );

        setError(
          "Unable to load assignments."
        );

        setLoading(false);
      }
    );

    const unsubWorkers = onSnapshot(
      collection(db, "workers"),
      (snapshot) => {
        workersData = snapshot.docs.map(
          (workerDoc) => ({
            id: workerDoc.id,
            ...workerDoc.data(),
          })
        );

        workersReady = true;
        updateAssignments();
      },
      (snapshotError) => {
        console.error(
          "Workers error:",
          snapshotError
        );

        setError(
          "Unable to load workers."
        );

        setLoading(false);
      }
    );

    const unsubProjects = onSnapshot(
      collection(db, "projects"),
      (snapshot) => {
        projectsData = snapshot.docs.map(
          (projectDoc) => ({
            id: projectDoc.id,
            ...projectDoc.data(),
          })
        );

        projectsReady = true;
        updateAssignments();
      },
      (snapshotError) => {
        console.error(
          "Projects error:",
          snapshotError
        );

        setError(
          "Unable to load projects."
        );

        setLoading(false);
      }
    );

    return () => {
      unsubAssignments();
      unsubWorkers();
      unsubProjects();
    };
  }, []);

  const stats = useMemo(() => {
    return {
      total: assignments.length,

      assigned: assignments.filter(
        (assignment) =>
          assignment.status === "assigned" ||
          !assignment.status
      ).length,

      inProgress: assignments.filter(
        (assignment) =>
          assignment.status === "in-progress"
      ).length,

      completed: assignments.filter(
        (assignment) =>
          assignment.status === "completed"
      ).length,
    };
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    const searchValue =
      search.trim().toLowerCase();

    return assignments.filter(
      (assignment) => {
        const workerName =
          assignment.worker?.name ||
          `${assignment.worker?.firstName || ""} ${
            assignment.worker?.lastName || ""
          }`.trim();

        const projectName =
          assignment.project?.name || "";

        const service =
          assignment.project?.service || "";

        const matchesSearch =
          !searchValue ||
          workerName
            .toLowerCase()
            .includes(searchValue) ||
          projectName
            .toLowerCase()
            .includes(searchValue) ||
          service
            .toLowerCase()
            .includes(searchValue);

        const matchesStatus =
          statusFilter === "All" ||
          assignment.status === statusFilter ||
          (statusFilter === "assigned" &&
            !assignment.status);

        return (
          matchesSearch &&
          matchesStatus
        );
      }
    );
  }, [
    assignments,
    search,
    statusFilter,
  ]);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#1769E0]">
            Operations
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
            Assignments
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-[#667085]">
            Assign workers to projects and track
            their work.
          </p>
        </div>

        <Link
          href="/admin/assignments/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1259C1]"
        >
          <Plus className="h-4 w-4" />
          Assign Worker
        </Link>
      </div>

      {/* STATS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Assignments"
          value={stats.total}
          description="All worker assignments"
          icon={Users}
        />

        <StatCard
          title="Assigned"
          value={stats.assigned}
          description="Waiting to start"
          icon={Clock3}
        />

        <StatCard
          title="In Progress"
          value={stats.inProgress}
          description="Currently working"
          icon={BriefcaseBusiness}
        />

        <StatCard
          title="Completed"
          value={stats.completed}
          description="Finished assignments"
          icon={CheckCircle2}
        />
      </div>

      {/* FILTERS */}
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
              placeholder="Search workers or projects..."
              className="h-11 w-full rounded-xl border border-[#DCEAF8] bg-[#F8FBFF] pl-10 pr-4 text-sm outline-none placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:ring-2 focus:ring-[#1769E0]/10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              "All",
              "assigned",
              "in-progress",
              "completed",
              "cancelled",
            ].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() =>
                  setStatusFilter(status)
                }
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  statusFilter === status
                    ? "bg-[#1769E0] text-white"
                    : "bg-[#F5FAFF] text-[#667085] hover:bg-[#EAF4FF] hover:text-[#1769E0]"
                }`}
              >
                {status === "All"
                  ? "All"
                  : status
                      .replace("-", " ")
                      .replace(
                        /\b\w/g,
                        (letter) =>
                          letter.toUpperCase()
                      )}
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
              Could not load assignments
            </p>

            <p className="mt-1">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* LIST */}
      {loading ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="animate-pulse rounded-2xl border border-[#E5EDF5] bg-white p-5"
            >
              <div className="h-5 w-2/3 rounded bg-[#EAF4FF]" />
              <div className="mt-3 h-4 w-1/3 rounded bg-[#F5FAFF]" />
              <div className="mt-6 h-3 w-full rounded bg-[#F5FAFF]" />
              <div className="mt-3 h-3 w-4/5 rounded bg-[#F5FAFF]" />
            </div>
          ))}
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DCEAF8] bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF4FF]">
            <Users className="h-6 w-6 text-[#1769E0]" />
          </div>

          <h2 className="mt-4 text-lg font-semibold text-[#172033]">
            No assignments yet
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm text-[#667085]">
            Assign workers to projects so they can
            start working on their jobs.
          </p>

          <Link
            href="/admin/assignments/new"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1769E0] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1259C1]"
          >
            <Plus className="h-4 w-4" />
            Assign Worker
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filteredAssignments.map(
            (assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
