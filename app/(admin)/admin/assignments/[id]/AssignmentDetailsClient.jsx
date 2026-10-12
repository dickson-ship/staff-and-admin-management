
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  MapPin,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

export default function AssignmentDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const assignmentId = params?.id;

  const { user, profile, loading: authLoading } = useAuth();

  const [assignment, setAssignment] = useState(null);
  const [worker, setWorker] = useState(null);
  const [project, setProject] = useState(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ---------------------------------------------------------
  // AUTH CHECK
  // ---------------------------------------------------------
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (profile && profile.role !== "admin") {
      router.replace("/login");
    }
  }, [authLoading, user, profile, router]);

  // ---------------------------------------------------------
  // LOAD ASSIGNMENT
  // ---------------------------------------------------------
  useEffect(() => {
    if (authLoading || !user || !assignmentId) return;

    async function loadAssignment() {
      try {
        setLoading(true);
        setError("");

        const assignmentRef = doc(
          db,
          "assignments",
          assignmentId
        );

        const assignmentSnapshot = await getDoc(assignmentRef);

        if (!assignmentSnapshot.exists()) {
          setError("Assignment not found.");
          setLoading(false);
          return;
        }

        const assignmentData = {
          id: assignmentSnapshot.id,
          ...assignmentSnapshot.data(),
        };

        setAssignment(assignmentData);

        // Load worker
        if (assignmentData.workerId) {
          const workerRef = doc(
            db,
            "workers",
            assignmentData.workerId
          );

          const workerSnapshot = await getDoc(workerRef);

          if (workerSnapshot.exists()) {
            setWorker({
              id: workerSnapshot.id,
              ...workerSnapshot.data(),
            });
          }
        }

        // Load project
        if (assignmentData.projectId) {
          const projectRef = doc(
            db,
            "projects",
            assignmentData.projectId
          );

          const projectSnapshot = await getDoc(projectRef);

          if (projectSnapshot.exists()) {
            setProject({
              id: projectSnapshot.id,
              ...projectSnapshot.data(),
            });
          }
        }
      } catch (err) {
        console.error("Error loading assignment:", err);

        setError(
          err?.message || "Unable to load assignment."
        );
      } finally {
        setLoading(false);
      }
    }

    loadAssignment();
  }, [authLoading, user, assignmentId]);

  // ---------------------------------------------------------
  // UPDATE STATUS
  // ---------------------------------------------------------
  async function updateAssignmentStatus(newStatus) {
    if (!assignmentId) return;

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      await updateDoc(
        doc(db, "assignments", assignmentId),
        {
          status: newStatus,
          updatedAt: serverTimestamp(),
        }
      );

      setAssignment((previous) => ({
        ...previous,
        status: newStatus,
      }));

      setSuccess(
        `Assignment marked as ${formatStatus(newStatus)}.`
      );
    } catch (err) {
      console.error("Error updating assignment:", err);

      setError(
        err?.message ||
          "Unable to update the assignment status."
      );
    } finally {
      setActionLoading(false);
    }
  }

  // ---------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------
  function formatStatus(status) {
    if (!status) return "Unknown";

    return status
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function getStatusClasses(status) {
    switch (String(status || "").toLowerCase()) {
      case "assigned":
        return "bg-blue-50 text-blue-700 border-blue-200";

      case "in-progress":
      case "in progress":
        return "bg-amber-50 text-amber-700 border-amber-200";

      case "completed":
        return "bg-green-50 text-green-700 border-green-200";

      case "cancelled":
      case "canceled":
        return "bg-red-50 text-red-700 border-red-200";

      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  }

  function formatDate(value) {
    if (!value) return "Not set";

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

  function getWorkerName() {
    if (!worker) return "Unknown Worker";

    return (
      worker.name ||
      `${worker.firstName || ""} ${worker.lastName || ""}`.trim() ||
      "Unnamed Worker"
    );
  }

  // ---------------------------------------------------------
  // LOADING
  // ---------------------------------------------------------
  if (authLoading || loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#1769E0]" />

          <p className="text-sm text-[#667085]">
            Loading assignment...
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // ERROR / NOT FOUND
  // ---------------------------------------------------------
  if (!assignment) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link
          href="/admin/assignments"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#667085] hover:text-[#1769E0]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Assignments
        </Link>

        <div className="rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <XCircle className="mx-auto h-12 w-12 text-red-500" />

          <h1 className="mt-4 text-xl font-bold text-[#172033]">
            Assignment Not Found
          </h1>

          <p className="mt-2 text-sm text-[#667085]">
            {error || "This assignment could not be found."}
          </p>
        </div>
      </div>
    );
  }

  const status = String(
    assignment.status || "assigned"
  ).toLowerCase();

  const workerName = getWorkerName();

  // ---------------------------------------------------------
  // PAGE
  // ---------------------------------------------------------
  return (
    <div className="mx-auto max-w-6xl">
      {/* BACK */}
      <Link
        href="/admin/assignments"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#667085] transition hover:text-[#1769E0]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Assignments
      </Link>

      {/* HEADER */}
      <div className="mb-8 rounded-3xl border border-[#E5EDF5] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EAF4FF] text-[#1769E0]">
              <Users className="h-7 w-7" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
                  Worker Assignment
                </h1>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                    status
                  )}`}
                >
                  {formatStatus(status)}
                </span>
              </div>

              <p className="mt-2 text-sm text-[#667085]">
                Assignment ID:{" "}
                <span className="font-medium text-[#172033]">
                  {assignment.id}
                </span>
              </p>
            </div>
          </div>

          {/* STATUS ACTIONS */}
          <div className="flex flex-wrap gap-2">
            {status === "assigned" && (
              <button
                type="button"
                onClick={() =>
                  updateAssignmentStatus("in-progress")
                }
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1769E0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1259BF] disabled:opacity-60"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Clock3 className="h-4 w-4" />
                )}
                Start Work
              </button>
            )}

            {status === "in-progress" && (
              <button
                type="button"
                onClick={() =>
                  updateAssignmentStatus("completed")
                }
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Mark Completed
              </button>
            )}

            {(status === "assigned" ||
              status === "in-progress") && (
              <button
                type="button"
                onClick={() =>
                  updateAssignmentStatus("cancelled")
                }
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" />
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SUCCESS */}
      {success && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-700">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {success}
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* MAIN GRID */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT */}
        <div className="space-y-6 lg:col-span-2">
          {/* WORKER */}
          <section className="rounded-3xl border border-[#E5EDF5] bg-white shadow-sm">
            <div className="border-b border-[#E5EDF5] px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <UserRound className="h-5 w-5 text-[#1769E0]" />

                <h2 className="font-semibold text-[#172033]">
                  Assigned Worker
                </h2>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {worker ? (
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF4FF] text-lg font-bold text-[#1769E0]">
                      {workerName.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <h3 className="font-semibold text-[#172033]">
                        {workerName}
                      </h3>

                      <p className="mt-1 text-sm text-[#667085]">
                        {worker.role || "Worker"}
                      </p>

                      {worker.employeeId && (
                        <p className="mt-1 text-xs text-[#98A2B3]">
                          Employee ID: {worker.employeeId}
                        </p>
                      )}
                    </div>
                  </div>

                  <Link
                    href={`/admin/workers/${worker.id}`}
                    className="inline-flex items-center justify-center rounded-xl border border-[#DCEAF8] px-4 py-2.5 text-sm font-semibold text-[#1769E0] transition hover:bg-[#F8FBFF]"
                  >
                    View Worker
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-[#667085]">
                  Worker information is unavailable.
                </p>
              )}
            </div>
          </section>

          {/* PROJECT */}
          <section className="rounded-3xl border border-[#E5EDF5] bg-white shadow-sm">
            <div className="border-b border-[#E5EDF5] px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <BriefcaseBusiness className="h-5 w-5 text-[#1769E0]" />

                <h2 className="font-semibold text-[#172033]">
                  Project
                </h2>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {project ? (
                <>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-[#172033]">
                        {project.name || "Unnamed Project"}
                      </h3>

                      <p className="mt-1 text-sm text-[#667085]">
                        {project.service || "Project"}
                      </p>
                    </div>

                    <Link
                      href={`/admin/projects/${project.id}`}
                      className="inline-flex items-center justify-center rounded-xl border border-[#DCEAF8] px-4 py-2.5 text-sm font-semibold text-[#1769E0] transition hover:bg-[#F8FBFF]"
                    >
                      View Project
                    </Link>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#F8FBFF] p-4">
                      <div className="flex items-center gap-2 text-[#667085]">
                        <MapPin className="h-4 w-4" />

                        <span className="text-xs font-medium">
                          Location
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-semibold text-[#172033]">
                        {project.location || "Not provided"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#F8FBFF] p-4">
                      <div className="flex items-center gap-2 text-[#667085]">
                        <BriefcaseBusiness className="h-4 w-4" />

                        <span className="text-xs font-medium">
                          Project Value
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-semibold text-[#172033]">
                        GH₵{" "}
                        {Number(project.amount || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[#667085]">
                  Project information is unavailable.
                </p>
              )}
            </div>
          </section>

          {/* NOTES */}
          <section className="rounded-3xl border border-[#E5EDF5] bg-white shadow-sm">
            <div className="border-b border-[#E5EDF5] px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-[#1769E0]" />

                <h2 className="font-semibold text-[#172033]">
                  Assignment Notes
                </h2>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {assignment.notes ? (
                <p className="whitespace-pre-wrap text-sm leading-7 text-[#667085]">
                  {assignment.notes}
                </p>
              ) : (
                <p className="text-sm text-[#98A2B3]">
                  No notes were added to this assignment.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {/* SCHEDULE */}
          <section className="rounded-3xl border border-[#E5EDF5] bg-white shadow-sm">
            <div className="border-b border-[#E5EDF5] px-5 py-5">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-[#1769E0]" />

                <h2 className="font-semibold text-[#172033]">
                  Schedule
                </h2>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#98A2B3]">
                  Start Date
                </p>

                <p className="mt-1 text-sm font-semibold text-[#172033]">
                  {formatDate(assignment.startDate)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#98A2B3]">
                  Expected Completion
                </p>

                <p className="mt-1 text-sm font-semibold text-[#172033]">
                  {formatDate(assignment.expectedCompletion)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#98A2B3]">
                  Current Status
                </p>

                <span
                  className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                    status
                  )}`}
                >
                  {formatStatus(status)}
                </span>
              </div>
            </div>
          </section>

          {/* WORKER CONTACT */}
          <section className="rounded-3xl border border-[#E5EDF5] bg-white shadow-sm">
            <div className="border-b border-[#E5EDF5] px-5 py-5">
              <h2 className="font-semibold text-[#172033]">
                Worker Contact
              </h2>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <p className="text-xs text-[#98A2B3]">
                  Email
                </p>

                <p className="mt-1 break-all text-sm font-medium text-[#172033]">
                  {worker?.email || "Not provided"}
                </p>
              </div>

              <div>
                <p className="text-xs text-[#98A2B3]">
                  Phone
                </p>

                <p className="mt-1 text-sm font-medium text-[#172033]">
                  {worker?.phone || "Not provided"}
                </p>
              </div>

              <div>
                <p className="text-xs text-[#98A2B3]">
                  Worker Status
                </p>

                <p className="mt-1 text-sm font-medium capitalize text-[#172033]">
                  {worker?.status || "Unknown"}
                </p>
              </div>
            </div>
          </section>

          {/* FUTURE */}
          <section className="rounded-3xl border border-dashed border-[#DCEAF8] bg-[#F8FBFF] p-5">
            <h2 className="font-semibold text-[#172033]">
              Assignment Activity
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#667085]">
              Worker requests, resources, completed work submissions,
              expenses, and payment information will appear here as
              those features are connected.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
