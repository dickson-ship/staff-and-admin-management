"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Edit,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { db } from "@/config/Firebase";

const CATEGORIES = [
  "Electrical Materials",
  "Electronics",
  "Security Equipment",
  "Tools and Equipment",
  "Construction Materials",
  "Safety Equipment",
  "Networking Materials",
  "Other",
];

const EMPTY_FORM = {
  name: "",
  category: "Electrical Materials",
  quantity: "",
  unit: "pieces",
  unitCost: "",
  minStock: "",
  location: "",
  notes: "",
};

const formatMoney = (amount) =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const getStockStatus = (resource) => {
  const quantity = Number(resource.quantity) || 0;
  const minimum = Number(resource.minStock) || 0;

  if (quantity <= 0) {
    return {
      label: "Out of stock",
      className: "bg-red-50 text-red-700",
    };
  }

  if (quantity <= minimum) {
    return {
      label: "Low stock",
      className: "bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "In stock",
    className: "bg-green-50 text-green-700",
  };
};

export default function ResourcesPage() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Listen for real-time changes in Firestore.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "resources"),
      (snapshot) => {
        const items = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setResources(items);
        setLoading(false);
      },
      (err) => {
        console.error("Resources subscription failed:", err);
        setError("Could not load resources. Check your connection and permissions.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Inventory totals.
  const stats = useMemo(() => {
    const totalItems = resources.length;

    const totalQuantity = resources.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0
    );

    const lowStock = resources.filter((item) => {
      const quantity = Number(item.quantity) || 0;
      const minimum = Number(item.minStock) || 0;
      return quantity > 0 && quantity <= minimum;
    }).length;

    const outOfStock = resources.filter(
      (item) => (Number(item.quantity) || 0) <= 0
    ).length;

    const stockValue = resources.reduce(
      (sum, item) =>
        sum +
        (Number(item.quantity) || 0) *
          (Number(item.unitCost) || 0),
      0
    );

    return {
      totalItems,
      totalQuantity,
      lowStock,
      outOfStock,
      stockValue,
    };
  }, [resources]);

  // Search and filter inventory.
  const filteredResources = useMemo(() => {
    return resources
      .filter((item) => {
        const searchText = search.trim().toLowerCase();

        const matchesSearch =
          !searchText ||
          [
            item.name,
            item.category,
            item.location,
            item.notes,
          ].some((value) =>
            String(value || "").toLowerCase().includes(searchText)
          );

        const matchesCategory =
          categoryFilter === "All" ||
          item.category === categoryFilter;

        const quantity = Number(item.quantity) || 0;
        const minimum = Number(item.minStock) || 0;

        let matchesStock = true;

        if (stockFilter === "In stock") {
          matchesStock = quantity > minimum && quantity > 0;
        } else if (stockFilter === "Low stock") {
          matchesStock = quantity > 0 && quantity <= minimum;
        } else if (stockFilter === "Out of stock") {
          matchesStock = quantity <= 0;
        }

        return matchesSearch && matchesCategory && matchesStock;
      })
      .sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );
  }, [resources, search, categoryFilter, stockFilter]);

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEditForm = (resource) => {
    setEditingId(resource.id);
    setForm({
      name: resource.name || "",
      category: resource.category || "Other",
      quantity: String(resource.quantity ?? ""),
      unit: resource.unit || "pieces",
      unitCost: String(resource.unitCost ?? ""),
      minStock: String(resource.minStock ?? ""),
      location: resource.location || "",
      notes: resource.notes || "",
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const quantity = Number(form.quantity);
    const unitCost = Number(form.unitCost);
    const minStock = Number(form.minStock);

    if (!form.name.trim()) {
      setError("Enter the resource name.");
      return;
    }

    if (
      form.quantity === "" ||
      !Number.isFinite(quantity) ||
      quantity < 0
    ) {
      setError("Enter a valid quantity of zero or more.");
      return;
    }

    if (
      form.unitCost === "" ||
      !Number.isFinite(unitCost) ||
      unitCost < 0
    ) {
      setError("Enter a valid unit cost of zero or more.");
      return;
    }

    if (
      form.minStock === "" ||
      !Number.isFinite(minStock) ||
      minStock < 0
    ) {
      setError("Enter a valid minimum stock level.");
      return;
    }

    if (!form.unit.trim()) {
      setError("Enter the measurement unit.");
      return;
    }

    setSaving(true);

    try {
      const resourceData = {
        name: form.name.trim(),
        category: form.category,
        quantity,
        unit: form.unit.trim(),
        unitCost,
        minStock,
        location: form.location.trim(),
        notes: form.notes.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, "resources", editingId), resourceData);
        setSuccess("Resource updated successfully.");
      } else {
        await addDoc(collection(db, "resources"), {
          ...resourceData,
          createdAt: serverTimestamp(),
        });
        setSuccess("Resource added successfully.");
      }

      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      console.error("Saving resource failed:", err);
      setError("Could not save the resource. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (resource) => {
    const confirmed = window.confirm(
      `Delete "${resource.name}" from the inventory? This action cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await deleteDoc(doc(db, "resources", resource.id));
      setSuccess(`${resource.name} was deleted.`);
    } catch (err) {
      console.error("Deleting resource failed:", err);
      setError("Could not delete this resource. Check your permissions.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F8FC] px-4 py-6 text-[#172033] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-7">
        {/* Page heading */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-[#1769E0]">
              Inventory Management
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Resources
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
              Track materials, tools, equipment, and stock levels for your
              construction operations.
            </p>
          </div>

          <button
            onClick={openAddForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1258BE]"
          >
            <Plus size={18} />
            Add Resource
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertTriangle size={19} className="mt-0.5 shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="ml-auto"
              aria-label="Dismiss error"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
          >
            <CheckCircle2 size={19} />
            <span>{success}</span>
            <button
              onClick={() => setSuccess("")}
              className="ml-auto"
              aria-label="Dismiss message"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Resource Types"
            value={stats.totalItems}
            description="Unique inventory records"
            icon={Boxes}
            iconClass="bg-blue-50 text-blue-700"
          />

          <SummaryCard
            title="Units in Stock"
            value={stats.totalQuantity.toLocaleString()}
            description="Combined quantities"
            icon={Package}
            iconClass="bg-indigo-50 text-indigo-700"
          />

          <SummaryCard
            title="Low / Out of Stock"
            value={stats.lowStock + stats.outOfStock}
            description={`${stats.lowStock} low · ${stats.outOfStock} out of stock`}
            icon={AlertTriangle}
            iconClass="bg-amber-50 text-amber-700"
          />

          <SummaryCard
            title="Estimated Stock Value"
            value={formatMoney(stats.stockValue)}
            description="Quantity × recorded unit cost"
            icon={CircleDollarSign}
            iconClass="bg-green-50 text-green-700"
            compact
          />
        </div>

        {/* Stock alerts */}
        {!loading && (stats.lowStock > 0 || stats.outOfStock > 0) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-white p-2 text-amber-700">
                <AlertTriangle size={21} />
              </div>

              <div className="min-w-0">
                <h2 className="font-semibold text-amber-900">
                  Inventory needs attention
                </h2>

                <p className="mt-1 text-sm leading-6 text-amber-800">
                  {stats.outOfStock > 0 &&
                    `${stats.outOfStock} resource type(s) are out of stock. `}
                  {stats.lowStock > 0 &&
                    `${stats.lowStock} resource type(s) have reached their minimum stock level.`}
                </p>

                <button
                  onClick={() => setStockFilter("Low stock")}
                  className="mt-3 text-sm font-semibold text-amber-900 underline underline-offset-4"
                >
                  View low-stock items
                </button>

                {stats.outOfStock > 0 && (
                  <button
                    onClick={() => setStockFilter("Out of stock")}
                    className="ml-4 mt-3 text-sm font-semibold text-amber-900 underline underline-offset-4"
                  >
                    View out-of-stock items
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Inventory table */}
        <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
          <div className="border-b border-[#E5EDF5] p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-lg font-bold">Resource Inventory</h2>
                <p className="mt-1 text-sm text-[#667085]">
                  Manage your materials and equipment records.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search resources..."
                    className="w-full rounded-xl border border-[#DCE5EF] py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#1769E0] focus:ring-2 focus:ring-blue-100 sm:w-56"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="rounded-xl border border-[#DCE5EF] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1769E0]"
                >
                  <option value="All">All categories</option>
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <select
                  value={stockFilter}
                  onChange={(event) => setStockFilter(event.target.value)}
                  className="rounded-xl border border-[#DCE5EF] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1769E0]"
                >
                  <option value="All">All stock levels</option>
                  <option value="In stock">In stock</option>
                  <option value="Low stock">Low stock</option>
                  <option value="Out of stock">Out of stock</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-[#667085]">
              <Loader2 size={22} className="animate-spin text-[#1769E0]" />
              Loading inventory...
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center">
              <div className="rounded-2xl bg-[#EAF4FF] p-4 text-[#1769E0]">
                <Package size={30} />
              </div>

              <h3 className="mt-4 font-semibold">
                {resources.length === 0
                  ? "No resources added yet"
                  : "No matching resources"}
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-6 text-[#667085]">
                {resources.length === 0
                  ? "Start building your inventory by adding your first material or piece of equipment."
                  : "Try changing your search or filters to find a resource."}
              </p>

              {resources.length === 0 && (
                <button
                  onClick={openAddForm}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1769E0] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1258BE]"
                >
                  <Plus size={17} />
                  Add your first resource
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-left">
                  <thead className="bg-[#F8FBFF] text-xs uppercase tracking-wide text-[#667085]">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Resource</th>
                      <th className="px-5 py-4 font-semibold">Category</th>
                      <th className="px-5 py-4 font-semibold">Quantity</th>
                      <th className="px-5 py-4 font-semibold">Unit Cost</th>
                      <th className="px-5 py-4 font-semibold">Stock Value</th>
                      <th className="px-5 py-4 font-semibold">Status</th>
                      <th className="px-5 py-4 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#EDF1F6]">
                    {filteredResources.map((resource) => {
                      const status = getStockStatus(resource);

                      const quantity = Number(resource.quantity) || 0;
                      const unitCost = Number(resource.unitCost) || 0;
                      const stockValue = quantity * unitCost;

                      return (
                        <tr
                          key={resource.id}
                          className="transition hover:bg-[#F8FBFF]"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
                                <Package size={19} />
                              </div>

                              <div className="max-w-52">
                                <p className="font-semibold text-[#172033]">
                                  {resource.name}
                                </p>

                                <p className="mt-1 text-xs text-[#667085]">
                                  {resource.location || "Location not specified"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-sm text-[#475467]">
                            {resource.category || "Other"}
                          </td>

                          <td className="px-5 py-4">
                            <p className="font-semibold">
                              {quantity.toLocaleString()}{" "}
                              <span className="text-sm font-normal text-[#667085]">
                                {resource.unit || "units"}
                              </span>
                            </p>

                            <p className="mt-1 text-xs text-[#667085]">
                              Minimum: {Number(resource.minStock) || 0}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-sm text-[#475467]">
                            {formatMoney(unitCost)}
                          </td>

                          <td className="px-5 py-4 text-sm font-semibold">
                            {formatMoney(stockValue)}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openEditForm(resource)}
                                title="Edit resource"
                                aria-label={`Edit ${resource.name}`}
                                className="rounded-lg border border-[#DCE5EF] p-2 text-[#1769E0] transition hover:bg-[#EAF4FF]"
                              >
                                <Edit size={16} />
                              </button>

                              <button
                                onClick={() => handleDelete(resource)}
                                title="Delete resource"
                                aria-label={`Delete ${resource.name}`}
                                className="rounded-lg border border-red-100 p-2 text-red-600 transition hover:bg-red-50"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-[#E5EDF5] px-5 py-4 text-sm text-[#667085]">
                Showing {filteredResources.length} of {resources.length} resource
                {resources.length === 1 ? "" : "s"}
              </div>
            </>
          )}
        </section>

        {/* Add / Edit form */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 py-8 backdrop-blur-[2px] sm:items-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="resource-form-title"
              className="my-auto w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between border-b border-[#E5EDF5] p-5 sm:p-6">
                <div>
                  <h2
                    id="resource-form-title"
                    className="text-xl font-bold"
                  >
                    {editingId ? "Edit Resource" : "Add New Resource"}
                  </h2>

                  <p className="mt-1 text-sm text-[#667085]">
                    Enter the resource details for your inventory.
                  </p>
                </div>

                <button
                  onClick={closeForm}
                  disabled={saving}
                  aria-label="Close form"
                  className="rounded-lg p-2 text-[#667085] hover:bg-gray-100 disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-5 p-5 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Resource Name" required>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="e.g. Electrical cable"
                      required
                      className={fieldClass}
                    />
                  </FormField>

                  <FormField label="Category" required>
                    <select
                      name="category"
                      value={form.category}
                      onChange={handleChange}
                      required
                      className={fieldClass}
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Quantity in Stock" required>
                    <input
                      type="number"
                      name="quantity"
                      value={form.quantity}
                      onChange={handleChange}
                      min="0"
                      step="any"
                      placeholder="e.g. 100"
                      required
                      className={fieldClass}
                    />
                  </FormField>

                  <FormField label="Unit of Measurement" required>
                    <select
                      name="unit"
                      value={form.unit}
                      onChange={handleChange}
                      required
                      className={fieldClass}
                    >
                      <option value="pieces">Pieces</option>
                      <option value="meters">Meters</option>
                      <option value="rolls">Rolls</option>
                      <option value="boxes">Boxes</option>
                      <option value="sets">Sets</option>
                      <option value="bags">Bags</option>
                      <option value="liters">Liters</option>
                      <option value="kilograms">Kilograms</option>
                      <option value="units">Units</option>
                    </select>
                  </FormField>

                  <FormField label="Cost per Unit (GH₵)" required>
                    <input
                      type="number"
                      name="unitCost"
                      value={form.unitCost}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      placeholder="e.g. 25.00"
                      required
                      className={fieldClass}
                    />
                  </FormField>

                  <FormField label="Minimum Stock Level" required>
                    <input
                      type="number"
                      name="minStock"
                      value={form.minStock}
                      onChange={handleChange}
                      min="0"
                      step="any"
                      placeholder="e.g. 10"
                      required
                      className={fieldClass}
                    />
                  </FormField>

                  <div className="sm:col-span-2">
                    <FormField label="Storage Location">
                      <input
                        name="location"
                        value={form.location}
                        onChange={handleChange}
                        placeholder="e.g. Main store, warehouse"
                        className={fieldClass}
                      />
                    </FormField>
                  </div>

                  <div className="sm:col-span-2">
                    <FormField label="Notes">
                      <textarea
                        name="notes"
                        value={form.notes}
                        onChange={handleChange}
                        rows={3}
                        placeholder="Optional details about this resource..."
                        className={fieldClass}
                      />
                    </FormField>
                  </div>
                </div>

                <div className="rounded-xl bg-[#F5F8FC] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-[#667085]">
                      Estimated value of this stock
                    </span>

                    <span className="text-lg font-bold text-[#1769E0]">
                      {formatMoney(
                        (Number(form.quantity) || 0) *
                          (Number(form.unitCost) || 0)
                      )}
                    </span>
                  </div>
                </div>

                {error && (
                  <p role="alert" className="text-sm text-red-600">
                    {error}
                  </p>
                )}

                <div className="flex flex-col-reverse gap-3 border-t border-[#E5EDF5] pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={saving}
                    className="rounded-xl border border-[#DCE5EF] px-5 py-3 text-sm font-semibold text-[#475467] hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1258BE] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving && (
                      <Loader2 size={17} className="animate-spin" />
                    )}

                    {saving
                      ? "Saving..."
                      : editingId
                      ? "Save Changes"
                      : "Add Resource"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const fieldClass =
  "w-full rounded-xl border border-[#DCE5EF] bg-white px-3.5 py-3 text-sm text-[#172033] outline-none transition placeholder:text-gray-400 focus:border-[#1769E0] focus:ring-2 focus:ring-blue-100";

function FormField({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#344054]">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>

      {children}
    </label>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  iconClass,
  compact = false,
}) {
  return (
    <div className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#667085]">{title}</p>

          <p
            className={`mt-3 break-words font-bold tracking-tight text-[#172033] ${
              compact ? "text-xl sm:text-2xl" : "text-3xl"
            }`}
          >
            {value}
          </p>
        </div>

        <div className={`shrink-0 rounded-xl p-3 ${iconClass}`}>
          <Icon size={22} />
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-[#667085]">
        {description}
      </p>
    </div>
  );
}