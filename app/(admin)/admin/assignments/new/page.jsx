
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Loader2,
  UserRound,
  Users,
} from "lucide-react";

import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

export default function NewAssignmentPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [projects, setProjects] = useState([]);
  const [workers, setWorkers] = useState([]);

  const [form, setForm] = useState({
    projectId: "",
    workerId: "",
    startDate: "",
    expectedCompletion: "",
    notes: "",
  });

  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ---------------------------------------------------------
  // LOAD PROJECTS AND WORKERS
  // ---------------------------------------------------------
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingData(true);
        setError("");

        const [projectsSnapshot, workersSnapshot] = await Promise.all([
          getDocs(collection(db, "projects")),
          getDocs(collection(db, "workers")),
        ]);

        const projectList = projectsSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((project) => {
            const status = String(project.status || "").toLowerCase();

            return status !== "completed" && status !== "cancelled";
          })
          .sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || ""))
          );

        const workerList = workersSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((worker) => {
            const status = String(worker.status || "").toLowerCase();

            return status === "active";
          })
          .sort((a, b) => {
            const nameA =
              a.name ||
              `${a.firstName || ""} ${a.lastName || ""}`.trim();

            const nameB =
              b.name ||
              `${b.firstName || ""} ${b.lastName || ""}`.trim();

            return nameA.localeCompare(nameB);
          });

        setProjects(projectList);
        setWorkers(workerList);
      } catch (err) {
        console.error("Error loading assignment data:", err);
        setError("Unable to load projects and workers.");
      } finally {
        setLoadingData(false);
      }
    }

    if (!authLoading && user && profile?.role === "admin") {
      loadData();
    }
  }, [authLoading, user, profile]);

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
  // HANDLE FORM CHANGE
  // ---------------------------------------------------------
  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  // ---------------------------------------------------------
  // SUBMIT ASSIGNMENT
  // ---------------------------------------------------------
  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!user) {
      setError("You must be logged in as an administrator.");
      return;
    }

    if (profile?.role !== "admin") {
      setError("You do not have permission to create assignments.");
      return;
    }

    if (!form.projectId) {
      setError("Please select a project.");
      return;
    }

    if (!form.workerId) {
      setError("Please select a worker.");
      return;
    }

    if (!form.startDate) {
      setError("Please select a start date.");
      return;
    }

    if (!form.expectedCompletion) {
      setError("Please select an expected completion date.");
      return;
    }

    if (form.expectedCompletion < form.startDate) {
      setError(
        "Expected completion date cannot be earlier than the start date."
      );
      return;
    }

    try {
      setSubmitting(true);

      const assignmentData = {
        projectId: form.projectId,
        workerId: form.workerId,
        assignedBy: user.uid,

        status: "assigned",

        startDate: form.startDate,
        expectedCompletion: form.expectedCompletion,

        notes: form.notes.trim(),

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const assignmentRef = await addDoc(
        collection(db, "assignments"),
        assignmentData
      );

      console.log("Assignment created:", assignmentRef.id);

      setSuccess("Worker assigned successfully.");

      setTimeout(() => {
        router.push(`/admin/assignments/${assignmentRef.id}`);
      }, 800);
    } catch (err) {
      console.error("Error creating assignment:", err);

      setError(
        err?.message ||
          "Something went wrong while creating the assignment."
      );

      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------
  // LOADING
  // ---------------------------------------------------------
  if (authLoading || loadingData) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#1769E0]" />

          <p className="text-sm text-[#667085]">
            Loading assignment form...
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // PAGE
  // ---------------------------------------------------------
  return (
    <div className="mx-auto max-w-4xl">
      {/* HEADER */}
      <div className="mb-8">
        <Link
          href="/admin/assignments"
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-[#667085] transition hover:text-[#1769E0]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Assignments
        </Link>

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF4FF] text-[#1769E0]">
            <Users className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
              Assign Worker
            </h1>

            <p className="mt-2 text-sm leading-6 text-[#667085] sm:text-base">
              Assign a worker to a project and set the expected work period.
            </p>
          </div>
        </div>
      </div>

      {/* FORM CARD */}
      <div className="overflow-hidden rounded-3xl border border-[#E5EDF5] bg-white shadow-sm">
        {/* CARD HEADER */}
        <div className="border-b border-[#E5EDF5] bg-[#F8FBFF] px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#1769E0] shadow-sm">
              <ClipboardList className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-semibold text-[#172033]">
                Assignment Details
              </h2>

              <p className="text-sm text-[#667085]">
                Select the project and worker.
              </p>
            </div>
          </div>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-7">
          <div className="space-y-7">
            {/* PROJECT + WORKER */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* PROJECT */}
              <div>
                <label
                  htmlFor="projectId"
                  className="mb-2 block text-sm font-semibold text-[#172033]"
                >
                  Project <span className="text-red-500">*</span>
                </label>

                <select
                  id="projectId"
                  name="projectId"
                  value={form.projectId}
                  onChange={handleChange}
                  disabled={submitting}
                  className="w-full rounded-xl border border-[#DCEAF8] bg-white px-4 py-3.5 text-sm text-[#172033] outline-none transition focus:border-[#1769E0] focus:ring-4 focus:ring-[#1769E0]/10 disabled:bg-[#F8FBFF]"
                >
                  <option value="">Select project</option>

                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name || "Unnamed Project"}
                    </option>
                  ))}
                </select>

                {projects.length === 0 && (
                  <p className="mt-2 text-xs text-amber-600">
                    No active projects are available.
                  </p>
                )}
              </div>

              {/* WORKER */}
              <div>
                <label
                  htmlFor="workerId"
                  className="mb-2 block text-sm font-semibold text-[#172033]"
                >
                  Worker <span className="text-red-500">*</span>
                </label>

                <select
                  id="workerId"
                  name="workerId"
                  value={form.workerId}
                  onChange={handleChange}
                  disabled={submitting}
                  className="w-full rounded-xl border border-[#DCEAF8] bg-white px-4 py-3.5 text-sm text-[#172033] outline-none transition focus:border-[#1769E0] focus:ring-4 focus:ring-[#1769E0]/10 disabled:bg-[#F8FBFF]"
                >
                  <option value="">Select worker</option>

                  {workers.map((worker) => {
                    const workerName =
                      worker.name ||
                      `${worker.firstName || ""} ${
                        worker.lastName || ""
                      }`.trim() ||
                      "Unnamed Worker";

                    return (
                      <option key={worker.id} value={worker.id}>
                        {workerName}
                        {worker.employeeId
                          ? ` — ${worker.employeeId}`
                          : ""}
                      </option>
                    );
                  })}
                </select>

                {workers.length === 0 && (
                  <p className="mt-2 text-xs text-amber-600">
                    No active workers are available.
                  </p>
                )}
              </div>
            </div>

            {/* SCHEDULE */}
            <div>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[#172033]">
                  Work Schedule
                </h3>

                <p className="mt-1 text-sm text-[#667085]">
                  Define when the worker should start and finish the job.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* START DATE */}
                <div>
                  <label
                    htmlFor="startDate"
                    className="mb-2 block text-sm font-semibold text-[#172033]"
                  >
                    Start Date <span className="text-red-500">*</span>
                  </label>

                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98A2B3]" />

                    <input
                      id="startDate"
                      name="startDate"
                      type="date"
                      value={form.startDate}
                      onChange={handleChange}
                      disabled={submitting}
                      className="w-full rounded-xl border border-[#DCEAF8] bg-white py-3.5 pl-11 pr-4 text-sm text-[#172033] outline-none transition focus:border-[#1769E0] focus:ring-4 focus:ring-[#1769E0]/10 disabled:bg-[#F8FBFF]"
                    />
                  </div>
                </div>

                {/* EXPECTED COMPLETION */}
                <div>
                  <label
                    htmlFor="expectedCompletion"
                    className="mb-2 block text-sm font-semibold text-[#172033]"
                  >
                    Expected Completion{" "}
                    <span className="text-red-500">*</span>
                  </label>

                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98A2B3]" />

                    <input
                      id="expectedCompletion"
                      name="expectedCompletion"
                      type="date"
                      min={form.startDate || undefined}
                      value={form.expectedCompletion}
                      onChange={handleChange}
                      disabled={submitting}
                      className="w-full rounded-xl border border-[#DCEAF8] bg-white py-3.5 pl-11 pr-4 text-sm text-[#172033] outline-none transition focus:border-[#1769E0] focus:ring-4 focus:ring-[#1769E0]/10 disabled:bg-[#F8FBFF]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* NOTES */}
            <div>
              <label
                htmlFor="notes"
                className="mb-2 block text-sm font-semibold text-[#172033]"
              >
                Assignment Notes
              </label>

              <textarea
                id="notes"
                name="notes"
                rows={5}
                value={form.notes}
                onChange={handleChange}
                disabled={submitting}
                placeholder="Add instructions or important information for the worker..."
                className="w-full resize-none rounded-xl border border-[#DCEAF8] bg-white px-4 py-3.5 text-sm text-[#172033] outline-none placeholder:text-[#98A2B3] transition focus:border-[#1769E0] focus:ring-4 focus:ring-[#1769E0]/10 disabled:bg-[#F8FBFF]"
              />

              <p className="mt-2 text-xs text-[#667085]">
                Example: Install network cables on the first floor and test
                all connections before completion.
              </p>
            </div>

            {/* ERROR */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* SUCCESS */}
            {success && (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                {success}
              </div>
            )}

            {/* ACTIONS */}
            <div className="flex flex-col-reverse gap-3 border-t border-[#E5EDF5] pt-6 sm:flex-row sm:justify-end">
              <Link
                href="/admin/assignments"
                className="inline-flex items-center justify-center rounded-xl border border-[#DCEAF8] bg-white px-5 py-3 text-sm font-semibold text-[#172033] transition hover:bg-[#F8FBFF]"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={
                  submitting ||
                  projects.length === 0 ||
                  workers.length === 0
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1259BF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4" />
                    Assign Worker
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
