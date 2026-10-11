"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import {
  Banknote,
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  LoaderCircle,
  Plus,
  Receipt,
  Search,
  Wallet,
  X,
} from "lucide-react";

import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

const money = (amount) =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(Number(amount || 0));

const dateText = (value) => {
  if (!value) return "—";

  const date = value?.toDate ? value.toDate() : new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

const getErrorMessage = (error) => {
  if (error?.code === "permission-denied") {
    return "You do not have permission to access this finance data.";
  }

  return error?.message || "Something went wrong. Please try again.";
};

export default function AdminFinancePage() {
  const { user, profile, loading: authLoading } = useAuth();

  const [workers, setWorkers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [payments, setPayments] = useState([]);

  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("salaries");

  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState(null);
  const [saving, setSaving] = useState(false);

  const [salaryForm, setSalaryForm] = useState({
    assignmentId: "",
    agreedSalary: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    method: "cash",
    reference: "",
    notes: "",
  });

  useEffect(() => {
    if (authLoading) return;

    if (!user || profile?.role !== "admin") {
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setError("");

    const sources = [
      ["workers", collection(db, "workers"), setWorkers],
      ["projects", collection(db, "projects"), setProjects],
      ["assignments", collection(db, "assignments"), setAssignments],
      ["moneyRequests", collection(db, "moneyRequests"), setRequests],
      ["workerSalaries", collection(db, "workerSalaries"), setSalaries],
      ["workerPayments", collection(db, "workerPayments"), setPayments],
    ];

    let pending = sources.length;
    let failed = false;

    const unsubscribers = sources.map(([name, ref, setter]) =>
      onSnapshot(
        ref,
        (snapshot) => {
          setter(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            }))
          );

          pending -= 1;
          if (pending === 0 && !failed) setDataLoading(false);
        },
        (err) => {
          console.error(`Finance ${name} listener error:`, err);
          failed = true;
          setError(getErrorMessage(err));
          setDataLoading(false);
        }
      )
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [user, profile?.role, authLoading]);

  const workerMap = useMemo(
    () => new Map(workers.map((worker) => [worker.id, worker])),
    [workers]
  );

  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );

  const assignmentMap = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.id, assignment])),
    [assignments]
  );

  const salaryRows = useMemo(() => {
    return salaries.map((salary) => {
      const assignment = assignmentMap.get(salary.assignmentId);
      const worker = workerMap.get(salary.workerId);
      const project = projectMap.get(
        salary.projectId || assignment?.projectId
      );

      // Money requests are the authoritative source for advances.
      // Do not add the linked expenses documents again.
      const advances = requests
        .filter((request) => {
          if (
            request.workerId !== salary.workerId ||
            request.status !== "approved"
          ) {
            return false;
          }

          if (request.assignmentId) {
            return request.assignmentId === salary.assignmentId;
          }

          // Backward compatibility for older requests without assignmentId.
          // This is unambiguous only when the worker has one assignment
          // for that project.
          return (
            request.projectId === salary.projectId &&
            assignments.filter(
              (item) =>
                item.workerId === salary.workerId &&
                item.projectId === salary.projectId
            ).length === 1
          );
        })
        .reduce((sum, request) => sum + Number(request.amount || 0), 0);

      const paid = payments
        .filter(
          (payment) =>
            payment.salaryId === salary.id &&
            payment.workerId === salary.workerId &&
            payment.status !== "void"
        )
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

      const agreedSalary = Number(salary.agreedSalary || 0);

      return {
        ...salary,
        worker,
        project,
        assignment,
        advances,
        paid,
        balance: agreedSalary - advances - paid,
      };
    });
  }, [
    salaries,
    requests,
    payments,
    workerMap,
    projectMap,
    assignmentMap,
    assignments,
  ]);

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === "pending"),
    [requests]
  );

  const totals = useMemo(() => {
    return {
      salaries: salaryRows.reduce(
        (sum, row) => sum + Number(row.agreedSalary || 0),
        0
      ),
      advances: salaryRows.reduce((sum, row) => sum + row.advances, 0),
      paid: salaryRows.reduce((sum, row) => sum + row.paid, 0),
      owed: salaryRows.reduce((sum, row) => sum + row.balance, 0),
    };
  }, [salaryRows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return salaryRows.filter((row) => {
      const text = [
        row.worker?.name,
        row.worker?.firstName,
        row.worker?.lastName,
        row.worker?.employeeId,
        row.project?.name,
        row.project?.service,
        row.assignmentId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [salaryRows, search]);

  const eligibleAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
      const worker = workerMap.get(assignment.workerId);
      const project = projectMap.get(assignment.projectId);

      const valid =
        worker &&
        project &&
        worker.status === "active" &&
        assignment.status !== "cancelled" &&
        assignment.status !== "completed";

      const alreadyHasSalary = salaries.some(
        (salary) => salary.assignmentId === assignment.id
      );

      return valid && !alreadyHasSalary;
    });
  }, [assignments, workerMap, projectMap, salaries]);

  const submitSalary = useCallback(async (event) => {
    event.preventDefault();

    if (!user || profile?.role !== "admin") return;

    const assignment = assignmentMap.get(salaryForm.assignmentId);
    const agreedSalary = Number(salaryForm.agreedSalary);

    if (!assignment) {
      setError("Select a valid worker assignment.");
      return;
    }

    if (!Number.isFinite(agreedSalary) || agreedSalary <= 0) {
      setError("Enter a salary greater than zero.");
      return;
    }

    // Client-side duplicate check. Security rules alone cannot guarantee
    // uniqueness across arbitrary Firestore queries.
    if (
      salaries.some(
        (salary) => salary.assignmentId === assignment.id
      )
    ) {
      setError("A salary has already been recorded for this assignment.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await addDoc(collection(db, "workerSalaries"), {
        workerId: assignment.workerId,
        assignmentId: assignment.id,
        projectId: assignment.projectId,
        agreedSalary,
        currency: "GHS",
        status: "active",
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setShowSalaryForm(false);
      setSalaryForm({ assignmentId: "", agreedSalary: "" });
      setNotice("Worker salary recorded successfully.");
    } catch (err) {
      console.error("Save worker salary error:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [user, profile?.role, assignmentMap, salaryForm, salaries]);

  const submitPayment = useCallback(async (event) => {
    event.preventDefault();

    if (!user || profile?.role !== "admin" || !selectedSalary) return;

    const amount = Number(paymentForm.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a payment amount greater than zero.");
      return;
    }

    const currentRow = salaryRows.find(
      (row) => row.id === selectedSalary.id
    );

    if (!currentRow || currentRow.balance <= 0) {
      setError("This salary has no outstanding balance.");
      return;
    }

    if (amount > currentRow.balance + 0.001) {
      setError(
        `The payment cannot exceed the remaining balance of ${money(
          currentRow.balance
        )}.`
      );
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await addDoc(collection(db, "workerPayments"), {
        salaryId: selectedSalary.id,
        workerId: selectedSalary.workerId,
        assignmentId: selectedSalary.assignmentId,
        projectId: selectedSalary.projectId,
        amount,
        paymentDate: paymentForm.paymentDate,
        method: paymentForm.method,
        reference: paymentForm.reference.trim(),
        notes: paymentForm.notes.trim(),
        status: "recorded",
        recordedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setShowPaymentForm(false);
      setSelectedSalary(null);
      setPaymentForm({
        amount: "",
        paymentDate: new Date().toISOString().slice(0, 10),
        method: "cash",
        reference: "",
        notes: "",
      });
      setNotice("Worker payment recorded successfully.");
    } catch (err) {
      console.error("Record worker payment error:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [user, profile?.role, selectedSalary, paymentForm, salaryRows]);

  if (authLoading || dataLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <LoaderCircle className="animate-spin text-[#1769E0]" size={30} />
      </div>
    );
  }

  if (!user || profile?.role !== "admin") {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-[#172033]">
          Admin access required
        </h1>
        <p className="mt-2 text-sm text-[#667085]">
          Sign in with an administrator account to access finance records.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex rounded-xl bg-[#1769E0] px-4 py-2.5 font-semibold text-white"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#1769E0]">
            FINANCIAL MANAGEMENT
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#172033] sm:text-3xl">
            Worker Finance
          </h1>
          <p className="mt-2 text-sm text-[#667085]">
            Manage job salaries, worker advances, payments, and outstanding balances.
          </p>
        </div>

        <button
          onClick={() => {
            setError("");
            setNotice("");
            setShowSalaryForm(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0F3D70]"
        >
          <Plus size={18} />
          Record Job Salary
        </button>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={18} />
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p>{notice}</p>
          <button onClick={() => setNotice("")} aria-label="Dismiss message">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={BriefcaseBusiness}
          label="Agreed Salaries"
          amount={money(totals.salaries)}
          detail={`${salaries.length} salary records`}
        />
        <SummaryCard
          icon={Receipt}
          label="Approved Advances"
          amount={money(totals.advances)}
          detail="Approved worker requests"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Salary Payments"
          amount={money(totals.paid)}
          detail="Recorded payments"
        />
        <SummaryCard
          icon={Wallet}
          label="Still Owed"
          amount={money(totals.owed)}
          detail="Calculated outstanding balance"
          highlight
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[#E5EDF5]">
        {[
          ["salaries", "Worker Salaries"],
          ["requests", `Money Requests (${pendingRequests.length} pending)`],
          ["payments", "Payment History"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold ${
              activeTab === value
                ? "border-[#1769E0] text-[#1769E0]"
                : "border-transparent text-[#667085] hover:text-[#172033]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "salaries" && (
        <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#E5EDF5] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-[#172033]">Salary by Assignment</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Each record represents one worker assigned to one job.
              </p>
            </div>

            <div className="relative w-full sm:max-w-xs">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search worker or project..."
                className="w-full rounded-xl border border-[#DCEAF8] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#1769E0]"
              />
            </div>
          </div>

          {salaryRows.length === 0 ? (
            <EmptyState
              title="No job salaries recorded yet"
              message="Record a salary for a worker's assignment to start tracking advances and payments."
            />
          ) : filteredRows.length === 0 ? (
            <EmptyState
              title="No matching salaries"
              message="Try another worker name, employee ID, or project."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[#F8FBFF] text-xs uppercase tracking-wide text-[#667085]">
                  <tr>
                    <th className="px-5 py-4">Worker / Project</th>
                    <th className="px-5 py-4">Salary</th>
                    <th className="px-5 py-4">Advances</th>
                    <th className="px-5 py-4">Paid</th>
                    <th className="px-5 py-4">Balance</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EDF5]">
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-[#F8FBFF]">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#172033]">
                          {row.worker?.name ||
                            `${row.worker?.firstName || ""} ${row.worker?.lastName || ""}`.trim() ||
                            "Unknown worker"}
                        </p>
                        <p className="mt-1 text-xs text-[#667085]">
                          {row.project?.name || row.project?.service || "Project"}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 font-medium">
                        {money(row.agreedSalary)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        {money(row.advances)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        {money(row.paid)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className={`font-bold ${row.balance > 0 ? "text-amber-700" : row.balance < 0 ? "text-red-700" : "text-emerald-700"}`}>
                          {money(row.balance)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {row.balance > 0 ? (
                          <button
                            onClick={() => {
                              setError("");
                              setNotice("");
                              setSelectedSalary(row);
                              setShowPaymentForm(true);
                            }}
                            className="whitespace-nowrap rounded-lg border border-[#DCEAF8] px-3 py-2 text-xs font-semibold text-[#1769E0] hover:bg-[#EAF4FF]"
                          >
                            Record Payment
                          </button>
                        ) : (
                          <span className="text-xs font-medium text-emerald-700">
                            {row.balance === 0 ? "Settled" : "Check balance"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === "requests" && (
        <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
          <div className="border-b border-[#E5EDF5] p-4">
            <h2 className="font-bold text-[#172033]">Worker Money Requests</h2>
            <p className="mt-1 text-sm text-[#667085]">
              Review requests and their current approval status.
            </p>
          </div>

          {requests.length === 0 ? (
            <EmptyState
              title="No worker requests yet"
              message="Requests submitted by workers will appear here."
            />
          ) : (
            <div className="divide-y divide-[#E5EDF5]">
              {[...requests]
                .sort((a, b) => {
                  const getTime = (item) =>
                    item.createdAt?.toMillis?.() || 0;
                  return getTime(b) - getTime(a);
                })
                .map((request) => {
                  const worker = workerMap.get(request.workerId);
                  const project = projectMap.get(request.projectId);

                  return (
                    <div
                      key={request.id}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-[#172033]">
                          {worker?.name ||
                            `${worker?.firstName || ""} ${worker?.lastName || ""}`.trim() ||
                            "Unknown worker"}
                        </p>
                        <p className="mt-1 text-sm capitalize text-[#667085]">
                          {(request.type || "other").replaceAll("_", " ")} ·{" "}
                          {project?.name || "Project not found"}
                        </p>
                        <p className="mt-1 text-sm text-[#667085]">
                          {request.reason || "No reason supplied"}
                        </p>
                        <p className="mt-1 text-xs text-[#667085]">
                          Requested {dateText(request.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <p className="font-bold text-[#172033]">
                          {money(request.amount)}
                        </p>
                        <StatusPill status={request.status} />
                        <Link
                          href={`/admin/requests/${request.id}`}
                          className="whitespace-nowrap rounded-lg border border-[#DCEAF8] px-3 py-2 text-xs font-semibold text-[#1769E0]"
                        >
                          Review
                        </Link>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      )}

      {activeTab === "payments" && (
        <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
          <div className="border-b border-[#E5EDF5] p-4">
            <h2 className="font-bold text-[#172033]">Payment History</h2>
            <p className="mt-1 text-sm text-[#667085]">
              Recorded worker salary payments.
            </p>
          </div>

          {payments.length === 0 ? (
            <EmptyState
              title="No salary payments recorded"
              message="Payments you record against a worker's salary will appear here."
            />
          ) : (
            <div className="divide-y divide-[#E5EDF5]">
              {[...payments]
                .sort((a, b) => {
                  const getTime = (item) =>
                    item.createdAt?.toMillis?.() || 0;
                  return getTime(b) - getTime(a);
                })
                .map((payment) => {
                  const worker = workerMap.get(payment.workerId);
                  const project = projectMap.get(payment.projectId);

                  return (
                    <div
                      key={payment.id}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-[#172033]">
                          {worker?.name ||
                            `${worker?.firstName || ""} ${worker?.lastName || ""}`.trim() ||
                            "Unknown worker"}
                        </p>
                        <p className="mt-1 text-sm text-[#667085]">
                          {project?.name || "Project"} ·{" "}
                          {(payment.method || "cash").toUpperCase()}
                        </p>
                        <p className="mt-1 text-xs text-[#667085]">
                          Paid on {dateText(payment.paymentDate)}
                          {payment.reference ? ` · Ref: ${payment.reference}` : ""}
                        </p>
                      </div>
                      <p className="font-bold text-emerald-700">
                        {money(payment.amount)}
                      </p>
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      )}

      {showSalaryForm && (
        <Modal
          title="Record Worker Salary"
          description="Set the agreed payment for one worker assignment."
          onClose={() => !saving && setShowSalaryForm(false)}
        >
          <form onSubmit={submitSalary} className="space-y-4">
            <Field label="Worker assignment">
              <select
                required
                value={salaryForm.assignmentId}
                onChange={(event) =>
                  setSalaryForm((current) => ({
                    ...current,
                    assignmentId: event.target.value,
                  }))
                }
                className="form-field"
              >
                <option value="">Select assignment</option>
                {eligibleAssignments.map((assignment) => {
                  const worker = workerMap.get(assignment.workerId);
                  const project = projectMap.get(assignment.projectId);

                  return (
                    <option key={assignment.id} value={assignment.id}>
                      {worker?.name ||
                        `${worker?.firstName || ""} ${worker?.lastName || ""}`.trim() ||
                        "Worker"}{" "}
                      — {project?.name || project?.service || "Project"}
                    </option>
                  );
                })}
              </select>
            </Field>

            {eligibleAssignments.length === 0 && (
              <p className="text-sm text-amber-700">
                No eligible assignments are available. Check that a worker is active
                and assigned to a non-completed, non-cancelled project.
              </p>
            )}

            <Field label="Agreed salary (GH₵)">
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                inputMode="decimal"
                value={salaryForm.agreedSalary}
                onChange={(event) =>
                  setSalaryForm((current) => ({
                    ...current,
                    agreedSalary: event.target.value,
                  }))
                }
                placeholder="e.g. 1500"
                className="form-field"
              />
            </Field>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowSalaryForm(false)}
                className="flex-1 rounded-xl border border-[#DCEAF8] px-4 py-3 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={saving || eligibleAssignments.length === 0}
                className="flex-1 rounded-xl bg-[#1769E0] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Salary"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showPaymentForm && selectedSalary && (
        <Modal
          title="Record Salary Payment"
          description={`${selectedSalary.worker?.name || "Worker"} · ${
            selectedSalary.project?.name || "Project"
          }`}
          onClose={() => !saving && setShowPaymentForm(false)}
        >
          <div className="mb-4 rounded-xl bg-[#F5FAFF] p-4">
            <p className="text-sm text-[#667085]">Outstanding balance</p>
            <p className="mt-1 text-xl font-bold text-[#1769E0]">
              {money(
                salaryRows.find((row) => row.id === selectedSalary.id)?.balance || 0
              )}
            </p>
          </div>

          <form onSubmit={submitPayment} className="space-y-4">
            <Field label="Amount paid (GH₵)">
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                max={
                  salaryRows.find((row) => row.id === selectedSalary.id)?.balance
                }
                value={paymentForm.amount}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                placeholder="e.g. 500"
                className="form-field"
              />
            </Field>

            <Field label="Payment date">
              <input
                required
                type="date"
                value={paymentForm.paymentDate}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    paymentDate: event.target.value,
                  }))
                }
                className="form-field"
              />
            </Field>

            <Field label="Payment method">
              <select
                value={paymentForm.method}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    method: event.target.value,
                  }))
                }
                className="form-field"
              >
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </Field>

            <Field label="Reference (optional)">
              <input
                value={paymentForm.reference}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    reference: event.target.value,
                  }))
                }
                placeholder="Transaction reference"
                className="form-field"
              />
            </Field>

            <Field label="Notes (optional)">
              <textarea
                rows={2}
                value={paymentForm.notes}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Additional details"
                className="form-field"
              />
            </Field>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowPaymentForm(false)}
                className="flex-1 rounded-xl border border-[#DCEAF8] px-4 py-3 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                className="flex-1 rounded-xl bg-[#1769E0] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Payment"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, amount, detail, highlight = false }) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        highlight
          ? "border-[#CFE4FF] bg-[#EAF4FF]"
          : "border-[#E5EDF5] bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[#667085]">{label}</p>
        <div className="rounded-xl bg-[#F5FAFF] p-2.5 text-[#1769E0]">
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-4 break-words text-2xl font-bold text-[#172033]">
        {amount}
      </p>
      <p className="mt-1 text-xs text-[#667085]">{detail}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-[#172033]">{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, description, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#172033]/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#172033]">{title}</h2>
            <p className="mt-1 text-sm text-[#667085]">{description}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-[#667085] hover:bg-[#F5FAFF]"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const styles = {
    pending: "bg-amber-50 text-amber-700",
    approved: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-700",
    paid: "bg-blue-50 text-blue-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[status] || "bg-gray-100 text-gray-600"
      }`}
    >
      {status || "unknown"}
    </span>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5FAFF] text-[#1769E0]">
        <Clock size={22} />
      </div>
      <h3 className="mt-4 font-semibold text-[#172033]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#667085]">
        {message}
      </p>
    </div>
  );
}