"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  MapPin,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

function formatDate(timestamp) {
  if (!timestamp) return "—";

  try {
    if (timestamp?.toDate) {
      return timestamp.toDate().toLocaleString("en-GH", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    return new Date(timestamp).toLocaleString("en-GH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatMoney(amount) {
  return `GH₵ ${Number(amount || 0).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const typeLabels = {
  transport: "Transport",
  food: "Food",
  accommodation: "Accommodation",
  other: "Other",
};

const typeStyles = {
  transport: "bg-blue-50 text-blue-700 border-blue-100",
  food: "bg-orange-50 text-orange-700 border-orange-100",
  accommodation: "bg-purple-50 text-purple-700 border-purple-100",
  other: "bg-gray-50 text-gray-700 border-gray-200",
};

const statusStyles = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  paid: "bg-blue-50 text-blue-700 border-blue-200",
};

function StatusIcon({ status }) {
  if (status === "approved") {
    return <CheckCircle2 className="h-5 w-5" />;
  }

  if (status === "rejected") {
    return <XCircle className="h-5 w-5" />;
  }

  if (status === "paid") {
    return <Banknote className="h-5 w-5" />;
  }

  return <Clock3 className="h-5 w-5" />;
}

export default function StaffRequestDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params?.id;

  const { user, profile, loading: authLoading } = useAuth();

  const [request, setRequest] = useState(null);
  const [project, setProject] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (profile && profile.role !== "staff") {
      router.replace("/admin");
      return;
    }

    if (!requestId) return;

    async function loadRequest() {
      try {
        setLoading(true);
        setError("");

        const requestRef = doc(db, "moneyRequests", requestId);
        const requestSnap = await getDoc(requestRef);

        if (!requestSnap.exists()) {
          setError("This request could not be found.");
          return;
        }

        const requestData = {
          id: requestSnap.id,
          ...requestSnap.data(),
        };

        // Security check at the UI level.
        // Firestore rules should also enforce this.
        if (requestData.workerId !== user.uid) {
          setError("You do not have permission to view this request.");
          return;
        }

        setRequest(requestData);

        if (requestData.projectId) {
          const projectRef = doc(db, "projects", requestData.projectId);
          const projectSnap = await getDoc(projectRef);

          if (projectSnap.exists()) {
            setProject({
              id: projectSnap.id,
              ...projectSnap.data(),
            });
          }
        }
      } catch (err) {
        console.error("Error loading request:", err);
        setError("Unable to load this request. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadRequest();
  }, [user, profile, authLoading, requestId, router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[#667085]">
          <Loader2 className="h-8 w-8 animate-spin text-[#1769E0]" />
          <p className="text-sm">Loading request...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link
          href="/staff/requests"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#1769E0] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Requests
        </Link>

        <div className="rounded-2xl border border-red-100 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

            <div>
              <h2 className="font-semibold text-red-800">
                Unable to open request
              </h2>

              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!request) {
    return null;
  }

  const requestType = request.type || "other";
  const status = request.status || "pending";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* BACK */}
      <Link
        href="/staff/requests"
        className="inline-flex items-center gap-2 text-sm font-medium text-[#667085] transition hover:text-[#1769E0]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Requests
      </Link>

      {/* HEADER */}
      <div className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                  typeStyles[requestType] ||
                  "border-gray-200 bg-gray-50 text-gray-700"
                }`}
              >
                {typeLabels[requestType] || "Other"}
              </span>

              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                  statusStyles[status] ||
                  "border-gray-200 bg-gray-50 text-gray-700"
                }`}
              >
                <StatusIcon status={status} />
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>

            <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
              Money Request
            </h1>

            <p className="mt-1 text-sm text-[#667085]">
              Request ID: {request.id}
            </p>
          </div>

          <div className="rounded-xl bg-[#F5FAFF] px-5 py-4 sm:min-w-[190px]">
            <p className="text-xs font-medium text-[#667085]">
              Requested Amount
            </p>

            <p className="mt-1 text-2xl font-bold text-[#1769E0]">
              {formatMoney(request.amount)}
            </p>
          </div>
        </div>
      </div>

      {/* STATUS MESSAGE */}
      {status === "pending" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

            <div>
              <h2 className="font-semibold text-amber-800">
                Awaiting admin review
              </h2>

              <p className="mt-1 text-sm leading-6 text-amber-700">
                Your request has been submitted successfully and is waiting
                for the admin to review it.
              </p>
            </div>
          </div>
        </div>
      )}

      {status === "approved" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

            <div>
              <h2 className="font-semibold text-emerald-800">
                Request approved
              </h2>

              <p className="mt-1 text-sm leading-6 text-emerald-700">
                Your request has been approved by the admin.
              </p>

              {request.approvedAt && (
                <p className="mt-2 text-xs text-emerald-700">
                  Approved: {formatDate(request.approvedAt)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {status === "rejected" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

            <div>
              <h2 className="font-semibold text-red-800">
                Request rejected
              </h2>

              <p className="mt-1 text-sm leading-6 text-red-700">
                This request was not approved by the admin.
              </p>

              {request.rejectionReason && (
                <div className="mt-3 rounded-lg border border-red-100 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                    Reason
                  </p>

                  <p className="mt-1 text-sm text-[#172033]">
                    {request.rejectionReason}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {status === "paid" && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

            <div>
              <h2 className="font-semibold text-blue-800">
                Request paid
              </h2>

              <p className="mt-1 text-sm leading-6 text-blue-700">
                The requested amount has been recorded as paid.
              </p>

              {request.paidAt && (
                <p className="mt-2 text-xs text-blue-700">
                  Paid: {formatDate(request.paidAt)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REQUEST DETAILS */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
              <FileText className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-semibold text-[#172033]">
                Request Details
              </h2>

              <p className="text-xs text-[#667085]">
                Information submitted with your request
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <p className="text-xs font-medium text-[#667085]">
                Request Type
              </p>

              <p className="mt-1 font-medium text-[#172033]">
                {typeLabels[requestType] || "Other"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-[#667085]">
                Amount
              </p>

              <p className="mt-1 text-lg font-bold text-[#172033]">
                {formatMoney(request.amount)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-[#667085]">
                Reason
              </p>

              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#172033]">
                {request.reason || "No reason provided."}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-[#667085]">
                Submitted
              </p>

              <div className="mt-1 flex items-center gap-2 text-sm text-[#172033]">
                <CalendarDays className="h-4 w-4 text-[#667085]" />
                {formatDate(request.createdAt)}
              </div>
            </div>
          </div>
        </section>

        {/* PROJECT */}
        <section className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
              <MapPin className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-semibold text-[#172033]">
                Project
              </h2>

              <p className="text-xs text-[#667085]">
                Project associated with this request
              </p>
            </div>
          </div>

          {project ? (
            <div className="mt-6 space-y-5">
              <div>
                <p className="text-xs font-medium text-[#667085]">
                  Project Name
                </p>

                <p className="mt-1 font-semibold text-[#172033]">
                  {project.name || project.service || "Unnamed Project"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-[#667085]">
                  Service
                </p>

                <p className="mt-1 text-sm text-[#172033]">
                  {project.service || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-[#667085]">
                  Location
                </p>

                <p className="mt-1 text-sm text-[#172033]">
                  {project.location || "—"}
                </p>
              </div>

              <Link
                href={`/staff/jobs`}
                className="inline-flex items-center text-sm font-semibold text-[#1769E0] hover:underline"
              >
                View My Jobs
              </Link>
            </div>
          ) : (
            <div className="mt-6 rounded-xl bg-[#F8FBFF] p-4">
              <p className="text-sm text-[#667085]">
                The project associated with this request could not be
                loaded.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* REQUEST TIMELINE */}
      <section className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
            <Clock3 className="h-5 w-5" />
          </div>

          <div>
            <h2 className="font-semibold text-[#172033]">
              Request Timeline
            </h2>

            <p className="text-xs text-[#667085]">
              Current progress of your request
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {/* SUBMITTED */}
          <div className="flex gap-4">
            <div className="relative flex flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1769E0] text-white">
                <CheckCircle2 className="h-4 w-4" />
              </div>

              {status !== "pending" && (
                <div className="absolute top-8 h-12 w-px bg-[#DCEAF8]" />
              )}
            </div>

            <div className="pb-2">
              <p className="font-medium text-[#172033]">
                Request submitted
              </p>

              <p className="mt-1 text-sm text-[#667085]">
                {formatDate(request.createdAt)}
              </p>
            </div>
          </div>

          {/* APPROVED */}
          {(status === "approved" || status === "paid") && (
            <div className="flex gap-4">
              <div className="relative flex flex-col items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <CheckCircle2 className="h-4 w-4" />
                </div>

                {status === "paid" && (
                  <div className="absolute top-8 h-12 w-px bg-[#DCEAF8]" />
                )}
              </div>

              <div className="pb-2">
                <p className="font-medium text-[#172033]">
                  Request approved
                </p>

                <p className="mt-1 text-sm text-[#667085]">
                  {formatDate(request.approvedAt)}
                </p>
              </div>
            </div>
          )}

          {/* PAID */}
          {status === "paid" && (
            <div className="flex gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1769E0] text-white">
                <Banknote className="h-4 w-4" />
              </div>

              <div>
                <p className="font-medium text-[#172033]">
                  Payment recorded
                </p>

                <p className="mt-1 text-sm text-[#667085]">
                  {formatDate(request.paidAt)}
                </p>
              </div>
            </div>
          )}

          {/* REJECTED */}
          {status === "rejected" && (
            <div className="flex gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white">
                <XCircle className="h-4 w-4" />
              </div>

              <div>
                <p className="font-medium text-[#172033]">
                  Request rejected
                </p>

                <p className="mt-1 text-sm text-[#667085]">
                  {formatDate(request.rejectedAt)}
                </p>
              </div>
            </div>
          )}

          {/* PENDING */}
          {status === "pending" && (
            <div className="flex gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-50 text-amber-600">
                <Clock3 className="h-4 w-4" />
              </div>

              <div>
                <p className="font-medium text-[#172033]">
                  Waiting for admin review
                </p>

                <p className="mt-1 text-sm text-[#667085]">
                  Your request is currently pending.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* FOOTER ACTION */}
      <div className="flex justify-start">
        <Link
          href="/staff/requests"
          className="inline-flex items-center justify-center rounded-xl border border-[#DCEAF8] bg-white px-5 py-3 text-sm font-semibold text-[#172033] shadow-sm transition hover:bg-[#F8FBFF]"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to My Requests
        </Link>
      </div>
    </div>
  );
}