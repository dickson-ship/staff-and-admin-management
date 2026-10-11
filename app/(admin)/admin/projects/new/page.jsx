"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  MapPin,
  UserRound,
  X,
} from "lucide-react";

import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

const inputClass =
  "w-full rounded-xl border border-[#DCEAF8] bg-white px-3.5 py-2.5 text-sm text-[#172033] outline-none transition placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:ring-2 focus:ring-[#EAF4FF]";

function getCustomerName(lead) {
  return (
    lead.name ||
    [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() ||
    lead.fullName ||
    lead.company ||
    "Unnamed customer"
  );
}

function getLeadBudget(budget) {
  if (typeof budget === "number" && Number.isFinite(budget)) {
    return String(budget);
  }

  if (!budget) return "";

  const text = String(budget).trim();

  // Only prefill the amount when the budget contains one clear number.
  // A range such as "5000 - 10000" should be reviewed by the admin.
  const matches = text.match(/\d[\d,]*(?:\.\d+)?/g);

  if (!matches || matches.length !== 1) return "";

  const parsed = Number(matches[0].replaceAll(",", ""));

  return Number.isFinite(parsed) ? String(parsed) : "";
}

function dateInputValue(value) {
  if (!value) return "";

  let date;

  if (typeof value?.toDate === "function") {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else {
    const stringValue = String(value);

    if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
      return stringValue;
    }

    date = new Date(stringValue);
  }

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function PageMessage({ type = "error", message, onClose }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
        type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      <p className="flex-1">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss message"
      >
        <X size={17} />
      </button>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#344054]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-xs leading-5 text-[#667085]">
          {hint}
        </span>
      )}
    </label>
  );
}

export default function NewProjectPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedLeadId, setSelectedLeadId] = useState("");

  const [form, setForm] = useState({
    name: "",
    service: "",
    location: "",
    description: "",
    amount: "",
    deadline: "",
    status: "Planning",
    notes: "",
  });

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (profile?.role && profile.role !== "admin") {
      router.replace("/staff");
    }
  }, [user, profile?.role, authLoading, router]);

  useEffect(() => {
    if (authLoading || !user || profile?.role !== "admin") return;

    const unsubscribe = onSnapshot(
      collection(db, "leads"),
      (snapshot) => {
        const items = snapshot.docs.map((leadDoc) => ({
          id: leadDoc.id,
          ...leadDoc.data(),
        }));

        items.sort((a, b) => {
          const getTime = (value) =>
            value?.toMillis?.() ||
            (value ? new Date(value).getTime() : 0) ||
            0;

          return getTime(b.createdAt) - getTime(a.createdAt);
        });

        setLeads(items);
        setLeadsLoading(false);
      },
      (listenerError) => {
        console.error("Load project leads error:", listenerError);
        setError(
          "Unable to load CRM leads. Check your Firestore permissions."
        );
        setLeadsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authLoading, user, profile?.role]);

  const availableLeads = useMemo(
    () =>
      leads.filter(
        (lead) =>
          !["converted", "lost"].includes(
            String(lead.status || "").toLowerCase()
          )
      ),
    [leads]
  );

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) || null,
    [leads, selectedLeadId]
  );

  function handleLeadChange(leadId) {
    setSelectedLeadId(leadId);
    setError("");
    setNotice("");

    const lead = leads.find((item) => item.id === leadId);

    if (!lead) {
      setForm({
        name: "",
        service: "",
        location: "",
        description: "",
        amount: "",
        deadline: "",
        status: "Planning",
        notes: "",
      });

      return;
    }

    const customerName = getCustomerName(lead);
    const service = lead.service || "";

    setForm({
      name: lead.projectName || `${service || "Project"} - ${customerName}`,
      service,
      location: lead.location || "",
      description:
        lead.projectDescription ||
        lead.description ||
        "",
      amount: getLeadBudget(lead.budget),
      deadline: dateInputValue(lead.preferredDate),
      status: "Planning",
      notes: "",
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!user || profile?.role !== "admin") {
      setError("You must be signed in as an administrator.");
      return;
    }

    if (!selectedLead) {
      setError("Select a lead before creating a project.");
      return;
    }

    if (!form.name.trim()) {
      setError("Enter a project name.");
      return;
    }

    if (!form.service.trim()) {
      setError("Enter the service for this project.");
      return;
    }

    const amount = Number(form.amount || 0);

    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid project amount.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const customer = {
        name: getCustomerName(selectedLead),
        firstName: selectedLead.firstName || "",
        lastName: selectedLead.lastName || "",
        email: selectedLead.email || "",
        phone: selectedLead.phone || "",
        company: selectedLead.company || "",
      };

      const projectRef = doc(collection(db, "projects"));
      const leadRef = doc(db, "leads", selectedLead.id);
      const batch = writeBatch(db);

      batch.set(projectRef, {
        name: form.name.trim(),
        leadId: selectedLead.id,
        customer,
        service: form.service.trim(),
        location: form.location.trim(),
        description: form.description.trim(),
        amount,
        budget: selectedLead.budget ?? "",
        deadline: form.deadline || null,
        status: form.status,
        progress: 0,
        notes: form.notes.trim(),
        createdBy: user.uid,
        updatedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.update(leadRef, {
        status: "converted",
        updatedAt: serverTimestamp(),
        convertedAt: serverTimestamp(),
        convertedToProjectId: projectRef.id,
      });

      await batch.commit();

      router.push(`/admin/projects/${projectRef.id}`);
    } catch (submitError) {
      console.error("Create project error:", submitError);
      setError(
        submitError?.code === "permission-denied"
          ? "Permission denied. Your Firestore rules must allow the admin to create projects and update leads."
          : submitError.message || "Unable to create this project."
      );
    } finally {
      setSaving(false);
    }
  }

  if (
    authLoading ||
    !user ||
    (profile?.role && profile.role !== "admin")
  ) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <LoaderCircle className="animate-spin text-[#1769E0]" size={28} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <button
        type="button"
        onClick={() => router.push("/admin/projects")}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#667085] hover:text-[#1769E0]"
      >
        <ArrowLeft size={17} />
        Back to Projects
      </button>

      <header>
        <p className="text-sm font-medium text-[#1769E0]">PROJECT MANAGEMENT</p>
        <h1 className="mt-1 text-2xl font-bold text-[#172033] sm:text-3xl">
          Create Project
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#667085]">
          Start with a submitted CRM lead. Its customer information and project
          requirements will be copied into the new project.
        </p>
      </header>

      {error && (
        <PageMessage
          message={error}
          onClose={() => setError("")}
        />
      )}

      {notice && (
        <PageMessage
          type="success"
          message={notice}
          onClose={() => setNotice("")}
        />
      )}

      <form
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm"
      >
        <div className="border-b border-[#E5EDF5] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
              <UserRound size={21} />
            </div>
            <div>
              <h2 className="font-semibold text-[#172033]">Choose a CRM lead</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Select the customer's submitted request.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Field
              label="Lead / customer *"
              hint="Leads already marked converted or lost are hidden to help avoid creating duplicate projects."
            >
              <select
                required
                value={selectedLeadId}
                disabled={leadsLoading || saving}
                onChange={(event) => handleLeadChange(event.target.value)}
                className={inputClass}
              >
                <option value="">
                  {leadsLoading ? "Loading leads..." : "Select a lead"}
                </option>

                {availableLeads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {getCustomerName(lead)} — {lead.service || "Service not specified"}
                  </option>
                ))}
              </select>
            </Field>

            {!leadsLoading && availableLeads.length === 0 && (
              <p className="mt-3 text-sm text-amber-700">
                There are no unconverted leads available. Add a lead in the CRM
                or check whether an existing lead is already converted.
              </p>
            )}
          </div>

          {selectedLead && (
            <div className="mt-4 rounded-xl bg-[#F8FBFF] p-4">
              <p className="text-sm font-semibold text-[#172033]">
                Lead details
              </p>

              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <p className="text-[#667085]">
                  <span className="font-medium text-[#344054]">Customer:</span>{" "}
                  {getCustomerName(selectedLead)}
                </p>

                <p className="break-all text-[#667085]">
                  <span className="font-medium text-[#344054]">Email:</span>{" "}
                  {selectedLead.email || "Not provided"}
                </p>

                <p className="text-[#667085]">
                  <span className="font-medium text-[#344054]">Phone:</span>{" "}
                  {selectedLead.phone || "Not provided"}
                </p>

                <p className="text-[#667085]">
                  <span className="font-medium text-[#344054]">Service:</span>{" "}
                  {selectedLead.service || "Not specified"}
                </p>

                {selectedLead.budget && (
                  <p className="text-[#667085]">
                    <span className="font-medium text-[#344054]">Budget:</span>{" "}
                    {typeof selectedLead.budget === "string"
                      ? selectedLead.budget
                      : `GH₵ ${selectedLead.budget}`}
                  </p>
                )}

                {selectedLead.preferredDate && (
                  <p className="text-[#667085]">
                    <span className="font-medium text-[#344054]">
                      Preferred date:
                    </span>{" "}
                    {dateInputValue(selectedLead.preferredDate) || "Not specified"}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold text-[#172033]">Project information</h2>
            <p className="mt-1 text-sm text-[#667085]">
              Review the copied details and make any necessary changes before
              creating the project.
            </p>
          </div>

          <Field label="Project name *">
            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Project name"
              className={inputClass}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Service *">
              <input
                required
                value={form.service}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    service: event.target.value,
                  }))
                }
                placeholder="e.g. Electrical Installation"
                className={inputClass}
              />
            </Field>

            <Field label="Project location">
              <div className="relative">
                <MapPin
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
                />
                <input
                  value={form.location}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                  placeholder="Project location"
                  className={`${inputClass} pl-9`}
                />
              </div>
            </Field>

            <Field
              label="Project amount (GH₵)"
              hint="Review the lead's budget and enter the agreed project amount."
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                placeholder="0.00"
                className={inputClass}
              />
            </Field>

            <Field
              label="Project deadline"
              hint="The lead's preferred date is prefilled when available."
            >
              <div className="relative">
                <CalendarDays
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
                />
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      deadline: event.target.value,
                    }))
                  }
                  className={`${inputClass} pl-9`}
                />
              </div>
            </Field>

            <Field label="Initial status">
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                className={inputClass}
              >
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
              </select>
            </Field>
          </div>

          <Field label="Project description">
            <textarea
              rows={5}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="The description submitted by the customer will appear here."
              className={inputClass}
            />
          </Field>

          <Field label="Internal notes (optional)">
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Instructions for the team..."
              className={inputClass}
            />
          </Field>

          <div className="flex flex-col-reverse gap-3 border-t border-[#E5EDF5] pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => router.push("/admin/projects")}
              className="rounded-xl border border-[#DCEAF8] px-5 py-3 text-sm font-semibold text-[#344054] hover:bg-[#F8FBFF] disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || !selectedLead || leadsLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1259C1] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : (
                <CheckCircle2 size={17} />
              )}

              {saving ? "Creating project..." : "Create Project"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}