"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  Check,
  CheckCircle2,
  Clock3,
  History,
  Package,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Warehouse,
  X,
  XCircle,
  RefreshCw,
} from "lucide-react";

import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

const tabs = [
  { id: "requests", label: "Requests", icon: Clock3 },
  { id: "inventory", label: "Inventory", icon: Warehouse },
  { id: "history", label: "History", icon: History },
];

const emptyResourceForm = {
  name: "",
  category: "Tools",
  unit: "pieces",
  quantity: "0",
  minimumStock: "0",
  unitCost: "0",
  description: "",
};

const emptyIssueForm = {
  resourceId: "",
  quantity: "1",
  recipientType: "worker",
  workerId: "",
  recipientName: "",
  purpose: "",
  notes: "",
};

function getDateValue(value) {
  if (!value) return 0;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDate(value) {
  if (!value) return "—";

  const timestamp = getDateValue(value);

  if (!timestamp) return "—";

  return new Date(timestamp).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function getStatus(request) {
  return String(request.status || request.requestStatus || "pending")
    .trim()
    .toLowerCase();
}

function getResourceName(request) {
  return (
    request.resourceName ||
    request.itemName ||
    request.inventoryName ||
    request.resource ||
    request.item ||
    "Unnamed resource"
  );
}

function getQuantity(request) {
  return Number(
    request.requestedQuantity ??
      request.quantityRequested ??
      request.quantity ??
      0
  );
}

function getWorkerName(request, workers) {
  const savedName =
    request.workerName ||
    request.requesterName ||
    request.staffName ||
    request.fullName;

  if (savedName) return savedName;

  const workerId =
    request.workerId || request.requesterId || request.userId || "";

  const worker = workers.find((item) => item.id === workerId);

  if (!worker) return "Unknown requester";

  return (
    worker.name ||
    worker.fullName ||
    [worker.firstName, worker.lastName].filter(Boolean).join(" ") ||
    worker.email ||
    "Worker"
  );
}

function findInventoryItem(request, inventory) {
  const resourceId =
    request.resourceId ||
    request.inventoryId ||
    request.resourceDocId ||
    request.itemId ||
    "";

  if (resourceId) {
    const matchedItem = inventory.find(
      (resource) => resource.id === resourceId
    );

    if (matchedItem) return matchedItem;
  }

  const requestedName = getResourceName(request).trim().toLowerCase();

  return (
    inventory.find(
      (item) => (item.name || "").trim().toLowerCase() === requestedName
    ) || null
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "pending").toLowerCase();

  const styles = {
    pending: "bg-amber-50 text-amber-700",
    requested: "bg-amber-50 text-amber-700",
    approved: "bg-blue-50 text-blue-700",
    fulfilled: "bg-emerald-50 text-emerald-700",
    completed: "bg-emerald-50 text-emerald-700",
    issued: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-700",
    declined: "bg-red-50 text-red-700",
    cancelled: "bg-slate-100 text-slate-600",
  };

  const label = normalized.replaceAll("_", " ");

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
        styles[normalized] || "bg-slate-100 text-slate-600"
      }`}
    >
      {label}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, note }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>

          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>

          {note && (
            <p className="mt-1 text-xs text-slate-500">{note}</p>
          )}
        </div>

        <div className="rounded-lg bg-blue-50 p-2.5 text-blue-700">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon = Package,
  title,
  description,
}) {
  return (
    <div className="px-5 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <Icon size={23} />
      </div>

      <h3 className="mt-3 text-sm font-semibold text-slate-900">
        {title}
      </h3>

      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>

      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export default function AdminResourcesPage() {
  const { user, profile, authLoading, isAdmin } = useAuth();

  const adminAllowed = Boolean(isAdmin || profile?.role === "admin");

  const [activeTab, setActiveTab] = useState("requests");

  const [inventory, setInventory] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [requestsLoaded, setRequestsLoaded] = useState(false);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [transactionsLoaded, setTransactionsLoaded] = useState(false);

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState("");

  const [showResourceForm, setShowResourceForm] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);

  // A non-null value means the resource modal is editing an existing item.
  const [editingResource, setEditingResource] = useState(null);

  const [resourceForm, setResourceForm] = useState(emptyResourceForm);
  const [issueForm, setIssueForm] = useState(emptyIssueForm);

  // --------------------------------------------------
  // FIRESTORE LISTENERS
  // --------------------------------------------------

  useEffect(() => {
    if (authLoading) return;

    if (!user || !adminAllowed) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribers = [];

    const inventoryUnsubscribe = onSnapshot(
      collection(db, "resourceInventory"),
      (snapshot) => {
        setInventory(
          snapshot.docs
            .map((item) => ({
              id: item.id,
              ...item.data(),
            }))
            .sort((a, b) =>
              String(a.name || "").localeCompare(String(b.name || ""))
            )
        );

        setInventoryLoaded(true);
      },
      (err) => {
        console.error("Inventory listener error:", err);

        setError(
          "Unable to load inventory. Check your Firestore permissions."
        );

        setInventoryLoaded(true);
      }
    );

    const workersUnsubscribe = onSnapshot(
      collection(db, "workers"),
      (snapshot) => {
        setWorkers(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (err) => {
        console.error("Workers listener error:", err);
      }
    );

    const requestsUnsubscribe = onSnapshot(
      collection(db, "resourceRequests"),
      (snapshot) => {
        setRequests(
          snapshot.docs
            .map((item) => ({
              id: item.id,
              ...item.data(),
            }))
            .sort(
              (a, b) =>
                getDateValue(b.createdAt || b.requestedAt) -
                getDateValue(a.createdAt || a.requestedAt)
            )
        );

        setRequestsLoaded(true);
      },
      (err) => {
        console.error("Resource requests listener error:", err);

        setError(
          "Unable to load resource requests. Check your Firestore permissions."
        );

        setRequestsLoaded(true);
      }
    );

    const transactionsUnsubscribe = onSnapshot(
      collection(db, "resourceTransactions"),
      (snapshot) => {
        setTransactions(
          snapshot.docs
            .map((item) => ({
              id: item.id,
              ...item.data(),
            }))
            .sort(
              (a, b) =>
                getDateValue(b.createdAt || b.transactionDate) -
                getDateValue(a.createdAt || a.transactionDate)
            )
        );

        setTransactionsLoaded(true);
      },
      (err) => {
        console.error("Transactions listener error:", err);

        setError("Unable to load transaction history.");

        setTransactionsLoaded(true);
      }
    );

    unsubscribers.push(
      inventoryUnsubscribe,
      workersUnsubscribe,
      requestsUnsubscribe,
      transactionsUnsubscribe
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [authLoading, user, adminAllowed]);

  useEffect(() => {
    if (
      !authLoading &&
      (!user ||
        !adminAllowed ||
        (inventoryLoaded && requestsLoaded && transactionsLoaded))
    ) {
      setLoading(false);
    }
  }, [
    authLoading,
    user,
    adminAllowed,
    inventoryLoaded,
    requestsLoaded,
    transactionsLoaded,
  ]);

  // --------------------------------------------------
  // FILTERED DATA AND SUMMARY
  // --------------------------------------------------

  const pendingRequests = useMemo(
    () =>
      requests.filter((request) =>
        ["pending", "requested"].includes(getStatus(request))
      ),
    [requests]
  );

  const approvedRequests = useMemo(
    () =>
      requests.filter(
        (request) => getStatus(request) === "approved"
      ),
    [requests]
  );

  const lowStockItems = useMemo(
    () =>
      inventory.filter(
        (item) =>
          Number(item.quantity || 0) <=
          Number(item.minimumStock || 0)
      ),
    [inventory]
  );

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return requests;

    return requests.filter((request) =>
      [
        getWorkerName(request, workers),
        getResourceName(request),
        request.reason,
        request.purpose,
        request.description,
        getStatus(request),
      ].some((value) =>
        String(value || "").toLowerCase().includes(term)
      )
    );
  }, [requests, workers, search]);

  const filteredInventory = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return inventory;

    return inventory.filter((item) =>
      [
        item.name,
        item.category,
        item.unit,
        item.description,
      ].some((value) =>
        String(value || "").toLowerCase().includes(term)
      )
    );
  }, [inventory, search]);

  const filteredTransactions = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return transactions;

    return transactions.filter((item) =>
      [
        item.resourceName,
        item.recipientName,
        item.workerName,
        item.action,
        item.type,
        item.purpose,
        item.notes,
      ].some((value) =>
        String(value || "").toLowerCase().includes(term)
      )
    );
  }, [transactions, search]);

  function notifySuccess(message) {
    setSuccess(message);
    setError("");
  }

  function notifyError(message) {
    setError(message);
    setSuccess("");
  }

  function closeFeedback() {
    setError("");
    setSuccess("");
  }

  function adminId() {
    return user?.uid || "";
  }

  // --------------------------------------------------
  // OPEN THE RESOURCE FORM
  // --------------------------------------------------

  function startAddingResource() {
    closeFeedback();
    setEditingResource(null);
    setResourceForm({ ...emptyResourceForm });
    setShowResourceForm(true);
  }

  function startEditingResource(item) {
    closeFeedback();

    setEditingResource(item);

    setResourceForm({
      name: item.name || "",
      category: item.category || "Tools",
      unit: item.unit || "pieces",
      quantity: String(item.quantity ?? 0),
      minimumStock: String(item.minimumStock ?? 0),
      unitCost: String(item.unitCost ?? 0),
      description: item.description || "",
    });

    setShowResourceForm(true);
  }

  function closeResourceForm() {
    setShowResourceForm(false);
    setEditingResource(null);
    setResourceForm({ ...emptyResourceForm });
  }

  // --------------------------------------------------
  // APPROVE OR REJECT A REQUEST
  // --------------------------------------------------

  async function decideRequest(request, nextStatus) {
    if (!["pending", "requested"].includes(getStatus(request))) {
      notifyError("This request has already been reviewed.");
      return;
    }

    setProcessingId(request.id);
    closeFeedback();

    try {
      const requestRef = doc(db, "resourceRequests", request.id);

      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(requestRef);

        if (!snapshot.exists()) {
          throw new Error("This request no longer exists.");
        }

        const current = snapshot.data();

        if (!["pending", "requested"].includes(getStatus(current))) {
          throw new Error("This request has already been reviewed.");
        }

        const updates = {
          status: nextStatus,
          requestStatus: nextStatus,
          reviewedAt: serverTimestamp(),
          reviewedBy: adminId(),
          updatedAt: serverTimestamp(),
        };

        if (nextStatus === "approved") {
          updates.approvedAt = serverTimestamp();
          updates.approvedBy = adminId();
        } else {
          updates.rejectedAt = serverTimestamp();
          updates.rejectedBy = adminId();
        }

        transaction.update(requestRef, updates);
      });

      notifySuccess(
        nextStatus === "approved"
          ? "Request approved. You can now issue the resource."
          : "Resource request rejected."
      );
    } catch (err) {
      console.error("Request review error:", err);
      notifyError(err.message || "Unable to update this request.");
    } finally {
      setProcessingId("");
    }
  }

  // --------------------------------------------------
  // ISSUE AN APPROVED REQUEST
  // --------------------------------------------------

  async function issueApprovedRequest(request) {
    if (getStatus(request) !== "approved") {
      notifyError("Approve this request before issuing the resource.");
      return;
    }

    const item = findInventoryItem(request, inventory);
    const quantity = getQuantity(request);

    if (!item) {
      notifyError(
        `No inventory item matches "${getResourceName(
          request
        )}". Check that the request references the correct resource.`
      );
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      notifyError("The requested quantity is invalid.");
      return;
    }

    setProcessingId(request.id);
    closeFeedback();

    try {
      const requestRef = doc(db, "resourceRequests", request.id);

      const inventoryRef = doc(
        db,
        "resourceInventory",
        item.id
      );

      const transactionRef = doc(
        collection(db, "resourceTransactions")
      );

      await runTransaction(db, async (transaction) => {
        const requestSnapshot = await transaction.get(requestRef);
        const inventorySnapshot = await transaction.get(inventoryRef);

        if (!requestSnapshot.exists()) {
          throw new Error("This request no longer exists.");
        }

        if (!inventorySnapshot.exists()) {
          throw new Error("The inventory item no longer exists.");
        }

        const latestRequest = requestSnapshot.data();
        const latestItem = inventorySnapshot.data();

        if (getStatus(latestRequest) !== "approved") {
          throw new Error(
            "This request is not approved or has already been issued."
          );
        }

        const requestedQuantity = getQuantity(latestRequest);
        const availableQuantity = Number(latestItem.quantity || 0);

        if (
          !Number.isFinite(requestedQuantity) ||
          requestedQuantity <= 0
        ) {
          throw new Error("The requested quantity is invalid.");
        }

        if (availableQuantity < requestedQuantity) {
          throw new Error(
            `Insufficient stock. Only ${availableQuantity} available.`
          );
        }

        const requesterName = getWorkerName(latestRequest, workers);

        const workerId =
          latestRequest.workerId ||
          latestRequest.requesterId ||
          latestRequest.userId ||
          "";

        transaction.update(inventoryRef, {
          quantity: availableQuantity - requestedQuantity,
          updatedAt: serverTimestamp(),
          updatedBy: adminId(),
        });

        transaction.update(requestRef, {
          status: "fulfilled",
          requestStatus: "fulfilled",
          fulfilledAt: serverTimestamp(),
          issuedAt: serverTimestamp(),
          issuedBy: adminId(),
          updatedAt: serverTimestamp(),
          inventoryId: item.id,
          resourceId: item.id,
        });

        transaction.set(transactionRef, {
          resourceId: item.id,
          inventoryId: item.id,
          resourceName: latestItem.name || item.name,
          category: latestItem.category || "General",
          unit: latestItem.unit || "pieces",
          quantity: requestedQuantity,
          type: "issue",
          action: "issued",
          direction: "out",
          recipientType: "worker",
          recipientId: workerId,
          workerId,
          workerName: requesterName,
          recipientName: requesterName,
          requestId: request.id,
          purpose:
            latestRequest.reason ||
            latestRequest.purpose ||
            latestRequest.description ||
            "Approved resource request",
          notes: "Issued from an approved resource request.",
          createdAt: serverTimestamp(),
          createdBy: adminId(),
          source: "resource_request",
        });
      });

      notifySuccess(
        `Resource issued to ${getWorkerName(request, workers)}.`
      );
    } catch (err) {
      console.error("Issue approved resource error:", err);
      notifyError(err.message || "Unable to issue the resource.");
    } finally {
      setProcessingId("");
    }
  }

  // --------------------------------------------------
  // ADD OR EDIT A RESOURCE
  // --------------------------------------------------

  async function saveResource(event) {
    event.preventDefault();

    const name = resourceForm.name.trim();
    const quantity = Number(resourceForm.quantity);
    const minimumStock = Number(resourceForm.minimumStock);
    const unitCost = Number(resourceForm.unitCost);

    if (!name) {
      notifyError("Enter a resource name.");
      return;
    }

    if (
      !Number.isFinite(quantity) ||
      quantity < 0 ||
      !Number.isFinite(minimumStock) ||
      minimumStock < 0 ||
      !Number.isFinite(unitCost) ||
      unitCost < 0
    ) {
      notifyError(
        "Enter valid, non-negative quantity, minimum stock, and cost values."
      );
      return;
    }

    const isEditing = Boolean(editingResource);

    setSaving(true);
    closeFeedback();

    try {
      const resourceRef = isEditing
        ? doc(db, "resourceInventory", editingResource.id)
        : doc(collection(db, "resourceInventory"));

      const transactionRef = doc(
        collection(db, "resourceTransactions")
      );

      await runTransaction(db, async (transaction) => {
        if (isEditing) {
          // Read the latest version so we can record the stock adjustment.
          const resourceSnapshot = await transaction.get(resourceRef);

          if (!resourceSnapshot.exists()) {
            throw new Error("This resource no longer exists.");
          }

          const previousResource = resourceSnapshot.data();
          const previousQuantity = Number(previousResource.quantity || 0);

          transaction.update(resourceRef, {
            name,
            category: resourceForm.category,
            unit: resourceForm.unit,
            quantity,
            minimumStock,
            unitCost,
            description: resourceForm.description.trim(),
            updatedAt: serverTimestamp(),
            updatedBy: adminId(),
          });

          // A quantity change gets its own transaction-history record.
          if (quantity !== previousQuantity) {
            const quantityDifference = Math.abs(
              quantity - previousQuantity
            );

            transaction.set(transactionRef, {
              resourceId: resourceRef.id,
              inventoryId: resourceRef.id,
              resourceName: name,
              category: resourceForm.category,
              unit: resourceForm.unit,
              quantity: quantityDifference,
              type: "adjustment",
              action: "stock_adjustment",
              direction:
                quantity > previousQuantity ? "in" : "out",
              purpose: "Manual inventory quantity adjustment",
              notes: `Available quantity changed from ${previousQuantity} to ${quantity}.`,
              previousQuantity,
              newQuantity: quantity,
              createdAt: serverTimestamp(),
              createdBy: adminId(),
              source: "admin_inventory_edit",
            });
          }
        } else {
          // Create a new inventory resource.
          transaction.set(resourceRef, {
            name,
            category: resourceForm.category,
            unit: resourceForm.unit,
            quantity,
            minimumStock,
            unitCost,
            description: resourceForm.description.trim(),
            trackingType: "quantity",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: adminId(),
            updatedBy: adminId(),
          });

          transaction.set(transactionRef, {
            resourceId: resourceRef.id,
            inventoryId: resourceRef.id,
            resourceName: name,
            category: resourceForm.category,
            unit: resourceForm.unit,
            quantity,
            type: "stock",
            action: "stock_added",
            direction: "in",
            purpose: "Initial inventory entry",
            notes: "Resource added to inventory.",
            createdAt: serverTimestamp(),
            createdBy: adminId(),
            source: "admin_inventory",
          });
        }
      });

      setResourceForm({ ...emptyResourceForm });
      setEditingResource(null);
      setShowResourceForm(false);

      notifySuccess(
        isEditing
          ? `${name} updated successfully.`
          : `${name} added to inventory.`
      );
    } catch (err) {
      console.error("Save resource error:", err);
      notifyError(err.message || "Unable to save this resource.");
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // MANUALLY ISSUE A RESOURCE
  // --------------------------------------------------

  async function issueManually(event) {
    event.preventDefault();

    const item = inventory.find(
      (resource) => resource.id === issueForm.resourceId
    );

    const quantity = Number(issueForm.quantity);

    if (!item) {
      notifyError("Select a resource.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      notifyError("Enter a valid quantity.");
      return;
    }

    let recipientId = "";
    let recipientName = "";

    if (issueForm.recipientType === "worker") {
      const worker = workers.find(
        (person) => person.id === issueForm.workerId
      );

      if (!worker) {
        notifyError("Select a worker.");
        return;
      }

      recipientId = worker.id;

      recipientName =
        worker.name ||
        worker.fullName ||
        [worker.firstName, worker.lastName].filter(Boolean).join(" ") ||
        worker.email ||
        "Worker";
    } else {
      recipientName = issueForm.recipientName.trim();

      if (!recipientName) {
        notifyError("Enter the recipient's name.");
        return;
      }
    }

    if (quantity > Number(item.quantity || 0)) {
      notifyError(
        `Insufficient stock. Only ${item.quantity || 0} available.`
      );
      return;
    }

    setSaving(true);
    closeFeedback();

    try {
      const inventoryRef = doc(
        db,
        "resourceInventory",
        item.id
      );

      const transactionRef = doc(
        collection(db, "resourceTransactions")
      );

      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(inventoryRef);

        if (!snapshot.exists()) {
          throw new Error("The inventory item no longer exists.");
        }

        const current = snapshot.data();
        const available = Number(current.quantity || 0);

        if (available < quantity) {
          throw new Error(
            `Insufficient stock. Only ${available} available.`
          );
        }

        transaction.update(inventoryRef, {
          quantity: available - quantity,
          updatedAt: serverTimestamp(),
          updatedBy: adminId(),
        });

        transaction.set(transactionRef, {
          resourceId: item.id,
          inventoryId: item.id,
          resourceName: current.name || item.name,
          category: current.category || item.category || "General",
          unit: current.unit || item.unit || "pieces",
          quantity,
          type: "issue",
          action: "manually_issued",
          direction: "out",
          recipientType: issueForm.recipientType,
          recipientId,
          workerId:
            issueForm.recipientType === "worker" ? recipientId : "",
          workerName:
            issueForm.recipientType === "worker" ? recipientName : "",
          recipientName,
          purpose: issueForm.purpose.trim() || "Manual resource issue",
          notes: issueForm.notes.trim(),
          createdAt: serverTimestamp(),
          createdBy: adminId(),
          source: "admin_manual_issue",
        });
      });

      setIssueForm({ ...emptyIssueForm });
      setShowIssueForm(false);

      notifySuccess(`Resource issued to ${recipientName}.`);
    } catch (err) {
      console.error("Manual issue error:", err);
      notifyError(err.message || "Unable to issue the resource.");
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // LOADING AND ACCESS STATES
  // --------------------------------------------------

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <RefreshCw
          className="animate-spin text-blue-700"
          size={24}
        />
      </div>
    );
  }

  if (!user || !adminAllowed) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <ShieldCheck
          className="mx-auto text-slate-400"
          size={32}
        />

        <h1 className="mt-3 font-semibold text-slate-900">
          Admin access required
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Sign in with an administrator account to manage resources.
        </p>
      </div>
    );
  }

  // --------------------------------------------------
  // PAGE UI
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50/70 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Page header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
              <Boxes size={17} />
              Operations
            </div>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Resources
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage stock and review resource requests.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                closeFeedback();
                setShowIssueForm(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowDownCircle size={16} />
              Issue resource
            </button>

            <button
              type="button"
              onClick={startAddingResource}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-blue-800"
            >
              <Plus size={16} />
              Add resource
            </button>
          </div>
        </div>

        {/* Feedback messages */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <p className="flex-1">{error}</p>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0"
            />

            <p className="flex-1">{success}</p>

            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Dismiss success"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Overview */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={Clock3}
            label="Pending requests"
            value={pendingRequests.length}
            note="Awaiting review"
          />

          <SummaryCard
            icon={CheckCircle2}
            label="Ready to issue"
            value={approvedRequests.length}
            note="Approved requests"
          />

          <SummaryCard
            icon={Package}
            label="Inventory items"
            value={inventory.length}
            note="Resources tracked"
          />

          <SummaryCard
            icon={AlertTriangle}
            label="Low stock"
            value={lowStockItems.length}
            note="At or below minimum"
          />
        </div>

        {/* Low stock notice */}
        {lowStockItems.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={17} className="shrink-0" />

            <span>
              <strong>Low stock:</strong>{" "}
              {lowStockItems
                .slice(0, 4)
                .map((item) => item.name)
                .join(", ")}

              {lowStockItems.length > 4
                ? ` and ${lowStockItems.length - 4} more`
                : ""}
            </span>
          </div>
        )}

        {/* Tabs and search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveTab(id);
                  setSearch("");
                  closeFeedback();
                }}
                className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                  activeTab === id
                    ? "bg-blue-700 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon size={16} />
                {label}

                {id === "requests" && pendingRequests.length > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs ${
                      activeTab === id
                        ? "bg-white/20 text-white"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {pendingRequests.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                activeTab === "requests"
                  ? "Search requests..."
                  : activeTab === "inventory"
                  ? "Search inventory..."
                  : "Search history..."
              }
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>

        {/* ============================================= */}
        {/* REQUESTS TAB                                  */}
        {/* ============================================= */}

        {activeTab === "requests" && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Resource requests
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Review, approve, and issue requested items.
                </p>
              </div>

              <span className="text-xs text-slate-500">
                {filteredRequests.length} total
              </span>
            </div>

            {!requestsLoaded ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Loading requests...
              </div>
            ) : filteredRequests.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No requests found"
                description="Worker requests will appear here when they are submitted."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredRequests.map((request) => {
                  const status = getStatus(request);
                  const workerName = getWorkerName(request, workers);
                  const item = findInventoryItem(request, inventory);
                  const quantity = getQuantity(request);
                  const canReview = ["pending", "requested"].includes(status);
                  const canIssue = status === "approved";
                  const isProcessing = processingId === request.id;

                  return (
                    <div
                      key={request.id}
                      className="flex flex-col gap-3 px-4 py-4 transition hover:bg-slate-50/70 sm:px-5 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                          <Package size={20} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-slate-900">
                              {getResourceName(request)}
                            </h3>

                            <StatusBadge status={status} />
                          </div>

                          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
                            <UserRound
                              size={14}
                              className="shrink-0 text-slate-400"
                            />

                            {workerName}

                            <span className="text-slate-300">·</span>

                            {quantity}{" "}
                            {request.unit || item?.unit || "units"}
                          </p>

                          {(request.reason ||
                            request.purpose ||
                            request.description) && (
                            <p className="mt-1 max-w-2xl text-sm text-slate-500">
                              {request.reason ||
                                request.purpose ||
                                request.description}
                            </p>
                          )}

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                            <span>
                              Requested{" "}
                              {formatDate(
                                request.createdAt || request.requestedAt
                              )}
                            </span>

                            {item && (
                              <span>
                                Stock available: {item.quantity || 0}{" "}
                                {item.unit || "units"}
                              </span>
                            )}

                            {!item && (
                              <span className="text-amber-700">
                                No matching inventory item
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 pl-0 sm:pl-[52px] lg:pl-0">
                        {canReview && (
                          <>
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() =>
                                decideRequest(request, "approved")
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                            >
                              <Check size={15} />
                              Approve
                            </button>

                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() =>
                                decideRequest(request, "rejected")
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                            >
                              <XCircle size={15} />
                              Reject
                            </button>
                          </>
                        )}

                        {canIssue && (
                          <button
                            type="button"
                            disabled={
                              isProcessing ||
                              !item ||
                              quantity <= 0 ||
                              quantity > Number(item?.quantity || 0)
                            }
                            onClick={() =>
                              issueApprovedRequest(request)
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <ArrowDownCircle size={15} />
                            Issue resource
                          </button>
                        )}

                        {isProcessing && (
                          <RefreshCw
                            size={17}
                            className="animate-spin self-center text-blue-700"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ============================================= */}
        {/* INVENTORY TAB                                 */}
        {/* ============================================= */}

        {activeTab === "inventory" && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Inventory
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  View, edit, and manage available resources.
                </p>
              </div>

              <button
                type="button"
                onClick={startAddingResource}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
              >
                <Plus size={15} />
                Add item
              </button>
            </div>

            {filteredInventory.length === 0 ? (
              <EmptyState
                icon={Warehouse}
                title="No inventory items"
                description="Add a resource to start tracking company stock."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredInventory.map((item) => {
                  const quantity = Number(item.quantity || 0);
                  const minimum = Number(item.minimumStock || 0);
                  const low = quantity <= minimum;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50/70 sm:px-5"
                    >
                      <div className="rounded-lg bg-slate-100 p-2.5 text-slate-600">
                        <Package size={19} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {item.name || "Unnamed resource"}
                        </p>

                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {item.category || "General"}

                          {item.description
                            ? ` · ${item.description}`
                            : ""}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {quantity}{" "}
                          <span className="font-normal text-slate-500">
                            {item.unit || "units"}
                          </span>
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatMoney(item.unitCost)} per unit
                        </p>
                      </div>

                      <div className="hidden min-w-[90px] text-right sm:block">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            low
                              ? "bg-amber-50 text-amber-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {low ? "Low stock" : "In stock"}
                        </span>

                        <p className="mt-1 text-xs text-slate-400">
                          Min. {minimum}
                        </p>
                      </div>

                      <div className="hidden text-right md:block">
                        <p className="text-xs text-slate-500">
                          Total value
                        </p>

                        <p className="text-sm font-medium text-slate-800">
                          {formatMoney(
                            quantity * Number(item.unitCost || 0)
                          )}
                        </p>
                      </div>

                      {/* Edit resource button */}
                      <button
                        type="button"
                        onClick={() => startEditingResource(item)}
                        aria-label={`Edit ${item.name || "resource"}`}
                        title="Edit resource"
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Pencil size={15} />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ============================================= */}
        {/* TRANSACTION HISTORY TAB                       */}
        {/* ============================================= */}

        {activeTab === "history" && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
              <h2 className="font-semibold text-slate-900">
                Transaction history
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                Stock additions, adjustments, and resource issues.
              </p>
            </div>

            {filteredTransactions.length === 0 ? (
              <EmptyState
                icon={History}
                title="No transactions yet"
                description="Resource issues and stock adjustments will appear here."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredTransactions.map((item) => {
                  const action = String(
                    item.action || item.type || ""
                  ).toLowerCase();

                  const incoming =
                    String(item.direction || "").toLowerCase() === "in" ||
                    ["stock", "stock_added", "restock"].includes(action);

                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 px-4 py-3.5 sm:px-5"
                    >
                      <div
                        className={`mt-0.5 rounded-lg p-2 ${
                          incoming
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {incoming ? (
                          <ArrowUpCircle size={19} />
                        ) : (
                          <ArrowDownCircle size={19} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {item.resourceName || "Resource"}
                          </p>

                          <span
                            className={`text-xs font-medium ${
                              incoming
                                ? "text-emerald-700"
                                : "text-blue-700"
                            }`}
                          >
                            {action === "stock_adjustment"
                              ? "Stock adjustment"
                              : item.action ||
                                item.type ||
                                (incoming ? "Stock added" : "Issued")}
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-slate-600">
                          {incoming ? "+" : "−"}
                          {Number(item.quantity || 0)}{" "}
                          {item.unit || "units"}

                          {item.recipientName || item.workerName
                            ? ` · ${item.recipientName || item.workerName}`
                            : ""}
                        </p>

                        {(item.purpose || item.notes) && (
                          <p className="mt-1 text-xs text-slate-500">
                            {item.purpose || item.notes}
                          </p>
                        )}

                        {item.action === "stock_adjustment" &&
                          item.previousQuantity !== undefined &&
                          item.newQuantity !== undefined && (
                            <p className="mt-1 text-xs text-slate-500">
                              Quantity changed from {item.previousQuantity}{" "}
                              to {item.newQuantity}.
                            </p>
                          )}
                      </div>

                      <p className="shrink-0 text-xs text-slate-400">
                        {formatDate(
                          item.createdAt || item.transactionDate
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Footer information */}
        <div className="flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs leading-5 text-blue-900">
          <ShieldCheck
            size={17}
            className="mt-0.5 shrink-0"
          />

          <p>
            <strong>Stock control:</strong> approving a request does not
            change stock. Stock is updated when a resource is issued. Editing
            the available quantity also creates a stock-adjustment record.
          </p>
        </div>
      </div>

      {/* =============================================== */}
      {/* ADD / EDIT RESOURCE MODAL                       */}
      {/* =============================================== */}

      {showResourceForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <div className="my-6 w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">
                  {editingResource ? "Edit resource" : "Add resource"}
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  {editingResource
                    ? "Update this resource and its available stock."
                    : "Enter the resource and starting stock."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeResourceForm}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close resource form"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveResource} className="space-y-4 p-5">
              <FormField label="Resource name *">
                <input
                  required
                  value={resourceForm.name}
                  onChange={(event) =>
                    setResourceForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Electrical cable"
                  className={inputClass}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Category">
                  <select
                    value={resourceForm.category}
                    onChange={(event) =>
                      setResourceForm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option>Tools</option>
                    <option>Electrical Materials</option>
                    <option>Safety Equipment</option>
                    <option>Construction Materials</option>
                    <option>Electronics</option>
                    <option>Office Supplies</option>
                    <option>Vehicles</option>
                    <option>Other</option>
                  </select>
                </FormField>

                <FormField label="Unit">
                  <select
                    value={resourceForm.unit}
                    onChange={(event) =>
                      setResourceForm((current) => ({
                        ...current,
                        unit: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="pieces">Pieces</option>
                    <option value="units">Units</option>
                    <option value="boxes">Boxes</option>
                    <option value="meters">Meters</option>
                    <option value="rolls">Rolls</option>
                    <option value="sets">Sets</option>
                    <option value="pairs">Pairs</option>
                    <option value="litres">Litres</option>
                    <option value="bags">Bags</option>
                  </select>
                </FormField>

                <FormField label="Available quantity *">
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    value={resourceForm.quantity}
                    onChange={(event) =>
                      setResourceForm((current) => ({
                        ...current,
                        quantity: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Minimum stock">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={resourceForm.minimumStock}
                    onChange={(event) =>
                      setResourceForm((current) => ({
                        ...current,
                        minimumStock: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </FormField>

                <div className="col-span-2">
                  <FormField label="Unit cost (GHS)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={resourceForm.unitCost}
                      onChange={(event) =>
                        setResourceForm((current) => ({
                          ...current,
                          unitCost: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </FormField>
                </div>
              </div>

              <FormField label="Description (optional)">
                <textarea
                  rows={2}
                  value={resourceForm.description}
                  onChange={(event) =>
                    setResourceForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Additional details"
                />
              </FormField>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeResourceForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {saving && (
                    <RefreshCw size={15} className="animate-spin" />
                  )}

                  {saving
                    ? "Saving..."
                    : editingResource
                    ? "Save changes"
                    : "Add resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =============================================== */}
      {/* MANUAL ISSUE RESOURCE MODAL                     */}
      {/* =============================================== */}

      {showIssueForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <div className="my-6 w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Issue resource
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Record the recipient and update available stock.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowIssueForm(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close issue form"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={issueManually} className="space-y-4 p-5">
              <FormField label="Resource *">
                <select
                  required
                  value={issueForm.resourceId}
                  onChange={(event) =>
                    setIssueForm((current) => ({
                      ...current,
                      resourceId: event.target.value,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="">Select resource</option>

                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {item.quantity || 0}{" "}
                      {item.unit || "units"} available
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Quantity *">
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="any"
                    value={issueForm.quantity}
                    onChange={(event) =>
                      setIssueForm((current) => ({
                        ...current,
                        quantity: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Recipient type">
                  <select
                    value={issueForm.recipientType}
                    onChange={(event) =>
                      setIssueForm((current) => ({
                        ...current,
                        recipientType: event.target.value,
                        workerId: "",
                        recipientName: "",
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="worker">Company worker</option>
                    <option value="external">Other person</option>
                  </select>
                </FormField>
              </div>

              {issueForm.recipientType === "worker" ? (
                <FormField label="Worker *">
                  <select
                    required
                    value={issueForm.workerId}
                    onChange={(event) =>
                      setIssueForm((current) => ({
                        ...current,
                        workerId: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">Select worker</option>

                    {workers.map((worker) => (
                      <option key={worker.id} value={worker.id}>
                        {worker.name ||
                          worker.fullName ||
                          [worker.firstName, worker.lastName]
                            .filter(Boolean)
                            .join(" ") ||
                          worker.email ||
                          "Worker"}
                      </option>
                    ))}
                  </select>
                </FormField>
              ) : (
                <FormField label="Recipient name *">
                  <input
                    required
                    value={issueForm.recipientName}
                    onChange={(event) =>
                      setIssueForm((current) => ({
                        ...current,
                        recipientName: event.target.value,
                      }))
                    }
                    placeholder="Enter the person's name"
                    className={inputClass}
                  />
                </FormField>
              )}

              <FormField label="Purpose">
                <input
                  value={issueForm.purpose}
                  onChange={(event) =>
                    setIssueForm((current) => ({
                      ...current,
                      purpose: event.target.value,
                    }))
                  }
                  placeholder="e.g. Electrical work at site"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Notes (optional)">
                <textarea
                  rows={2}
                  value={issueForm.notes}
                  onChange={(event) =>
                    setIssueForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Any additional details"
                  className={inputClass}
                />
              </FormField>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowIssueForm(false)}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || inventory.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {saving && (
                    <RefreshCw size={15} className="animate-spin" />
                  )}

                  {saving ? "Recording..." : "Issue resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}