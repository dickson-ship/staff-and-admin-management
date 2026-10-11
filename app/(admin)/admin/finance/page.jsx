"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  onSnapshot,
  serverTimestamp,
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
  Trash2,
  CalendarDays,
  ArrowDownRight,
  FileText,
} from "lucide-react";

import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

const money = (amount) =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
    return "You do not have permission to access this finance data. Check your Firestore security rules.";
  }

  return error?.message || "Something went wrong. Please try again.";
};

const getWorkerName = (worker) => {
  if (!worker) return "Unknown worker";

  return (
    worker.name ||
    worker.fullName ||
    [worker.firstName, worker.lastName].filter(Boolean).join(" ") ||
    worker.email ||
    "Unknown worker"
  );
};

const getProjectName = (project) =>
  project?.name || project?.service || project?.projectName || "Project";

const getTimestamp = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const isVoided = (item) =>
  String(item?.status || "").toLowerCase() === "void";

const isApproved = (item) =>
  String(item?.status || "").toLowerCase() === "approved";

/*
 * Some systems store an expense document for an already-approved
 * money request. Since moneyRequests is our source for advances,
 * those linked documents must not be counted as another expense.
 */
const isAdvanceLinkedExpense = (expense) => {
  const source = String(
    expense?.source || expense?.type || ""
  ).toLowerCase();

  const category = String(expense?.category || "").toLowerCase();

  return Boolean(
    expense?.moneyRequestId ||
      expense?.advanceId ||
      expense?.requestId ||
      source.includes("money_request") ||
      source.includes("money request") ||
      source.includes("advance") ||
      category === "advance"
  );
};

const inputClass =
  "w-full rounded-xl border border-[#DCEAF8] bg-white px-3.5 py-2.5 text-sm text-[#172033] outline-none transition placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:ring-2 focus:ring-[#EAF4FF]";

const today = () => new Date().toISOString().slice(0, 10);

const emptyExpenseForm = {
  assignmentId: "",
  category: "transport",
  amount: "",
  expenseDate: today(),
  description: "",
  notes: "",
};

const emptySalaryForm = {
  assignmentId: "",
  agreedSalary: "",
};

const emptyPaymentForm = {
  amount: "",
  paymentDate: today(),
  method: "cash",
  reference: "",
  notes: "",
};

export default function AdminFinancePage() {
  const { user, profile, loading: authLoading } = useAuth();

  const [workers, setWorkers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("salaries");

  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const [selectedSalary, setSelectedSalary] = useState(null);
  const [saving, setSaving] = useState(false);

  const [salaryForm, setSalaryForm] = useState(emptySalaryForm);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);

  // --------------------------------------------------
  // LOAD FIRESTORE DATA
  // --------------------------------------------------

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
      ["expenses", collection(db, "expenses"), setExpenses],
    ];

    const loadedSources = new Set();
    let failed = false;

    const markLoaded = (name) => {
      loadedSources.add(name);

      if (loadedSources.size === sources.length && !failed) {
        setDataLoading(false);
      }
    };

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

          markLoaded(name);
        },
        (err) => {
          console.error(`Finance ${name} listener error:`, err);
          failed = true;
          setError(getErrorMessage(err));
          setDataLoading(false);
        }
      )
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [user, profile?.role, authLoading]);

  // --------------------------------------------------
  // LOOKUP MAPS
  // --------------------------------------------------

  const workerMap = useMemo(
    () => new Map(workers.map((worker) => [worker.id, worker])),
    [workers]
  );

  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );

  const assignmentMap = useMemo(
    () =>
      new Map(
        assignments.map((assignment) => [assignment.id, assignment])
      ),
    [assignments]
  );

  /*
   * These are actual recorded expenses, excluding voided entries
   * and entries that mirror a money request/advance.
   */
  const recordedExpenses = useMemo(
    () =>
      expenses.filter(
        (expense) =>
          !isVoided(expense) && !isAdvanceLinkedExpense(expense)
      ),
    [expenses]
  );

  const approvedRequests = useMemo(
    () => requests.filter(isApproved),
    [requests]
  );

  const pendingRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          String(request.status || "").toLowerCase() === "pending"
      ),
    [requests]
  );

  // --------------------------------------------------
  // ASSIGNMENT EXPENSE MATCHING
  // --------------------------------------------------

  const getExpensesForSalary = useCallback(
    (salary) => {
      const relatedAssignments = assignments.filter(
        (assignment) =>
          assignment.workerId === salary.workerId &&
          assignment.projectId === salary.projectId
      );

      return recordedExpenses.filter((expense) => {
        if (
          expense.assignmentId &&
          expense.assignmentId === salary.assignmentId
        ) {
          return true;
        }

        // If an expense has an assignmentId, do not attach it to
        // another assignment just because the worker/project match.
        if (expense.assignmentId) return false;

        // Older expense records can be matched when the combination
        // of worker and project identifies a single assignment.
        return (
          expense.workerId === salary.workerId &&
          expense.projectId === salary.projectId &&
          relatedAssignments.length === 1
        );
      });
    },
    [recordedExpenses, assignments]
  );

  // --------------------------------------------------
  // SALARY ROWS
  // --------------------------------------------------

  const salaryRows = useMemo(() => {
    return salaries.map((salary) => {
      const assignment = assignmentMap.get(salary.assignmentId);
      const worker = workerMap.get(salary.workerId);

      const project = projectMap.get(
        salary.projectId || assignment?.projectId
      );

      // Money requests remain the authoritative source for advances.
      const advances = approvedRequests
        .filter((request) => {
          if (request.workerId !== salary.workerId) return false;

          if (request.assignmentId) {
            return request.assignmentId === salary.assignmentId;
          }

          // Backward compatibility for old requests without assignmentId.
          return (
            request.projectId === salary.projectId &&
            assignments.filter(
              (item) =>
                item.workerId === salary.workerId &&
                item.projectId === salary.projectId
            ).length === 1
          );
        })
        .reduce(
          (sum, request) => sum + Number(request.amount || 0),
          0
        );

      const salaryPayments = payments.filter(
        (payment) =>
          payment.salaryId === salary.id &&
          payment.workerId === salary.workerId &&
          !isVoided(payment)
      );

      const paid = salaryPayments.reduce(
        (sum, payment) => sum + Number(payment.amount || 0),
        0
      );

      const salaryExpenses = getExpensesForSalary(salary);

      const otherExpenses = salaryExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0
      );

      const agreedSalary = Number(salary.agreedSalary || 0);

      return {
        ...salary,
        worker,
        project,
        assignment,
        advances,
        otherExpenses,
        expenseRecords: salaryExpenses,
        paid,
        balance: agreedSalary - advances - otherExpenses - paid,
      };
    });
  }, [
    salaries,
    approvedRequests,
    payments,
    workerMap,
    projectMap,
    assignmentMap,
    assignments,
    getExpensesForSalary,
  ]);

  // --------------------------------------------------
  // TOTALS
  // --------------------------------------------------

  const totals = useMemo(() => {
    const agreedSalaries = salaryRows.reduce(
      (sum, row) => sum + Number(row.agreedSalary || 0),
      0
    );

    // Count approved advances directly so advances are still included
    // even if their worker has no salary record yet.
    const advances = approvedRequests.reduce(
      (sum, request) => sum + Number(request.amount || 0),
      0
    );

    const otherExpenses = recordedExpenses.reduce(
      (sum, expense) => sum + Number(expense.amount || 0),
      0
    );

    // Salary payments also count as company expenses.
    const paid = payments
      .filter((payment) => !isVoided(payment))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    const expensesTotal = advances + otherExpenses + paid;

    return {
      salaries: agreedSalaries,
      advances,
      otherExpenses,
      paid,
      expensesTotal,
      owed: salaryRows.reduce(
        (sum, row) => sum + row.balance,
        0
      ),
    };
  }, [salaryRows, approvedRequests, recordedExpenses, payments]);

  // --------------------------------------------------
  // SEARCH AND ELIGIBLE ASSIGNMENTS
  // --------------------------------------------------

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return salaryRows;

    return salaryRows.filter((row) => {
      const text = [
        getWorkerName(row.worker),
        row.worker?.employeeId,
        getProjectName(row.project),
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

  const expenseAssignments = useMemo(
    () =>
      assignments.filter((assignment) => {
        const worker = workerMap.get(assignment.workerId);
        const project = projectMap.get(assignment.projectId);

        return (
          worker &&
          project &&
          assignment.status !== "cancelled"
        );
      }),
    [assignments, workerMap, projectMap]
  );

  const filteredExpenses = useMemo(() => {
    const term = search.trim().toLowerCase();

    const sorted = [...recordedExpenses].sort(
      (a, b) =>
        getTimestamp(b.expenseDate || b.createdAt) -
        getTimestamp(a.expenseDate || a.createdAt)
    );

    if (!term) return sorted;

    return sorted.filter((expense) => {
      const worker = workerMap.get(expense.workerId);
      const project = projectMap.get(expense.projectId);

      const searchable = [
        expense.category,
        expense.description,
        expense.notes,
        expense.amount,
        getWorkerName(worker),
        getProjectName(project),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [recordedExpenses, search, workerMap, projectMap]);

  const filteredPayments = useMemo(() => {
    const term = search.trim().toLowerCase();

    const sorted = [...payments]
      .filter((payment) => !isVoided(payment))
      .sort(
        (a, b) =>
          getTimestamp(b.paymentDate || b.createdAt) -
          getTimestamp(a.paymentDate || a.createdAt)
      );

    if (!term) return sorted;

    return sorted.filter((payment) => {
      const worker = workerMap.get(payment.workerId);
      const project = projectMap.get(payment.projectId);

      return [
        getWorkerName(worker),
        getProjectName(project),
        payment.method,
        payment.reference,
        payment.notes,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [payments, search, workerMap, projectMap]);

  // --------------------------------------------------
  // RECORD JOB SALARY
  // --------------------------------------------------

  const submitSalary = useCallback(
    async (event) => {
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

      if (
        salaries.some(
          (salary) => salary.assignmentId === assignment.id
        )
      ) {
        setError(
          "A salary has already been recorded for this assignment."
        );
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
        setSalaryForm({ ...emptySalaryForm });
        setNotice("Worker salary recorded successfully.");
      } catch (err) {
        console.error("Save worker salary error:", err);
        setError(getErrorMessage(err));
      } finally {
        setSaving(false);
      }
    },
    [
      user,
      profile?.role,
      assignmentMap,
      salaryForm,
      salaries,
    ]
  );

  // --------------------------------------------------
  // RECORD SALARY PAYMENT
  // --------------------------------------------------

  const submitPayment = useCallback(
    async (event) => {
      event.preventDefault();

      if (!user || profile?.role !== "admin" || !selectedSalary) {
        return;
      }

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
        setPaymentForm({ ...emptyPaymentForm });
        setNotice(
          "Salary payment recorded and included in total expenses."
        );
      } catch (err) {
        console.error("Record worker payment error:", err);
        setError(getErrorMessage(err));
      } finally {
        setSaving(false);
      }
    },
    [
      user,
      profile?.role,
      selectedSalary,
      paymentForm,
      salaryRows,
    ]
  );

  // --------------------------------------------------
  // RECORD A MANUAL EXPENSE
  // --------------------------------------------------

  const submitExpense = useCallback(
    async (event) => {
      event.preventDefault();

      if (!user || profile?.role !== "admin") return;

      const amount = Number(expenseForm.amount);
      const description = expenseForm.description.trim();

      if (!Number.isFinite(amount) || amount <= 0) {
        setError("Enter an expense amount greater than zero.");
        return;
      }

      if (!description) {
        setError("Enter a description for this expense.");
        return;
      }

      const assignment = expenseForm.assignmentId
        ? assignmentMap.get(expenseForm.assignmentId)
        : null;

      if (expenseForm.assignmentId && !assignment) {
        setError("The selected assignment could not be found.");
        return;
      }

      setSaving(true);
      setError("");
      setNotice("");

      try {
        await addDoc(collection(db, "expenses"), {
          amount,
          currency: "GHS",
          category: expenseForm.category,
          description,
          notes: expenseForm.notes.trim(),
          expenseDate: expenseForm.expenseDate,
          date: expenseForm.expenseDate,

          // Optional assignment link allows the expense to affect
          // the correct worker's remaining salary.
          workerId: assignment?.workerId || "",
          assignmentId: assignment?.id || "",
          projectId: assignment?.projectId || "",

          type: assignment ? "worker_expense" : "company_expense",
          source: "admin_manual_expense",
          status: "recorded",

          recordedBy: user.uid,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        setShowExpenseForm(false);
        setExpenseForm({
          ...emptyExpenseForm,
          expenseDate: today(),
        });
        setSearch("");
        setNotice(
          assignment
            ? "Expense recorded. It has been added to total expenses and deducted from the linked assignment's remaining salary."
            : "Company expense recorded and included in total expenses."
        );
      } catch (err) {
        console.error("Record expense error:", err);
        setError(getErrorMessage(err));
      } finally {
        setSaving(false);
      }
    },
    [user, profile?.role, expenseForm, assignmentMap]
  );

  // --------------------------------------------------
  // ACCESS STATES
  // --------------------------------------------------

  if (authLoading || dataLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <LoaderCircle
          className="animate-spin text-[#1769E0]"
          size={30}
        />
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

  // --------------------------------------------------
  // MAIN UI
  // --------------------------------------------------

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#1769E0]">
            FINANCIAL MANAGEMENT
          </p>

          <h1 className="mt-1 text-2xl font-bold text-[#172033] sm:text-3xl">
            Worker Finance
          </h1>

          <p className="mt-2 text-sm text-[#667085]">
            Track job salaries, advances, expenses, payments, and outstanding
            balances.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setError("");
              setNotice("");
              setExpenseForm({
                ...emptyExpenseForm,
                expenseDate: today(),
              });
              setShowExpenseForm(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DCEAF8] bg-white px-4 py-3 text-sm font-semibold text-[#1769E0] hover:bg-[#F5FAFF]"
          >
            <Receipt size={17} />
            Record Expense
          </button>

          <button
            type="button"
            onClick={() => {
              setError("");
              setNotice("");
              setSalaryForm({ ...emptySalaryForm });
              setShowSalaryForm(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0F3D70]"
          >
            <Plus size={18} />
            Record Job Salary
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p>{notice}</p>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss message"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Financial summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          icon={BriefcaseBusiness}
          label="Agreed Salaries"
          amount={money(totals.salaries)}
          detail={`${salaries.length} salary records`}
        />

        <SummaryCard
          icon={Wallet}
          label="Approved Advances"
          amount={money(totals.advances)}
          detail="Approved money requests"
        />

        <SummaryCard
          icon={Banknote}
          label="Salary Paid"
          amount={money(totals.paid)}
          detail="Payments recorded"
        />

        <SummaryCard
          icon={Receipt}
          label="Total Expenses"
          amount={money(totals.expensesTotal)}
          detail="Advances + expenses + salary paid"
          highlight
        />

        <SummaryCard
          icon={ArrowDownRight}
          label="Remaining Balance"
          amount={money(totals.owed)}
          detail="Across salary records"
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#E5EDF5]">
        {[
          ["salaries", "Worker Salaries"],
          ["expenses", "Expenses"],
          ["requests", `Money Requests (${pendingRequests.length} pending)`],
          ["payments", "Payment History"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setActiveTab(value);
              setSearch("");
              setError("");
              setNotice("");
            }}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === value
                ? "border-[#1769E0] text-[#1769E0]"
                : "border-transparent text-[#667085] hover:text-[#172033]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ============================================= */}
      {/* SALARIES                                      */}
      {/* ============================================= */}

      {activeTab === "salaries" && (
        <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#E5EDF5] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-[#172033]">
                Salary by Assignment
              </h2>
              <p className="mt-1 text-sm text-[#667085]">
                Advances, other expenses, and salary payments reduce the
                remaining balance.
              </p>
            </div>

            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search worker or project..."
            />
          </div>

          {salaryRows.length === 0 ? (
            <EmptyState
              title="No job salaries recorded yet"
              message="Record a salary for a worker's assignment to start tracking advances, expenses, and payments."
            />
          ) : filteredRows.length === 0 ? (
            <EmptyState
              title="No matching salaries"
              message="Try another worker name, employee ID, or project."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-[#F8FBFF] text-xs uppercase tracking-wide text-[#667085]">
                  <tr>
                    <th className="px-5 py-4">Worker / Project</th>
                    <th className="px-5 py-4">Salary</th>
                    <th className="px-5 py-4">Advances</th>
                    <th className="px-5 py-4">Other Expenses</th>
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
                          {getWorkerName(row.worker)}
                        </p>
                        <p className="mt-1 text-xs text-[#667085]">
                          {getProjectName(row.project)}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 font-medium">
                        {money(row.agreedSalary)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        {money(row.advances)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <span title="Recorded expenses linked to this assignment">
                          {money(row.otherExpenses)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        {money(row.paid)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`font-bold ${
                            row.balance > 0
                              ? "text-amber-700"
                              : row.balance < 0
                              ? "text-red-700"
                              : "text-emerald-700"
                          }`}
                        >
                          {money(row.balance)}
                        </span>

                        {row.balance < 0 && (
                          <p className="mt-1 text-xs text-red-600">
                            Over salary
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {row.balance > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setError("");
                              setNotice("");
                              setSelectedSalary(row);
                              setPaymentForm({
                                ...emptyPaymentForm,
                                paymentDate: today(),
                              });
                              setShowPaymentForm(true);
                            }}
                            className="whitespace-nowrap rounded-lg border border-[#DCEAF8] px-3 py-2 text-xs font-semibold text-[#1769E0] hover:bg-[#EAF4FF]"
                          >
                            Record Payment
                          </button>
                        ) : (
                          <span className={`text-xs font-medium ${
                            row.balance === 0
                              ? "text-emerald-700"
                              : "text-red-700"
                          }`}>
                            {row.balance === 0
                              ? "Settled"
                              : "Over salary"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-[#E5EDF5] bg-[#F8FBFF] px-5 py-3 text-xs leading-5 text-[#667085]">
            Remaining balance = agreed salary − approved advances − recorded
            assignment expenses − salary payments.
          </div>
        </section>
      )}

      {/* ============================================= */}
      {/* EXPENSES                                      */}
      {/* ============================================= */}

      {activeTab === "expenses" && (
        <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#E5EDF5] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-[#172033]">Recorded Expenses</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Worker and company expenses recorded by the admin.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <SearchBox
                value={search}
                onChange={setSearch}
                placeholder="Search expenses..."
              />

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setNotice("");
                  setExpenseForm({
                    ...emptyExpenseForm,
                    expenseDate: today(),
                  });
                  setShowExpenseForm(true);
                }}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#1769E0] px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-[#0F3D70]"
              >
                <Plus size={16} />
                Record Expense
              </button>
            </div>
          </div>

          <div className="grid gap-3 border-b border-[#E5EDF5] bg-[#F8FBFF] p-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[#E5EDF5] bg-white p-4">
              <p className="text-sm text-[#667085]">
                Other recorded expenses
              </p>
              <p className="mt-1 text-xl font-bold text-[#172033]">
                {money(totals.otherExpenses)}
              </p>
            </div>

            <div className="rounded-xl border border-[#E5EDF5] bg-white p-4">
              <p className="text-sm text-[#667085]">
                Total expenditure
              </p>
              <p className="mt-1 text-xl font-bold text-[#1769E0]">
                {money(totals.expensesTotal)}
              </p>
              <p className="mt-1 text-xs text-[#667085]">
                Includes approved advances and recorded salary payments.
              </p>
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <EmptyState
              title="No recorded expenses"
              message="Select Record Expense to add an expense. You can link it to a worker assignment or record it as a general company expense."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-[#F8FBFF] text-xs uppercase tracking-wide text-[#667085]">
                  <tr>
                    <th className="px-5 py-4">Expense</th>
                    <th className="px-5 py-4">Worker / Project</th>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Amount</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#E5EDF5]">
                  {filteredExpenses.map((expense) => {
                    const worker = workerMap.get(expense.workerId);
                    const project = projectMap.get(expense.projectId);

                    return (
                      <tr key={expense.id} className="hover:bg-[#F8FBFF]">
                        <td className="px-5 py-4">
                          <p className="font-semibold capitalize text-[#172033]">
                            {String(expense.category || "other").replaceAll(
                              "_",
                              " "
                            )}
                          </p>
                          <p className="mt-1 max-w-xs whitespace-normal text-xs text-[#667085]">
                            {expense.description || expense.notes || "No description"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          {expense.assignmentId || expense.workerId ? (
                            <>
                              <p className="font-medium text-[#172033]">
                                {getWorkerName(worker)}
                              </p>
                              <p className="mt-1 text-xs text-[#667085]">
                                {getProjectName(project)}
                              </p>
                            </>
                          ) : (
                            <span className="text-sm text-[#667085]">
                              Company expense
                            </span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-[#667085]">
                          {dateText(expense.expenseDate || expense.date || expense.createdAt)}
                        </td>

                        <td className="px-5 py-4">
                          <StatusPill status={expense.status || "recorded"} />
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-[#172033]">
                          {money(expense.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-[#E5EDF5] px-5 py-3 text-xs leading-5 text-[#667085]">
            Expenses linked to an assignment reduce the remaining balance for
            that assignment. General company expenses contribute to total
            expenses but are not deducted from an individual worker's salary.
          </div>
        </section>
      )}

      {/* ============================================= */}
      {/* MONEY REQUESTS                                */}
      {/* ============================================= */}

      {activeTab === "requests" && (
        <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
          <div className="border-b border-[#E5EDF5] p-4">
            <h2 className="font-bold text-[#172033]">
              Worker Money Requests
            </h2>
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
                .sort(
                  (a, b) =>
                    getTimestamp(b.createdAt) -
                    getTimestamp(a.createdAt)
                )
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
                          {getWorkerName(worker)}
                        </p>

                        <p className="mt-1 text-sm capitalize text-[#667085]">
                          {String(request.type || "other").replaceAll("_", " ")}
                          {" · "}
                          {getProjectName(project)}
                        </p>

                        <p className="mt-1 text-sm text-[#667085]">
                          {request.reason || "No reason supplied"}
                        </p>

                        <p className="mt-1 text-xs text-[#667085]">
                          Requested {dateText(request.createdAt)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
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

      {/* ============================================= */}
      {/* SALARY PAYMENT HISTORY                        */}
      {/* ============================================= */}

      {activeTab === "payments" && (
        <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#E5EDF5] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-[#172033]">Payment History</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Salary payments also contribute to total company expenses.
              </p>
            </div>

            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search payments..."
            />
          </div>

          {filteredPayments.length === 0 ? (
            <EmptyState
              title="No salary payments recorded"
              message="Payments you record against a worker's salary will appear here."
            />
          ) : (
            <div className="divide-y divide-[#E5EDF5]">
              {filteredPayments.map((payment) => {
                const worker = workerMap.get(payment.workerId);
                const project = projectMap.get(payment.projectId);

                return (
                  <div
                    key={payment.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-[#172033]">
                        {getWorkerName(worker)}
                      </p>

                      <p className="mt-1 text-sm text-[#667085]">
                        {getProjectName(project)}
                        {" · "}
                        {String(payment.method || "cash").replaceAll("_", " ")}
                      </p>

                      <p className="mt-1 text-xs text-[#667085]">
                        Paid on {dateText(payment.paymentDate || payment.createdAt)}
                        {payment.reference
                          ? ` · Ref: ${payment.reference}`
                          : ""}
                      </p>

                      {payment.notes && (
                        <p className="mt-1 text-xs text-[#667085]">
                          {payment.notes}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-emerald-700">
                        {money(payment.amount)}
                      </p>
                      <StatusPill status={payment.status || "recorded"} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ============================================= */}
      {/* RECORD SALARY MODAL                           */}
      {/* ============================================= */}

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
                className={inputClass}
              >
                <option value="">Select assignment</option>

                {eligibleAssignments.map((assignment) => {
                  const worker = workerMap.get(assignment.workerId);
                  const project = projectMap.get(assignment.projectId);

                  return (
                    <option key={assignment.id} value={assignment.id}>
                      {getWorkerName(worker)} — {getProjectName(project)}
                    </option>
                  );
                })}
              </select>
            </Field>

            {eligibleAssignments.length === 0 && (
              <p className="text-sm text-amber-700">
                No eligible assignments are available. Check that a worker is
                active and assigned to a non-completed, non-cancelled project.
              </p>
            )}

            <Field label="Agreed salary (GHS)">
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                value={salaryForm.agreedSalary}
                onChange={(event) =>
                  setSalaryForm((current) => ({
                    ...current,
                    agreedSalary: event.target.value,
                  }))
                }
                placeholder="e.g. 1500"
                className={inputClass}
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
                type="submit"
                disabled={saving || eligibleAssignments.length === 0}
                className="flex-1 rounded-xl bg-[#1769E0] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Salary"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================= */}
      {/* RECORD EXPENSE MODAL                          */}
      {/* ============================================= */}

      {showExpenseForm && (
        <Modal
          title="Record Expense"
          description="Record an expense and optionally link it to a worker assignment."
          onClose={() => !saving && setShowExpenseForm(false)}
        >
          <form onSubmit={submitExpense} className="space-y-4">
            <Field label="Expense category">
              <select
                required
                value={expenseForm.category}
                onChange={(event) =>
                  setExpenseForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                className={inputClass}
              >
                <option value="transport">Transport</option>
                <option value="food">Food</option>
                <option value="materials">Materials</option>
                <option value="tools">Tools and equipment</option>
                <option value="accommodation">Accommodation</option>
                <option value="communication">Communication</option>
                <option value="maintenance">Maintenance</option>
                <option value="utilities">Utilities</option>
                <option value="office">Office expenses</option>
                <option value="other">Other</option>
              </select>
            </Field>

            <Field label="Amount (GHS)">
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                value={expenseForm.amount}
                onChange={(event) =>
                  setExpenseForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                placeholder="e.g. 120"
                className={inputClass}
              />
            </Field>

            <Field label="Expense date">
              <input
                required
                type="date"
                value={expenseForm.expenseDate}
                onChange={(event) =>
                  setExpenseForm((current) => ({
                    ...current,
                    expenseDate: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </Field>

            <Field label="Worker assignment (optional)">
              <select
                value={expenseForm.assignmentId}
                onChange={(event) =>
                  setExpenseForm((current) => ({
                    ...current,
                    assignmentId: event.target.value,
                  }))
                }
                className={inputClass}
              >
                <option value="">
                  General company expense — not linked to a worker
                </option>

                {expenseAssignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {getWorkerName(workerMap.get(assignment.workerId))}
                    {" — "}
                    {getProjectName(projectMap.get(assignment.projectId))}
                  </option>
                ))}
              </select>

              <p className="mt-1.5 text-xs leading-5 text-[#667085]">
                Linking an expense to an assignment makes it count against
                that worker's remaining salary. General expenses only affect
                company totals.
              </p>
            </Field>

            <Field label="Description">
              <input
                required
                value={expenseForm.description}
                onChange={(event) =>
                  setExpenseForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="e.g. Transport to project site"
                className={inputClass}
              />
            </Field>

            <Field label="Additional notes (optional)">
              <textarea
                rows={3}
                value={expenseForm.notes}
                onChange={(event) =>
                  setExpenseForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Add a reference or further details..."
                className={inputClass}
              />
            </Field>

            <div className="rounded-xl bg-[#F5FAFF] p-3 text-xs leading-5 text-[#667085]">
              This expense will be saved to the Firestore{" "}
              <code>expenses</code> collection and included in Total Expenses.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowExpenseForm(false)}
                className="flex-1 rounded-xl border border-[#DCEAF8] px-4 py-3 text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-[#1769E0] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Expense"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================= */}
      {/* RECORD SALARY PAYMENT MODAL                   */}
      {/* ============================================= */}

      {showPaymentForm && selectedSalary && (
        <Modal
          title="Record Salary Payment"
          description={`${getWorkerName(selectedSalary.worker)} · ${getProjectName(selectedSalary.project)}`}
          onClose={() => !saving && setShowPaymentForm(false)}
        >
          <div className="mb-4 rounded-xl bg-[#F5FAFF] p-4">
            <p className="text-sm text-[#667085]">
              Outstanding balance after advances and recorded expenses
            </p>

            <p className="mt-1 text-xl font-bold text-[#1769E0]">
              {money(
                salaryRows.find((row) => row.id === selectedSalary.id)
                  ?.balance || 0
              )}
            </p>
          </div>

          <form onSubmit={submitPayment} className="space-y-4">
            <Field label="Amount paid (GHS)">
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                max={
                  salaryRows.find((row) => row.id === selectedSalary.id)
                    ?.balance
                }
                value={paymentForm.amount}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                placeholder="e.g. 500"
                className={inputClass}
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
                className={inputClass}
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
                className={inputClass}
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
                className={inputClass}
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
                className={inputClass}
              />
            </Field>

            <div className="rounded-xl bg-[#F5FAFF] p-3 text-xs leading-5 text-[#667085]">
              Once recorded, this payment will be added to salary payments
              and Total Expenses.
            </div>

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
                type="submit"
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

// --------------------------------------------------
// REUSABLE COMPONENTS
// --------------------------------------------------

function SummaryCard({
  icon: Icon,
  label,
  amount,
  detail,
  highlight = false,
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        highlight
          ? "border-[#CFE4FF] bg-[#EAF4FF]"
          : "border-[#E5EDF5] bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#667085]">
          {label}
        </p>

        <div className="rounded-xl bg-[#F5FAFF] p-2.5 text-[#1769E0]">
          <Icon size={20} />
        </div>
      </div>

      <p className="mt-4 break-words text-xl font-bold text-[#172033] sm:text-2xl">
        {amount}
      </p>

      <p className="mt-1 text-xs text-[#667085]">{detail}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-[#172033]">
        {label}
      </span>

      {children}
    </label>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        size={17}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]"
      />

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${inputClass} pl-9`}
      />
    </div>
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
            <h2 className="text-xl font-bold text-[#172033]">
              {title}
            </h2>

            <p className="mt-1 text-sm text-[#667085]">
              {description}
            </p>
          </div>

          <button
            type="button"
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
  const normalized = String(status || "recorded").toLowerCase();

  const styles = {
    pending: "bg-amber-50 text-amber-700",
    approved: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-700",
    paid: "bg-blue-50 text-blue-700",
    recorded: "bg-blue-50 text-blue-700",
    void: "bg-slate-100 text-slate-500",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[normalized] || "bg-gray-100 text-gray-600"
      }`}
    >
      {normalized.replaceAll("_", " ")}
    </span>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5FAFF] text-[#1769E0]">
        <FileText size={22} />
      </div>

      <h3 className="mt-4 font-semibold text-[#172033]">{title}</h3>

      <p className="mx-auto mt-2 max-w-md text-sm text-[#667085]">
        {message}
      </p>
    </div>
  );
}