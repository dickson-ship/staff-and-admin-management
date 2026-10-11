"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  FileText,
  Loader2,
  WalletCards,
} from "lucide-react";

import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

const requestTypes = [
  {
    value: "transport",
    label: "Transport",
    description: "Transportation to or from a job site.",
  },
  {
    value: "food",
    label: "Food",
    description: "Meals or food expenses while working.",
  },
  {
    value: "accommodation",
    label: "Accommodation",
    description: "Accommodation required for the job.",
  },
  {
    value: "other",
    label: "Other",
    description: "Another necessary work-related expense.",
  },
];

function formatMoney(value) {
  const amount = Number(value || 0);

  return `GH₵ ${amount.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function NewStaffRequestPage() {
  const router = useRouter();

  const { user, loading: authLoading } = useAuth();

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [form, setForm] = useState({
    projectId: "",
    type: "transport",
    amount: "",
    reason: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    async function loadProjects() {
      try {
        setLoadingProjects(true);
        setError("");

        /*
         * Only assignments belonging to this worker.
         */
        const assignmentsQuery = query(
          collection(db, "assignments"),
          where("workerId", "==", user.uid)
        );

        const assignmentSnapshot = await getDocs(
          assignmentsQuery
        );

        const assignments = assignmentSnapshot.docs.map(
          (assignmentDoc) => ({
            id: assignmentDoc.id,
            ...assignmentDoc.data(),
          })
        );

        /*
         * Workers should only request money against projects
         * they are actually assigned to.
         */
        const activeAssignments = assignments.filter(
          (assignment) =>
            assignment.status !== "completed" &&
            assignment.status !== "cancelled"
        );

        const projectIds = [
          ...new Set(
            activeAssignments
              .map((assignment) => assignment.projectId)
              .filter(Boolean)
          ),
        ];

        if (projectIds.length === 0) {
          setProjects([]);
          setLoadingProjects(false);
          return;
        }

        const projectResults = await Promise.all(
          projectIds.map(async (projectId) => {
            try {
              const projectQuery = query(
                collection(db, "projects"),
                where("__name__", "==", projectId)
              );

              const snapshot = await getDocs(projectQuery);

              if (snapshot.empty) {
                return null;
              }

              const projectDoc = snapshot.docs[0];

              return {
                id: projectDoc.id,
                ...projectDoc.data(),
              };
            } catch (projectError) {
              console.error(
                "Error loading project:",
                projectError
              );

              return null;
            }
          })
        );

        const validProjects = projectResults
          .filter(Boolean)
          .sort((a, b) =>
            String(a.name || "").localeCompare(
              String(b.name || "")
            )
          );

        setProjects(validProjects);

        /*
         * If there is only one active project, select it
         * automatically.
         */
        if (validProjects.length === 1) {
          setForm((current) => ({
            ...current,
            projectId: validProjects[0].id,
          }));
        }

        setLoadingProjects(false);
      } catch (loadError) {
        console.error(
          "Error loading staff projects:",
          loadError
        );

        setError(
          "Unable to load your assigned projects."
        );

        setLoadingProjects(false);
      }
    }

    loadProjects();
  }, [user, authLoading]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    if (error) {
      setError("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!user) {
      setError("You must be signed in to submit a request.");
      return;
    }

    setError("");

    const amount = Number(form.amount);

    if (!form.projectId) {
      setError("Please select the project this request is for.");
      return;
    }

    if (!form.type) {
      setError("Please select a request type.");
      return;
    }

    if (!form.amount || Number.isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }

    if (amount > 1000000) {
      setError("Please enter a reasonable request amount.");
      return;
    }

    if (!form.reason.trim()) {
      setError("Please explain why you need the money.");
      return;
    }

    if (form.reason.trim().length < 5) {
      setError("Please provide a little more detail about the request.");
      return;
    }

    try {
      setSubmitting(true);

      /*
       * Before creating the request, verify that the selected
       * project is actually assigned to this worker.
       */
      const assignmentsQuery = query(
        collection(db, "assignments"),
        where("workerId", "==", user.uid),
        where("projectId", "==", form.projectId)
      );

      const assignmentSnapshot = await getDocs(
        assignmentsQuery
      );

      const validAssignment =
        assignmentSnapshot.docs.find((assignmentDoc) => {
          const data = assignmentDoc.data();

          return (
            data.status !== "completed" &&
            data.status !== "cancelled"
          );
        });

      if (!validAssignment) {
        setError(
          "You are not currently assigned to the selected project."
        );

        setSubmitting(false);
        return;
      }

      const selectedProject = projects.find(
        (project) => project.id === form.projectId
      );

      await addDoc(collection(db, "moneyRequests"), {
        workerId: user.uid,
        projectId: form.projectId,
        type: form.type,
        amount,
        reason: form.reason.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
        assignmentId: validAssignment.id,
      });

      setSuccess(true);

      /*
       * Give the worker a moment to see confirmation,
       * then return to their requests.
       */
      setTimeout(() => {
        router.push("/staff/requests");
      }, 900);
    } catch (submitError) {
      console.error(
        "Error creating money request:",
        submitError
      );

      setError(
        "Unable to submit your request. Please try again."
      );

      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#1769E0]" />
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
            Please sign in to submit a request.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* BACK */}
      <Link
        href="/staff/requests"
        className="inline-flex items-center gap-2 text-sm font-medium text-[#667085] transition hover:text-[#1769E0]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Requests
      </Link>

      {/* HEADER */}
      <div>
        <p className="text-sm font-medium text-[#1769E0]">
          Staff Portal
        </p>

        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
          Request Money
        </h1>

        <p className="mt-2 text-sm leading-6 text-[#667085] sm:text-base">
          Submit a request for a necessary work-related expense.
        </p>
      </div>

      {/* SUCCESS */}
      {success && (
        <div className="flex items-start gap-3 rounded-2xl border border-green-100 bg-green-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />

          <div>
            <p className="text-sm font-semibold text-green-800">
              Request submitted successfully
            </p>

            <p className="mt-1 text-sm text-green-700">
              Your request has been sent to the administrator for
              review.
            </p>
          </div>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

          <div>
            <p className="text-sm font-semibold text-red-800">
              Unable to submit request
            </p>

            <p className="mt-1 text-sm text-red-700">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* FORM */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm sm:p-7"
      >
        {/* PROJECT */}
        <div>
          <label
            htmlFor="project"
            className="block text-sm font-semibold text-[#172033]"
          >
            Project
          </label>

          <p className="mt-1 text-xs text-[#667085]">
            Select the job this expense is related to.
          </p>

          <div className="relative mt-3">
            <BriefcaseIcon />

            <select
              id="project"
              value={form.projectId}
              onChange={(event) =>
                updateField(
                  "projectId",
                  event.target.value
                )
              }
              disabled={
                loadingProjects ||
                submitting ||
                projects.length === 0
              }
              className="h-12 w-full appearance-none rounded-xl border border-[#DCEAF8] bg-[#F8FBFF] pl-11 pr-10 text-sm text-[#172033] outline-none transition focus:border-[#1769E0] focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">
                {loadingProjects
                  ? "Loading your projects..."
                  : projects.length === 0
                  ? "No active projects available"
                  : "Select a project"}
              </option>

              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name || "Unnamed Project"}
                  {project.location
                    ? ` — ${project.location}`
                    : ""}
                </option>
              ))}
            </select>

            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
          </div>

          {!loadingProjects && projects.length === 0 && (
            <p className="mt-2 text-xs text-amber-600">
              You currently have no active project assignments.
            </p>
          )}
        </div>

        {/* REQUEST TYPE */}
        <div className="mt-7">
          <label className="block text-sm font-semibold text-[#172033]">
            Request type
          </label>

          <p className="mt-1 text-xs text-[#667085]">
            What do you need money for?
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {requestTypes.map((type) => {
              const selected = form.type === type.value;

              return (
                <button
                  key={type.value}
                  type="button"
                  disabled={submitting}
                  onClick={() =>
                    updateField("type", type.value)
                  }
                  className={`rounded-xl border p-4 text-left transition ${
                    selected
                      ? "border-[#1769E0] bg-[#EAF4FF] ring-2 ring-blue-100"
                      : "border-[#E5EDF5] bg-white hover:border-[#BFD8F7] hover:bg-[#F8FBFF]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p
                        className={`text-sm font-semibold ${
                          selected
                            ? "text-[#1769E0]"
                            : "text-[#172033]"
                        }`}
                      >
                        {type.label}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-[#667085]">
                        {type.description}
                      </p>
                    </div>

                    {selected && (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-[#1769E0]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* AMOUNT */}
        <div className="mt-7">
          <label
            htmlFor="amount"
            className="block text-sm font-semibold text-[#172033]"
          >
            Amount
          </label>

          <p className="mt-1 text-xs text-[#667085]">
            Enter the amount you need in Ghana cedis.
          </p>

          <div className="relative mt-3">
            <DollarSign className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98A2B3]" />

            <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm font-medium text-[#667085]">
              GH₵
            </span>

            <input
              id="amount"
              type="number"
              min="1"
              step="0.01"
              value={form.amount}
              onChange={(event) =>
                updateField("amount", event.target.value)
              }
              disabled={submitting}
              placeholder="0.00"
              className="h-12 w-full rounded-xl border border-[#DCEAF8] bg-[#F8FBFF] pl-20 pr-4 text-sm font-medium text-[#172033] outline-none transition focus:border-[#1769E0] focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {form.amount && Number(form.amount) > 0 && (
            <p className="mt-2 text-xs font-medium text-[#667085]">
              Requested: {formatMoney(form.amount)}
            </p>
          )}
        </div>

        {/* REASON */}
        <div className="mt-7">
          <label
            htmlFor="reason"
            className="block text-sm font-semibold text-[#172033]"
          >
            Reason
          </label>

          <p className="mt-1 text-xs text-[#667085]">
            Explain why this money is needed.
          </p>

          <div className="relative mt-3">
            <FileText className="absolute left-3 top-3.5 h-5 w-5 text-[#98A2B3]" />

            <textarea
              id="reason"
              rows={5}
              value={form.reason}
              onChange={(event) =>
                updateField("reason", event.target.value)
              }
              disabled={submitting}
              placeholder="Example: I need transport money to travel to the project site tomorrow."
              className="w-full resize-none rounded-xl border border-[#DCEAF8] bg-[#F8FBFF] py-3 pl-11 pr-4 text-sm leading-6 text-[#172033] outline-none transition placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <p className="mt-2 text-xs text-[#98A2B3]">
            Be clear and specific so the administrator can review
            your request quickly.
          </p>
        </div>

        {/* NOTICE */}
        <div className="mt-7 flex gap-3 rounded-xl border border-blue-100 bg-[#F5FAFF] p-4">
          <WalletCards className="mt-0.5 h-5 w-5 shrink-0 text-[#1769E0]" />

          <div>
            <p className="text-sm font-semibold text-[#172033]">
              Request review
            </p>

            <p className="mt-1 text-xs leading-5 text-[#667085]">
              Your request will remain pending until an
              administrator reviews it. Approved requests will be
              recorded as a work expense.
            </p>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#EEF3F8] pt-6 sm:flex-row sm:justify-end">
          <Link
            href="/staff/requests"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[#DCEAF8] px-5 text-sm font-semibold text-[#667085] transition hover:bg-[#F8FBFF]"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={
              submitting ||
              loadingProjects ||
              projects.length === 0
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1259C2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <WalletCards className="h-4 w-4" />
                Submit Request
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function BriefcaseIcon() {
  return (
    <svg
      className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98A2B3]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="14" x="2" y="7" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}