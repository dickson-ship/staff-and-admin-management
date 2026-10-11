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
  DollarSign,
  FileText,
  Loader2,
  MapPin,
  UserRound,
  XCircle,
} from "lucide-react";

import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

export default function RequestDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const requestId = params?.id;

  const { user, profile, loading: authLoading } = useAuth();

  const [request, setRequest] = useState(null);
  const [worker, setWorker] = useState(null);
  const [project, setProject] = useState(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ---------------------------------------------------------
  // AUTH
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
  // LOAD REQUEST
  // ---------------------------------------------------------
  useEffect(() => {
    if (authLoading || !user || !requestId) {
      return;
    }

    async function loadRequest() {
      try {
        setLoading(true);
        setError("");

        const requestRef = doc(
          db,
          "moneyRequests",
          requestId
        );

        const requestSnapshot = await getDoc(requestRef);

        if (!requestSnapshot.exists()) {
          setError("Request not found.");
          setLoading(false);
          return;
        }

        const requestData = {
          id: requestSnapshot.id,
          ...requestSnapshot.data(),
        };

        setRequest(requestData);

        // -----------------------------------------------------
        // WORKER
        // -----------------------------------------------------
        if (requestData.workerId) {
          const workerRef = doc(
            db,
            "workers",
            requestData.workerId
          );

          const workerSnapshot = await getDoc(workerRef);

          if (workerSnapshot.exists()) {
            setWorker({
              id: workerSnapshot.id,
              ...workerSnapshot.data(),
            });
          }
        }

        // -----------------------------------------------------
        // PROJECT
        // -----------------------------------------------------
        if (requestData.projectId) {
          const projectRef = doc(
            db,
            "projects",
            requestData.projectId
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
        console.error("Error loading request:", err);

        setError(
          err?.message || "Unable to load request."
        );
      } finally {
        setLoading(false);
      }
    }

    loadRequest();
  }, [authLoading, user, requestId]);

  // ---------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------
  function formatAmount(amount) {
    return `GH₵ ${Number(amount || 0).toLocaleString()}`;
  }

  function formatDate(value) {
    if (!value) return "Not available";

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

  function getWorkerName() {
    if (!worker) return "Unknown Worker";

    return (
      worker.name ||
      `${worker.firstName || ""} ${worker.lastName || ""}`.trim() ||
      "Unnamed Worker"
    );
  }

  // ---------------------------------------------------------
  // APPROVE REQUEST
  // ---------------------------------------------------------
  async function approveRequest() {
    if (!request || !user) return;

    if (request.status !== "pending") {
      setError("This request has already been processed.");
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      /*
       * 1. Update request
       */
      await updateDoc(
        doc(db, "moneyRequests", requestId),
        {
          status: "approved",
          approvedBy: user.uid,
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      /*
       * 2. Create expense
       *
       * This records the approved amount as money
       * going out of the company.
       */
      await addDoc(collection(db, "expenses"), {
        type: "worker_request",
        category: request.type || "worker expense",

        amount: Number(request.amount || 0),

        workerId: request.workerId || null,
        projectId: request.projectId || null,

        requestId: requestId,

        description:
          request.reason ||
          `Worker ${request.type || "expense"} request`,

        status: "approved",

        recordedBy: user.uid,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setRequest((previous) => ({
        ...previous,
        status: "approved",
      }));

      setSuccess(
        "Request approved and expense recorded successfully."
      );
    } catch (err) {
      console.error("Error approving request:", err);

      setError(
        err?.message ||
          "Unable to approve this request."
      );
    } finally {
      setActionLoading(false);
    }
  }

  // ---------------------------------------------------------
  // REJECT REQUEST
  // ---------------------------------------------------------
  async function rejectRequest() {
    if (!request || !user) return;

    if (request.status !== "pending") {
      setError("This request has already been processed.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to reject this request?"
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      await updateDoc(
        doc(db, "moneyRequests", requestId),
        {
          status: "rejected",
          rejectedBy: user.uid,
          rejectedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      setRequest((previous) => ({
        ...previous,
        status: "rejected",
      }));

      setSuccess("Request rejected.");
    } catch (err) {
      console.error("Error rejecting request:", err);

      setError(
        err?.message ||
          "Unable to reject this request."
      );
    } finally {
      setActionLoading(false);
    }
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
            Loading request...
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // NOT FOUND
  // ---------------------------------------------------------
  if (!request) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link
          href="/admin/requests"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#667085] hover:text-[#1769E0]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Requests
        </Link>

        <div className="rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <XCircle className="mx-auto h-12 w-12 text-red-500" />

          <h1 className="mt-4 text-xl font-bold text-[#172033]">
            Request Not Found
          </h1>

          <p className="mt-2 text-sm text-[#667085]">
            {error || "This request could not be found."}
          </p>
        </div>
      </div>
    );
  }

  const status = String(
    request.status || "pending"
  ).toLowerCase();

  const workerName = getWorkerName();

  // ---------------------------------------------------------
  // PAGE
  // ---------------------------------------------------------
  return (
    <div className="mx-auto max-w-6xl">
      {/* BACK */}
      <Link
        href="/admin/requests"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#667085] transition hover:text-[#1769E0]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Requests
      </Link>

      {/* HEADER */}
      <div className="mb-8 rounded-3xl border border-[#E5EDF5] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EAF4FF] text-[#1769E0]">
              <DollarSign className="h-7 w-7" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
                  {request.type
                    ? formatStatus(request.type)
                    : "Money Request"}
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
                Request ID:{" "}
                <span className="font-medium text-[#172033]">
                  {request.id}
                </span>
              </p>
            </div>
          </div>

          {/* ACTIONS */}
          {status === "pending" && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={approveRequest}
                disabled={actionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}

                Approve Request
              </button>

              <button
                type="button"
                onClick={rejectRequest}
                disabled={actionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </button>
            </div>
          )}
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

      {/* MAIN */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT */}
        <div className="space-y-6 lg:col-span-2">
          {/* AMOUNT */}
          <section className="rounded-3xl border border-[#DCEAF8] bg-[#F8FBFF] p-6 sm:p-8">
            <p className="text-sm font-medium text-[#667085]">
              Requested Amount
            </p>

            <p className="mt-2 text-4xl font-bold tracking-tight text-[#1769E0]">
              {formatAmount(request.amount)}
            </p>

            <div className="mt-5 flex items-center gap-2 text-sm text-[#667085]">
              <Clock3 className="h-4 w-4" />

              <span>
                Submitted on {formatDate(request.createdAt)}
              </span>
            </div>
          </section>

          {/* REASON */}
          <section className="rounded-3xl border border-[#E5EDF5] bg-white shadow-sm">
            <div className="border-b border-[#E5EDF5] px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-[#1769E0]" />

                <h2 className="font-semibold text-[#172033]">
                  Request Reason
                </h2>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <p className="whitespace-pre-wrap text-sm leading-7 text-[#667085]">
                {request.reason ||
                  "No reason was provided by the worker."}
              </p>
            </div>
          </section>

          {/* WORKER */}
          <section className="rounded-3xl border border-[#E5EDF5] bg-white shadow-sm">
            <div className="border-b border-[#E5EDF5] px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <UserRound className="h-5 w-5 text-[#1769E0]" />

                <h2 className="font-semibold text-[#172033]">
                  Worker
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
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {/* PROJECT */}
          <section className="rounded-3xl border border-[#E5EDF5] bg-white shadow-sm">
            <div className="border-b border-[#E5EDF5] px-5 py-5">
              <div className="flex items-center gap-3">
                <BriefcaseBusiness className="h-5 w-5 text-[#1769E0]" />

                <h2 className="font-semibold text-[#172033]">
                  Project
                </h2>
              </div>
            </div>

            <div className="p-5">
              {project ? (
                <>
                  <h3 className="font-semibold text-[#172033]">
                    {project.name || "Unnamed Project"}
                  </h3>

                  <p className="mt-1 text-sm text-[#667085]">
                    {project.service || "Project"}
                  </p>

                  {project.location && (
                    <div className="mt-4 flex items-start gap-2 text-sm text-[#667085]">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />

                      <span>{project.location}</span>
                    </div>
                  )}

                  <div className="mt-4 rounded-2xl bg-[#F8FBFF] p-4">
                    <p className="text-xs text-[#98A2B3]">
                      Project Value
                    </p>

                    <p className="mt-1 text-lg font-bold text-[#172033]">
                      {formatAmount(project.amount)}
                    </p>
                  </div>

                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-[#DCEAF8] px-4 py-2.5 text-sm font-semibold text-[#1769E0] transition hover:bg-[#F8FBFF]"
                  >
                    View Project
                  </Link>
                </>
              ) : (
                <p className="text-sm text-[#667085]">
                  No project is linked to this request.
                </p>
              )}
            </div>
          </section>

          {/* REQUEST INFO */}
          <section className="rounded-3xl border border-[#E5EDF5] bg-white shadow-sm">
            <div className="border-b border-[#E5EDF5] px-5 py-5">
              <h2 className="font-semibold text-[#172033]">
                Request Information
              </h2>
            </div>

            <div className="space-y-5 p-5">
              <InfoRow
                icon={DollarSign}
                label="Type"
                value={
                  request.type
                    ? formatStatus(request.type)
                    : "Other"
                }
              />

              <InfoRow
                icon={CalendarDays}
                label="Submitted"
                value={formatDate(request.createdAt)}
              />

              <InfoRow
                icon={Clock3}
                label="Status"
                value={formatStatus(status)}
              />

              {request.approvedAt && (
                <InfoRow
                  icon={CheckCircle2}
                  label="Approved"
                  value={formatDate(request.approvedAt)}
                />
              )}

              {request.rejectedAt && (
                <InfoRow
                  icon={XCircle}
                  label="Rejected"
                  value={formatDate(request.rejectedAt)}
                />
              )}
            </div>
          </section>

          {/* EXPENSE NOTICE */}
          {status === "approved" && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />

                <div>
                  <h3 className="font-semibold text-green-800">
                    Expense Recorded
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-green-700">
                    This approved request has been added to the
                    company expenses and will be included in the
                    worker's financial deductions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {status === "rejected" && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

                <div>
                  <h3 className="font-semibold text-red-800">
                    Request Rejected
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-red-700">
                    This request was rejected and will not be
                    included as an approved worker expense.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// INFO ROW
// ---------------------------------------------------------
function InfoRow({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-[#98A2B3]">
          {label}
        </p>

        <p className="mt-1 text-sm font-semibold text-[#172033]">
          {value}
        </p>
      </div>
    </div>
  );
}