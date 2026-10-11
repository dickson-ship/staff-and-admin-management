
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
  serverTimestamp,
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
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";

const inputClass =
  "w-full rounded-xl border border-[#DCE4EE] bg-white px-3.5 py-2.5 text-sm text-[#172033] outline-none transition placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:ring-4 focus:ring-blue-50";

const EMPTY_FORM = {
  resourceId: "",
  quantity: "1",
  projectId: "",
  reason: "",
};

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

function getResourceName(resource) {
  return resource?.name || "Unknown resource";
}

function getWorkerName(profile, user) {
  return (
    profile?.name ||
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    profile?.fullName ||
    user?.displayName ||
    user?.email ||
    "Staff member"
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "pending").toLowerCase();

  const Icon =
    normalized === "fulfilled"
      ? CheckCircle2
      : normalized === "rejected"
      ? XCircle
      : normalized === "approved"
      ? Check
      : Clock;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        STATUS_STYLES[normalized] || "bg-gray-100 text-gray-700"
      }`}
    >
      <Icon size={13} />
      {normalized.charAt(0).toUpperCase() + normalized.slice(1)}
    </span>
  );
}

function StatCard({ label, value, detail, icon: Icon, tone }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <div className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#667085]">{label}</p>
          <p className="mt-2 text-2xl font-bold text-[#172033]">
            {value}
          </p>
          <p className="mt-1 text-xs text-[#98A2B3]">{detail}</p>
        </div>

        <div className={`rounded-xl p-3 ${colors[tone]}`}>
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="px-5 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF4FF] text-[#1769E0]">
        <Icon size={26} />
      </div>
      <h3 className="mt-4 font-semibold text-[#172033]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#667085]">
        {description}
      </p>
    </div>
  );
}

export default function StaffResourcesPage() {
  const { user, profile, loading: authLoading } = useAuth();

  const [inventory, setInventory] = useState([]);
  const [requests, setRequests] = useState([]);
  const [issuedResources, setIssuedResources] = useState([]);

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("requests");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setPageLoading(false);
      return;
    }

    setPageLoading(true);
    setError("");

    let inventoryLoaded = false;
    let requestsLoaded = false;
    let transactionsLoaded = false;

    const finishLoading = () => {
      if (inventoryLoaded && requestsLoaded && transactionsLoaded) {
        setPageLoading(false);
      }
    };

    const handleListenerError = (label, message) => (err) => {
      console.error(`${label} listener:`, err);
      setError(message);
      setPageLoading(false);
    };

    // Company inventory.
    const unsubscribeInventory = onSnapshot(
      collection(db, "resourceInventory"),
      (snapshot) => {
        setInventory(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .filter((item) => item.active !== false)
            .sort((a, b) =>
              String(a.name || "").localeCompare(String(b.name || ""))
            )
        );

        inventoryLoaded = true;
        finishLoading();
      },
      handleListenerError(
        "Resource inventory",
        "Could not load available resources. Please try again."
      )
    );

    // Only this worker's requests.
    const unsubscribeRequests = onSnapshot(
      query(
        collection(db, "resourceRequests"),
        where("workerId", "==", user.uid)
      ),
      (snapshot) => {
        setRequests(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort((a, b) => {
              const aDate = a.createdAt?.toMillis?.() || 0;
              const bDate = b.createdAt?.toMillis?.() || 0;
              return bDate - aDate;
            })
        );

        requestsLoaded = true;
        finishLoading();
      },
      handleListenerError(
        "Resource requests",
        "Could not load your resource requests. Check your Firestore rules."
      )
    );

    // Resources issued to this worker by the admin.
    const unsubscribeTransactions = onSnapshot(
      query(
        collection(db, "resourceTransactions"),
        where("recipientId", "==", user.uid),
        where("type", "==", "issued")
      ),
      (snapshot) => {
        setIssuedResources(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort((a, b) => {
              const aDate = a.createdAt?.toMillis?.() || 0;
              const bDate = b.createdAt?.toMillis?.() || 0;
              return bDate - aDate;
            })
        );

        transactionsLoaded = true;
        finishLoading();
      },
      handleListenerError(
        "Issued resources",
        "Could not load issued resources. Check your Firestore rules and indexes."
      )
    );

    return () => {
      unsubscribeInventory();
      unsubscribeRequests();
      unsubscribeTransactions();
    };
  }, [authLoading, user]);

  const inventoryMap = useMemo(
    () => new Map(inventory.map((item) => [item.id, item])),
    [inventory]
  );

  const counts = useMemo(
    () => ({
      pending: requests.filter((item) => item.status === "pending").length,
      approved: requests.filter((item) => item.status === "approved").length,
      fulfilled: requests.filter((item) => item.status === "fulfilled").length,
      rejected: requests.filter((item) => item.status === "rejected").length,
    }),
    [requests]
  );

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();

    return requests.filter((request) => {
      const resourceName =
        request.resourceName ||
        inventoryMap.get(request.resourceId)?.name ||
        "";

      const matchesSearch =
        !term ||
        resourceName.toLowerCase().includes(term) ||
        String(request.reason || "").toLowerCase().includes(term) ||
        String(request.projectId || "").toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "all" || request.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [requests, search, statusFilter, inventoryMap]);

  const filteredIssued = useMemo(() => {
    const term = search.trim().toLowerCase();

    return issuedResources.filter((item) => {
      const matchesSearch =
        !term ||
        String(item.resourceName || "").toLowerCase().includes(term) ||
        String(item.projectId || "").toLowerCase().includes(term) ||
        String(item.reason || "").toLowerCase().includes(term);

      return matchesSearch;
    });
  }, [issuedResources, search]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function openRequestForm() {
    clearMessages();

    setForm({
      ...EMPTY_FORM,
      resourceId: inventory[0]?.id || "",
    });

    setShowForm(true);
  }

  function closeRequestForm() {
    if (saving) return;
    setShowForm(false);
    setForm(EMPTY_FORM);
    setError("");
  }

  async function handleSubmitRequest(event) {
    event.preventDefault();
    clearMessages();

    if (!user) {
      setError("Please sign in to request resources.");
      return;
    }

    const resource = inventoryMap.get(form.resourceId);
    const quantity = Number(form.quantity);

    if (!resource) {
      setError("Select a valid resource from the inventory.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }

    if (!Number.isFinite(Number(resource.quantity)) || Number(resource.quantity) <= 0) {
      setError("This resource is currently out of stock. Contact your administrator.");
      return;
    }

    if (quantity > Number(resource.quantity)) {
      setError(
        `Only ${resource.quantity} ${resource.unit || "units"} are currently available. Reduce the quantity or contact your administrator.`
      );
      return;
    }

    if (!form.reason.trim()) {
      setError("Explain why you need this resource.");
      return;
    }

    setSaving(true);

    try {
      await addDoc(collection(db, "resourceRequests"), {
        workerId: user.uid,
        workerName: getWorkerName(profile, user),
        resourceId: resource.id,
        resourceName: resource.name || "Resource",
        quantity,
        unit: resource.unit || "units",
        projectId: form.projectId.trim(),
        reason: form.reason.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setShowForm(false);
      setForm(EMPTY_FORM);
      setActiveTab("requests");
      setStatusFilter("all");
      setSearch("");

      setSuccess(
        "Your resource request has been submitted. The administrator will review it."
      );
    } catch (err) {
      console.error("Submit resource request:", err);

      setError(
        "Could not submit your request. Please check your connection and Firestore permissions, then try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || pageLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoaderCircle
          size={32}
          className="animate-spin text-[#1769E0]"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-[#E5EDF5] bg-white p-8 text-center">
        <ShieldCheck size={36} className="mx-auto text-[#1769E0]" />
        <h2 className="mt-4 text-lg font-bold text-[#172033]">
          Sign in required
        </h2>
        <p className="mt-2 text-sm text-[#667085]">
          Sign in to request and view your assigned resources.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm text-[#667085]">
            <Package size={16} />
            Staff / Resources
          </p>

          <h1 className="text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
            My resources
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
            Request materials and equipment for your work, follow your
            requests, and check the resources handed over to you.
          </p>
        </div>

        <button
          onClick={openRequestForm}
          disabled={inventory.length === 0}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-[#1769E0] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1258C4] disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
        >
          <Plus size={18} />
          Request a resource
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <p className="flex-1">{error}</p>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={17} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
          <p className="flex-1">{success}</p>
          <button onClick={() => setSuccess("")} aria-label="Dismiss success">
            <X size={17} />
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pending requests"
          value={counts.pending}
          detail="Awaiting admin review"
          icon={Clock}
          tone="amber"
        />

        <StatCard
          label="Approved"
          value={counts.approved}
          detail="Awaiting handover"
          icon={Check}
          tone="blue"
        />

        <StatCard
          label="Resources received"
          value={counts.fulfilled}
          detail="Requests marked fulfilled"
          icon={CheckCircle2}
          tone="green"
        />

        <StatCard
          label="Items in inventory"
          value={inventory.length}
          detail="Available resource types"
          icon={Package}
          tone="blue"
        />
      </div>

      {/* Main content */}
      <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E5EDF5] px-4 pt-4 sm:px-6">
          <button
            onClick={() => {
              setActiveTab("requests");
              setSearch("");
            }}
            className={`border-b-2 px-3 py-3 text-sm font-semibold ${
              activeTab === "requests"
                ? "border-[#1769E0] text-[#1769E0]"
                : "border-transparent text-[#667085] hover:text-[#172033]"
            }`}
          >
            My requests ({requests.length})
          </button>

          <button
            onClick={() => {
              setActiveTab("issued");
              setSearch("");
            }}
            className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold ${
              activeTab === "issued"
                ? "border-[#1769E0] text-[#1769E0]"
                : "border-transparent text-[#667085] hover:text-[#172033]"
            }`}
          >
            <ArrowDownToLine size={16} />
            Issued to me ({issuedResources.length})
          </button>

          <button
            onClick={() => {
              setActiveTab("catalog");
              setSearch("");
            }}
            className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold ${
              activeTab === "catalog"
                ? "border-[#1769E0] text-[#1769E0]"
                : "border-transparent text-[#667085] hover:text-[#172033]"
            }`}
          >
            <Package size={16} />
            Resource catalog ({inventory.length})
          </button>
        </div>

        {/* Search and filters */}
        <div className="grid gap-3 border-b border-[#E5EDF5] p-4 sm:grid-cols-2 sm:p-5">
          <div className="relative">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                activeTab === "catalog"
                  ? "Search available resources..."
                  : "Search resources or project references..."
              }
              className={`${inputClass} pl-9`}
            />
          </div>

          {activeTab === "requests" ? (
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={inputClass}
            >
              <option value="all">All request statuses</option>
              <option value="pending">Pending ({counts.pending})</option>
              <option value="approved">Approved ({counts.approved})</option>
              <option value="fulfilled">Fulfilled ({counts.fulfilled})</option>
              <option value="rejected">Rejected ({counts.rejected})</option>
            </select>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-[#F8FBFF] px-3.5 py-2.5 text-sm text-[#667085]">
              <RefreshCw size={16} className="shrink-0 text-[#1769E0]" />
              Updates automatically from company inventory
            </div>
          )}
        </div>

        {/* My requests */}
        {activeTab === "requests" && (
          <>
            {filteredRequests.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={
                  requests.length
                    ? "No matching requests"
                    : "You haven't requested any resources"
                }
                description={
                  requests.length
                    ? "Try changing the search term or status filter."
                    : "Submit a request for materials or equipment needed for your work. The administrator will review it."
                }
              />
            ) : (
              <div className="divide-y divide-[#EEF2F6]">
                {filteredRequests.map((request) => {
                  const resource = inventoryMap.get(request.resourceId);

                  return (
                    <article key={request.id} className="p-4 sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-[#172033]">
                              {request.resourceName ||
                                getResourceName(resource)}
                            </h3>
                            <StatusBadge status={request.status} />
                          </div>

                          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#667085]">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock size={14} />
                              Requested {formatDate(request.createdAt)}
                            </span>

                            {request.projectId && (
                              <span className="inline-flex items-center gap-1.5">
                                <FileText size={14} />
                                Project: {request.projectId}
                              </span>
                            )}
                          </div>

                          <div className="mt-4 grid gap-3 rounded-xl bg-[#F8FBFF] p-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs text-[#98A2B3]">
                                Quantity requested
                              </p>
                              <p className="mt-1 font-semibold text-[#172033]">
                                {request.quantity} {request.unit || "units"}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-[#98A2B3]">
                                Current inventory
                              </p>
                              <p className="mt-1 font-semibold text-[#172033]">
                                {resource
                                  ? `${Number(resource.quantity || 0)} ${resource.unit || "units"}`
                                  : "Resource unavailable"}
                              </p>
                            </div>
                          </div>

                          {request.reason && (
                            <div className="mt-3">
                              <p className="text-xs font-semibold text-[#667085]">
                                Your reason
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#475467]">
                                {request.reason}
                              </p>
                            </div>
                          )}

                          {request.status === "approved" && (
                            <p className="mt-3 text-sm text-blue-700">
                              Your request is approved. Please coordinate
                              with the administrator for collection.
                            </p>
                          )}

                          {request.status === "fulfilled" && (
                            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                              <p className="font-semibold">
                                Resource handed over
                              </p>
                              <p className="mt-1">
                                Quantity issued:{" "}
                                {request.issuedQuantity ?? request.quantity}{" "}
                                {request.unit || "units"}
                              </p>
                              {request.issuedAt && (
                                <p className="mt-1 text-xs">
                                  Issued on {formatDate(request.issuedAt)}
                                </p>
                              )}
                              {request.issueNotes && (
                                <p className="mt-2">{request.issueNotes}</p>
                              )}
                            </div>
                          )}

                          {request.status === "rejected" && (
                            <p className="mt-3 text-sm text-red-700">
                              This request was rejected.
                              {request.reviewedAt
                                ? ` Reviewed on ${formatDate(request.reviewedAt)}.`
                                : ""}
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
          </>
        )}

        {/* Issued resources */}
        {activeTab === "issued" && (
          <>
            {filteredIssued.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No issued resources found"
                description={
                  issuedResources.length
                    ? "No issued resources match your search."
                    : "Resources issued and recorded by the administrator will appear here."
                }
              />
            ) : (
              <div className="divide-y divide-[#EEF2F6]">
                {filteredIssued.map((item) => (
                  <article key={item.id} className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
                        <Package size={21} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-bold text-[#172033]">
                            {item.resourceName || "Resource"}
                          </h3>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            Issued
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-[#667085]">
                          {formatDate(item.createdAt)}
                        </p>

                        <div className="mt-3 grid gap-3 rounded-xl bg-[#F8FBFF] p-3 sm:grid-cols-3">
                          <div>
                            <p className="text-xs text-[#98A2B3]">Quantity</p>
                            <p className="mt-1 font-semibold text-[#172033]">
                              {item.quantity} {item.unit || "units"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-[#98A2B3]">Project</p>
                            <p className="mt-1 break-words font-medium text-[#172033]">
                              {item.projectId || "Not specified"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-[#98A2B3]">Recorded by</p>
                            <p className="mt-1 font-medium text-[#172033]">
                              Administrator
                            </p>
                          </div>
                        </div>

                        {item.reason && (
                          <p className="mt-3 text-sm leading-6 text-[#667085]">
                            <span className="font-medium text-[#344054]">
                              Notes:{" "}
                            </span>
                            {item.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {/* Available resource catalog */}
        {activeTab === "catalog" && (
          <>
            {inventory.filter((item) => {
              const term = search.trim().toLowerCase();

              return (
                !term ||
                String(item.name || "").toLowerCase().includes(term) ||
                String(item.category || "").toLowerCase().includes(term) ||
                String(item.description || "").toLowerCase().includes(term)
              );
            }).length === 0 ? (
              <EmptyState
                icon={Package}
                title="No resources found"
                description="Try a different search, or contact the administrator if the resource you need is not listed."
              />
            ) : (
              <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 sm:p-5">
                {inventory
                  .filter((item) => {
                    const term = search.trim().toLowerCase();

                    return (
                      !term ||
                      String(item.name || "").toLowerCase().includes(term) ||
                      String(item.category || "").toLowerCase().includes(term) ||
                      String(item.description || "").toLowerCase().includes(term)
                    );
                  })
                  .map((item) => {
                    const quantity = Number(item.quantity || 0);
                    const lowStock =
                      quantity <= Number(item.minimumStock || 0);

                    return (
                      <article
                        key={item.id}
                        className="rounded-2xl border border-[#E5EDF5] p-4 transition hover:border-[#C7DDF7] hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
                            <Package size={22} />
                          </div>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              quantity <= 0
                                ? "bg-red-50 text-red-700"
                                : lowStock
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {quantity <= 0
                              ? "Out of stock"
                              : lowStock
                              ? "Low stock"
                              : "Available"}
                          </span>
                        </div>

                        <h3 className="mt-4 font-bold text-[#172033]">
                          {item.name}
                        </h3>

                        <p className="mt-1 text-xs font-medium text-[#1769E0]">
                          {item.category || "Other"}
                        </p>

                        <p className="mt-2 min-h-10 text-sm leading-5 text-[#667085]">
                          {item.description || "No description provided."}
                        </p>

                        <div className="mt-4 flex items-end justify-between border-t border-[#EEF2F6] pt-3">
                          <div>
                            <p className="text-xs text-[#98A2B3]">
                              Available quantity
                            </p>
                            <p className="mt-1 text-lg font-bold text-[#172033]">
                              {quantity.toLocaleString()}{" "}
                              <span className="text-xs font-medium text-[#667085]">
                                {item.unit || "units"}
                              </span>
                            </p>
                          </div>

                          <button
                            onClick={() => {
                              setForm({
                                ...EMPTY_FORM,
                                resourceId: item.id,
                              });
                              clearMessages();
                              setShowForm(true);
                            }}
                            disabled={quantity <= 0}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1769E0] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1258C4] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Plus size={14} />
                            Request
                          </button>
                        </div>
                      </article>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </section>

      {/* Request form */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeRequestForm();
          }}
        >
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-[#E5EDF5] px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-bold text-[#172033]">
                  Request a resource
                </h2>
                <p className="mt-1 text-sm text-[#667085]">
                  Tell the administrator what you need for your work.
                </p>
              </div>

              <button
                onClick={closeRequestForm}
                disabled={saving}
                aria-label="Close request form"
                className="rounded-lg p-2 text-[#667085] hover:bg-[#F2F4F7] disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmitRequest}
              className="space-y-5 p-5 sm:p-6"
            >
              <div className="rounded-xl border border-[#DCEAF8] bg-[#F5FAFF] p-4">
                <p className="text-xs text-[#667085]">Requesting as</p>
                <p className="mt-1 font-semibold text-[#172033]">
                  {getWorkerName(profile, user)}
                </p>
                <p className="mt-1 text-xs text-[#667085]">
                  {user.email || ""}
                </p>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#344054]">
                  Resource *
                </span>

                <select
                  required
                  value={form.resourceId}
                  onChange={(event) =>
                    setForm({ ...form, resourceId: event.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">Select a resource</option>
                  {inventory.map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                      disabled={Number(item.quantity || 0) <= 0}
                    >
                      {item.name} — {Number(item.quantity || 0)}{" "}
                      {item.unit || "units"} available
                    </option>
                  ))}
                </select>

                {form.resourceId && inventoryMap.get(form.resourceId) && (
                  <span className="mt-2 block text-xs leading-5 text-[#667085]">
                    {inventoryMap.get(form.resourceId).description ||
                      inventoryMap.get(form.resourceId).category ||
                      "Selected company resource"}
                  </span>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#344054]">
                  Quantity required *
                </span>

                <input
                  required
                  type="number"
                  min="0.000001"
                  step="any"
                  value={form.quantity}
                  onChange={(event) =>
                    setForm({ ...form, quantity: event.target.value })
                  }
                  placeholder="Enter quantity"
                  className={inputClass}
                />

                {form.resourceId && inventoryMap.get(form.resourceId) && (
                  <span className="mt-1.5 block text-xs text-[#667085]">
                    Currently available:{" "}
                    {inventoryMap.get(form.resourceId).quantity}{" "}
                    {inventoryMap.get(form.resourceId).unit || "units"}
                  </span>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#344054]">
                  Project reference (optional)
                </span>
                <input
                  maxLength={150}
                  value={form.projectId}
                  onChange={(event) =>
                    setForm({ ...form, projectId: event.target.value })
                  }
                  placeholder="Enter the project ID or reference"
                  className={inputClass}
                />
                <span className="mt-1 block text-xs text-[#98A2B3]">
                  Use the project reference provided by your administrator.
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#344054]">
                  Reason for request *
                </span>
                <textarea
                  required
                  rows={4}
                  maxLength={1000}
                  value={form.reason}
                  onChange={(event) =>
                    setForm({ ...form, reason: event.target.value })
                  }
                  placeholder="Explain what the resource will be used for..."
                  className={inputClass}
                />
              </label>

              <div className="rounded-xl bg-[#F8FBFF] p-3 text-xs leading-5 text-[#667085]">
                Your request will be sent to the administrator for review.
                Submitting a request does not deduct inventory. Stock is
                updated only when the administrator records the handover.
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle size={17} className="mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-[#E5EDF5] pt-4">
                <button
                  type="button"
                  onClick={closeRequestForm}
                  disabled={saving}
                  className="rounded-xl border border-[#DCE4EE] px-4 py-2.5 text-sm font-semibold text-[#344054] hover:bg-[#F8FBFF] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || inventory.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1258C4] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  {saving ? "Submitting..." : "Submit request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
