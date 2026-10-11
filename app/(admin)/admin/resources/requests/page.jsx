
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  LoaderCircle,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

const inputClass =
  "w-full rounded-xl border border-[#DCE4EE] bg-white px-3.5 py-2.5 text-sm text-[#172033] outline-none transition placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:ring-4 focus:ring-blue-50";

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-blue-50 text-blue-700",
  rejected: "bg-red-50 text-red-700",
  fulfilled: "bg-emerald-50 text-emerald-700",
};

function formatDate(value) {
  if (!value) return "—";

  const date = value?.toDate ? value.toDate() : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getWorkerName(worker) {
  if (!worker) return "Unknown worker";

  return (
    worker.name ||
    [worker.firstName, worker.lastName].filter(Boolean).join(" ") ||
    worker.fullName ||
    worker.email ||
    "Worker"
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "pending").toLowerCase();

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        STATUS_STYLES[normalized] || "bg-gray-100 text-gray-700"
      }`}
    >
      {normalized === "fulfilled" ? (
        <CheckCircle2 size={13} />
      ) : normalized === "rejected" ? (
        <XCircle size={13} />
      ) : normalized === "approved" ? (
        <Check size={13} />
      ) : (
        <Clock size={13} />
      )}
      {normalized.charAt(0).toUpperCase() + normalized.slice(1)}
    </span>
  );
}

function StatCard({ label, value, detail, icon: Icon, tone }) {
  const colors = {
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <div className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#667085]">{label}</p>
          <p className="mt-2 text-2xl font-bold text-[#172033]">{value}</p>
          <p className="mt-1 text-xs text-[#98A2B3]">{detail}</p>
        </div>
        <div className={`rounded-xl p-3 ${colors[tone]}`}>
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

export default function AdminResourceRequestsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [requests, setRequests] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [workers, setWorkers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");

  const [issueRequest, setIssueRequest] = useState(null);
  const [issueQuantity, setIssueQuantity] = useState("");
  const [issueReason, setIssueReason] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!user || !isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const unsubRequests = onSnapshot(
      query(
        collection(db, "resourceRequests"),
        orderBy("createdAt", "desc")
      ),
      (snapshot) => {
        setRequests(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
        setLoading(false);
      },
      (err) => {
        console.error("Resource requests listener:", err);
        setError(
          "Could not load resource requests. Check your Firestore rules and collection setup."
        );
        setLoading(false);
      }
    );

    const unsubInventory = onSnapshot(
      collection(db, "resourceInventory"),
      (snapshot) => {
        setInventory(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (err) => console.error("Inventory listener:", err)
    );

    const unsubWorkers = onSnapshot(
      collection(db, "workers"),
      (snapshot) => {
        setWorkers(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (err) => console.error("Workers listener:", err)
    );

    return () => {
      unsubRequests();
      unsubInventory();
      unsubWorkers();
    };
  }, [authLoading, user, isAdmin]);

  const workerMap = useMemo(
    () => new Map(workers.map((worker) => [worker.id, worker])),
    [workers]
  );

  const inventoryMap = useMemo(
    () => new Map(inventory.map((item) => [item.id, item])),
    [inventory]
  );

  const counts = useMemo(() => {
    return {
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      fulfilled: requests.filter((r) => r.status === "fulfilled").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();

    return requests.filter((request) => {
      const workerName = getWorkerName(workerMap.get(request.workerId));
      const resource =
        request.resourceName ||
        inventoryMap.get(request.resourceId)?.name ||
        "";

      const matchesSearch =
        !term ||
        workerName.toLowerCase().includes(term) ||
        resource.toLowerCase().includes(term) ||
        String(request.reason || "").toLowerCase().includes(term) ||
        String(request.projectId || "").toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "all" || request.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [requests, search, statusFilter, workerMap, inventoryMap]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  async function handleDecision(request, decision) {
    clearMessages();

    if (!user || !isAdmin) {
      setError("Only administrators can process resource requests.");
      return;
    }

    if (!["approved", "rejected"].includes(decision)) return;

    if (request.status !== "pending") {
      setError("This request has already been processed.");
      return;
    }

    const resource = inventoryMap.get(request.resourceId);

    if (decision === "approved" && !resource) {
      setError(
        "The requested inventory item could not be found. Check the resource linked to this request."
      );
      return;
    }

    if (
      decision === "approved" &&
      Number(resource.quantity || 0) <= 0
    ) {
      setError(
        "This resource is out of stock. Receive more stock before approving this request."
      );
      return;
    }

    setBusyId(request.id);

    try {
      const requestRef = doc(db, "resourceRequests", request.id);

      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(requestRef);

        if (!snapshot.exists()) {
          throw new Error("This request no longer exists.");
        }

        if (snapshot.data().status !== "pending") {
          throw new Error("This request has already been processed.");
        }

        transaction.update(requestRef, {
          status: decision,
          reviewedBy: user.uid,
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      setSuccess(
        decision === "approved"
          ? "Request approved. Stock has not been deducted; issue the resource when it is handed over."
          : "Resource request rejected."
      );
    } catch (err) {
      console.error("Request decision:", err);
      setError(err.message || "Could not update the request.");
    } finally {
      setBusyId("");
    }
  }

  function openIssueDialog(request) {
    clearMessages();

    const resource = inventoryMap.get(request.resourceId);

    if (!resource) {
      setError("The inventory item linked to this request was not found.");
      return;
    }

    if (request.status !== "approved") {
      setError("Only approved requests can be issued.");
      return;
    }

    if (Number(resource.quantity || 0) <= 0) {
      setError("This resource is currently out of stock.");
      return;
    }

    setIssueRequest(request);
    setIssueQuantity(
      String(
        Math.min(
          Number(request.approvedQuantity ?? request.quantity ?? 0),
          Number(resource.quantity || 0)
        )
      )
    );
    setIssueReason("");
  }

  async function handleIssue(event) {
    event.preventDefault();
    clearMessages();

    if (!user || !isAdmin || !issueRequest) {
      setError("Administrator access is required.");
      return;
    }

    const request = issueRequest;
    const requestedQuantity = Number(issueQuantity);

    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      setError("Enter a valid quantity to issue.");
      return;
    }

    setBusyId(request.id);

    try {
      const requestRef = doc(db, "resourceRequests", request.id);
      const inventoryRef = doc(
        db,
        "resourceInventory",
        request.resourceId
      );
      const transactionRef = doc(collection(db, "resourceTransactions"));

      await runTransaction(db, async (transaction) => {
        // Read all documents before writing.
        const requestSnapshot = await transaction.get(requestRef);
        const inventorySnapshot = await transaction.get(inventoryRef);

        if (!requestSnapshot.exists()) {
          throw new Error("This request no longer exists.");
        }

        if (!inventorySnapshot.exists()) {
          throw new Error("The requested resource no longer exists.");
        }

        const currentRequest = requestSnapshot.data();
        const currentResource = inventorySnapshot.data();

        if (currentRequest.status !== "approved") {
          throw new Error(
            "This request is no longer approved or has already been fulfilled."
          );
        }

        const available = Number(currentResource.quantity || 0);

        if (requestedQuantity > available) {
          throw new Error(
            `Insufficient stock. Only ${available} ${currentResource.unit} are available.`
          );
        }

        const approvedQuantity = Number(
          currentRequest.approvedQuantity ?? currentRequest.quantity ?? 0
        );

        if (
          !Number.isFinite(approvedQuantity) ||
          approvedQuantity <= 0
        ) {
          throw new Error("The approved request quantity is invalid.");
        }

        if (requestedQuantity > approvedQuantity) {
          throw new Error(
            `You can issue up to ${approvedQuantity} ${currentResource.unit} for this request.`
          );
        }

        const worker = workerMap.get(currentRequest.workerId);
        const recipientName = getWorkerName(worker);

        transaction.update(inventoryRef, {
          quantity: available - requestedQuantity,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });

        transaction.update(requestRef, {
          status: "fulfilled",
          issuedQuantity: requestedQuantity,
          issuedBy: user.uid,
          issuedAt: serverTimestamp(),
          issueNotes: issueReason.trim(),
          updatedAt: serverTimestamp(),
        });

        transaction.set(transactionRef, {
          resourceId: request.resourceId,
          resourceName:
            currentResource.name ||
            currentRequest.resourceName ||
            "Resource",
          type: "issued",
          quantity: requestedQuantity,
          unit: currentResource.unit || currentRequest.unit || "units",
          recipientType: "worker",
          recipientName,
          recipientId: currentRequest.workerId,
          requestId: request.id,
          projectId: currentRequest.projectId || "",
          reason:
            issueReason.trim() ||
            currentRequest.reason ||
            "Fulfilment of approved resource request",
          recordedBy: user.uid,
          createdAt: serverTimestamp(),
        });
      });

      setIssueRequest(null);
      setIssueQuantity("");
      setIssueReason("");
      setSuccess(
        "Resource issued successfully. Inventory and transaction history have been updated."
      );
    } catch (err) {
      console.error("Issue resource request:", err);
      setError(err.message || "Could not issue this resource.");
    } finally {
      setBusyId("");
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoaderCircle
          size={32}
          className="animate-spin text-[#1769E0]"
        />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="rounded-2xl border border-[#E5EDF5] bg-white p-8 text-center">
        <ShieldCheck
          size={36}
          className="mx-auto text-[#1769E0]"
        />
        <h2 className="mt-4 text-lg font-bold text-[#172033]">
          Administrator access required
        </h2>
        <p className="mt-2 text-sm text-[#667085]">
          Sign in with an administrator account to manage resource requests.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm text-[#667085]">
            <Package size={16} />
            Administration / Resources / Requests
          </p>

          <h1 className="text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
            Resource requests
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-[#667085]">
            Review employee requests, approve or reject them, and record
            resource handovers against your inventory.
          </p>
        </div>

        <button
          onClick={clearMessages}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[#DCE4EE] bg-white px-4 py-2.5 text-sm font-semibold text-[#344054] hover:bg-[#F8FBFF] sm:self-auto"
        >
          <RefreshCw size={16} />
          Clear messages
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <p className="flex-1">{error}</p>
          <button onClick={() => setError("")}>
            <X size={17} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
          <p className="flex-1">{success}</p>
          <button onClick={() => setSuccess("")}>
            <X size={17} />
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pending requests"
          value={counts.pending}
          detail="Waiting for your decision"
          icon={Clock}
          tone="amber"
        />
        <StatCard
          label="Approved"
          value={counts.approved}
          detail="Waiting to be issued"
          icon={Check}
          tone="blue"
        />
        <StatCard
          label="Fulfilled"
          value={counts.fulfilled}
          detail="Resources handed over"
          icon={CheckCircle2}
          tone="green"
        />
        <StatCard
          label="Rejected"
          value={counts.rejected}
          detail="Requests not approved"
          icon={XCircle}
          tone="red"
        />
      </div>

      {/* Request list */}
      <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
        <div className="grid gap-3 border-b border-[#E5EDF5] p-4 sm:grid-cols-2 sm:p-5">
          <div className="relative">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search worker, resource, project..."
              className={`${inputClass} pl-9`}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={inputClass}
          >
            <option value="pending">Pending requests ({counts.pending})</option>
            <option value="approved">Approved — awaiting issue ({counts.approved})</option>
            <option value="fulfilled">Fulfilled requests ({counts.fulfilled})</option>
            <option value="rejected">Rejected requests ({counts.rejected})</option>
            <option value="all">All requests</option>
          </select>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF4FF] text-[#1769E0]">
              <FileText size={26} />
            </div>
            <h3 className="mt-4 font-semibold text-[#172033]">
              No resource requests found
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#667085]">
              {requests.length
                ? "Try another status or search term."
                : "Worker requests will appear here once they are submitted."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#EEF2F6]">
            {filteredRequests.map((request) => {
              const worker = workerMap.get(request.workerId);
              const resource = inventoryMap.get(request.resourceId);
              const resourceName =
                request.resourceName ||
                resource?.name ||
                "Unknown resource";

              const available = Number(resource?.quantity || 0);
              const requested = Number(request.quantity || 0);
              const approvedQuantity = Number(
                request.approvedQuantity ?? request.quantity ?? 0
              );

              const isBusy = busyId === request.id;

              return (
                <article key={request.id} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-[#172033]">
                          {resourceName}
                        </h3>
                        <StatusBadge status={request.status} />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#667085]">
                        <span className="inline-flex items-center gap-1.5">
                          <UserRound size={15} />
                          {getWorkerName(worker)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock size={15} />
                          {formatDate(request.createdAt)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 rounded-xl bg-[#F8FBFF] p-3 sm:grid-cols-3">
                        <div>
                          <p className="text-xs text-[#98A2B3]">
                            Requested quantity
                          </p>
                          <p className="mt-1 font-semibold text-[#172033]">
                            {requested} {request.unit || resource?.unit || "units"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-[#98A2B3]">
                            Current available stock
                          </p>
                          <p
                            className={`mt-1 font-semibold ${
                              available < requested
                                ? "text-red-600"
                                : "text-[#172033]"
                            }`}
                          >
                            {resource
                              ? `${available} ${resource.unit || request.unit || "units"}`
                              : "Resource unavailable"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-[#98A2B3]">
                            Project reference
                          </p>
                          <p className="mt-1 break-all font-medium text-[#172033]">
                            {request.projectId || "Not specified"}
                          </p>
                        </div>
                      </div>

                      {request.reason && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-[#667085]">
                            Reason for request
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#475467]">
                            {request.reason}
                          </p>
                        </div>
                      )}

                      {request.status === "fulfilled" && (
                        <p className="mt-3 text-sm text-emerald-700">
                          Issued: {request.issuedQuantity ?? requested}{" "}
                          {request.unit || resource?.unit || "units"}
                          {request.issuedAt
                            ? ` · ${formatDate(request.issuedAt)}`
                            : ""}
                        </p>
                      )}

                      {request.status === "rejected" && request.reviewedAt && (
                        <p className="mt-3 text-xs text-[#667085]">
                          Rejected on {formatDate(request.reviewedAt)}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2 xl:max-w-[245px] xl:justify-end">
                      {request.status === "pending" && (
                        <>
                          <button
                            disabled={isBusy}
                            onClick={() => handleDecision(request, "rejected")}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            {isBusy ? (
                              <LoaderCircle size={15} className="animate-spin" />
                            ) : (
                              <XCircle size={15} />
                            )}
                            Reject
                          </button>

                          <button
                            disabled={isBusy || !resource || available <= 0}
                            onClick={() => handleDecision(request, "approved")}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1769E0] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#1258C4] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isBusy ? (
                              <LoaderCircle size={15} className="animate-spin" />
                            ) : (
                              <Check size={15} />
                            )}
                            Approve
                          </button>
                        </>
                      )}

                      {request.status === "approved" && (
                        <button
                          disabled={!resource || available <= 0 || isBusy}
                          onClick={() => openIssueDialog(request)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1258C4] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ArrowDownToLine size={16} />
                          Issue resource
                        </button>
                      )}

                      {request.status === "approved" &&
                        available < approvedQuantity && (
                          <p className="w-full text-xs text-amber-700 xl:text-right">
                            Stock is below the approved quantity. Receive stock
                            or issue a smaller quantity.
                          </p>
                        )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="border-t border-[#E5EDF5] px-5 py-3 text-xs text-[#667085]">
          Showing {filteredRequests.length} of {requests.length} requests
        </div>
      </section>

      {/* Issue confirmation */}
      {issueRequest && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-[#E5EDF5] px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-bold text-[#172033]">
                  Issue resource
                </h2>
                <p className="mt-1 text-sm text-[#667085]">
                  Confirm the quantity actually handed over.
                </p>
              </div>
              <button
                disabled={busyId === issueRequest.id}
                onClick={() => setIssueRequest(null)}
                className="rounded-lg p-2 text-[#667085] hover:bg-[#F2F4F7] disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleIssue} className="space-y-5 p-5 sm:p-6">
              <div className="rounded-xl border border-[#DCEAF8] bg-[#F5FAFF] p-4">
                <p className="text-xs text-[#667085]">Resource</p>
                <p className="mt-1 font-semibold text-[#172033]">
                  {issueRequest.resourceName ||
                    inventoryMap.get(issueRequest.resourceId)?.name ||
                    "Resource"}
                </p>
                <p className="mt-2 text-sm text-[#667085]">
                  Recipient:{" "}
                  {getWorkerName(workerMap.get(issueRequest.workerId))}
                </p>
                <p className="mt-1 text-sm text-[#667085]">
                  Available:{" "}
                  {inventoryMap.get(issueRequest.resourceId)?.quantity ?? 0}{" "}
                  {inventoryMap.get(issueRequest.resourceId)?.unit || "units"}
                </p>
                <p className="mt-1 text-sm text-[#667085]">
                  Approved quantity:{" "}
                  {issueRequest.approvedQuantity ?? issueRequest.quantity}{" "}
                  {issueRequest.unit ||
                    inventoryMap.get(issueRequest.resourceId)?.unit ||
                    "units"}
                </p>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#344054]">
                  Quantity to issue *
                </span>
                <input
                  type="number"
                  required
                  min="0.000001"
                  max={Math.min(
                    Number(
                      issueRequest.approvedQuantity ??
                        issueRequest.quantity ??
                        0
                    ),
                    Number(
                      inventoryMap.get(issueRequest.resourceId)?.quantity || 0
                    )
                  )}
                  step="any"
                  value={issueQuantity}
                  onChange={(event) => setIssueQuantity(event.target.value)}
                  className={inputClass}
                />
                <span className="mt-1 block text-xs text-[#98A2B3]">
                  You may issue less than the approved amount, but not more.
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#344054]">
                  Handover notes (optional)
                </span>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={issueReason}
                  onChange={(event) => setIssueReason(event.target.value)}
                  placeholder="Add details about the handover..."
                  className={inputClass}
                />
              </label>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-[#E5EDF5] pt-4">
                <button
                  type="button"
                  disabled={busyId === issueRequest.id}
                  onClick={() => setIssueRequest(null)}
                  className="rounded-xl border border-[#DCE4EE] px-4 py-2.5 text-sm font-semibold text-[#344054]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyId === issueRequest.id}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1769E0] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busyId === issueRequest.id && (
                    <LoaderCircle size={16} className="animate-spin" />
                  )}
                  Confirm issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
