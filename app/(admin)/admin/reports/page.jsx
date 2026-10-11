
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import {
  Activity,
  Banknote,
  BriefcaseBusiness,
  Camera,
  Clock,
  Download,
  FileText,
  LoaderCircle,
  Receipt,
  Search,
  Users,
  Wallet,
} from "lucide-react";

import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

const REPORT_SOURCES = [
  ["workers", "workers"],
  ["projects", "projects"],
  ["assignments", "assignments"],
  ["requests", "moneyRequests"],
  ["expenses", "expenses"],
  ["salaries", "workerSalaries"],
  ["payments", "workerPayments"],
  ["submissions", "workSubmissions"],
];

const INITIAL_DATA = {
  workers: [],
  projects: [],
  assignments: [],
  requests: [],
  expenses: [],
  salaries: [],
  payments: [],
  submissions: [],
};

const currency = (value) =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

function toDate(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (typeof value === "string" || value instanceof Date) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function formatDate(value) {
  const date = toDate(value);

  return date
    ? date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
}

function personName(worker) {
  if (!worker) return "Unknown worker";

  return (
    worker.name ||
    `${worker.firstName || ""} ${worker.lastName || ""}`.trim() ||
    worker.email ||
    "Unknown worker"
  );
}

function statusLabel(value) {
  return String(value || "unknown")
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function inPeriod(value, start, end) {
  // With no date filter, include records even if their date is missing.
  if (!start && !end) return true;

  const date = toDate(value);
  if (!date) return false;

  if (start) {
    const from = new Date(`${start}T00:00:00`);
    if (date < from) return false;
  }

  if (end) {
    const to = new Date(`${end}T23:59:59.999`);
    if (date > to) return false;
  }

  return true;
}

function StatCard({ icon: Icon, label, value, note }) {
  return (
    <div className="rounded-2xl border border-[#DCE5F0] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#475467]">{label}</p>
          <p className="mt-3 break-words text-2xl font-bold text-[#172033]">
            {value}
          </p>
        </div>

        <span className="shrink-0 rounded-xl bg-[#EAF4FF] p-3 text-[#1769E0]">
          <Icon size={21} />
        </span>
      </div>

      <p className="mt-2 text-xs leading-5 text-[#475467]">{note}</p>
    </div>
  );
}

function Panel({ title, description, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#DCE5F0] bg-white shadow-sm">
      <div className="border-b border-[#DCE5F0] px-5 py-4">
        <h2 className="font-bold text-[#172033]">{title}</h2>
        {description && (
          <p className="mt-1 text-sm leading-5 text-[#475467]">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function StatusBadge({ value }) {
  const normalized = String(value || "unknown")
    .toLowerCase()
    .replaceAll("_", "-");

  let color = "bg-gray-100 text-gray-800";

  if (
    ["approved", "completed", "active", "paid", "accepted"].includes(
      normalized
    )
  ) {
    color = "bg-emerald-100 text-emerald-800";
  } else if (
    ["pending", "assigned", "in-progress", "submitted"].includes(normalized)
  ) {
    color = "bg-amber-100 text-amber-900";
  } else if (
    ["rejected", "cancelled", "declined", "void"].includes(normalized)
  ) {
    color = "bg-red-100 text-red-800";
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}
    >
      {statusLabel(value)}
    </span>
  );
}

function ReportTable({ headers, children, emptyMessage = "No records found." }) {
  const isEmpty = !children || (Array.isArray(children) && children.length === 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[650px] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-[#F1F5F9] text-[#172033]">
            {headers.map((header) => (
              <th
                key={header}
                className="border-b border-[#DCE5F0] px-4 py-3 font-bold"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-[#E2E8F0] text-[#172033]">
          {isEmpty ? (
            <tr>
              <td
                colSpan={headers.length}
                className="px-4 py-8 text-center text-[#475467]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

function moneyCell(value) {
  return (
    <span className="whitespace-nowrap font-medium text-[#172033]">
      {currency(value)}
    </span>
  );
}

export default function AdminReportsPage() {
  const { user, profile, loading: authLoading } = useAuth();

  const [data, setData] = useState(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!user || profile?.role !== "admin") {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const firstSnapshots = new Set();
    const unsubscribers = [];
    let failed = false;

    for (const [key, collectionName] of REPORT_SOURCES) {
      const unsubscribe = onSnapshot(
        collection(db, collectionName),
        (snapshot) => {
          setData((current) => ({
            ...current,
            [key]: snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            })),
          }));

          firstSnapshots.add(key);

          if (firstSnapshots.size === REPORT_SOURCES.length && !failed) {
            setLoading(false);
          }
        },
        (err) => {
          console.error(`Report loading error (${collectionName}):`, err);
          failed = true;
          setLoading(false);

          setError(
            err.code === "permission-denied"
              ? `Access denied to "${collectionName}". Check the Firestore security rules.`
              : `Unable to load "${collectionName}". Some report figures may be incomplete.`
          );
        }
      );

      unsubscribers.push(unsubscribe);
    }

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [user, profile?.role, authLoading]);

  const workerMap = useMemo(
    () => new Map(data.workers.map((worker) => [worker.id, worker])),
    [data.workers]
  );

  const projectMap = useMemo(
    () => new Map(data.projects.map((project) => [project.id, project])),
    [data.projects]
  );

  const assignmentMap = useMemo(
    () => new Map(data.assignments.map((item) => [item.id, item])),
    [data.assignments]
  );

  const selectedWorker = workerMap.get(selectedWorkerId);

  const visibleWorkers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return [...data.workers]
      .filter((worker) => {
        const searchable = [
          personName(worker),
          worker.email,
          worker.employeeId,
          worker.phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(term);
      })
      .sort((a, b) => personName(a).localeCompare(personName(b)));
  }, [data.workers, search]);

  // Assignment dates are filtered by creation date, or start date if
  // creation date is not available.
  const workerAssignments = useMemo(
    () =>
      data.assignments.filter(
        (item) =>
          item.workerId === selectedWorkerId &&
          inPeriod(item.createdAt || item.startDate, startDate, endDate)
      ),
    [data.assignments, selectedWorkerId, startDate, endDate]
  );

  const workerRequests = useMemo(
    () =>
      data.requests.filter(
        (item) =>
          item.workerId === selectedWorkerId &&
          inPeriod(item.createdAt, startDate, endDate)
      ),
    [data.requests, selectedWorkerId, startDate, endDate]
  );

  const workerExpenses = useMemo(
    () =>
      data.expenses.filter(
        (item) =>
          item.workerId === selectedWorkerId &&
          item.status !== "void" &&
          inPeriod(item.createdAt || item.expenseDate, startDate, endDate)
      ),
    [data.expenses, selectedWorkerId, startDate, endDate]
  );

  const workerPayments = useMemo(
    () =>
      data.payments.filter(
        (item) =>
          item.workerId === selectedWorkerId &&
          item.status !== "void" &&
          inPeriod(item.paymentDate || item.createdAt, startDate, endDate)
      ),
    [data.payments, selectedWorkerId, startDate, endDate]
  );

  const workerSubmissions = useMemo(
    () =>
      data.submissions.filter(
        (item) =>
          item.workerId === selectedWorkerId &&
          inPeriod(item.createdAt || item.submittedAt, startDate, endDate)
      ),
    [data.submissions, selectedWorkerId, startDate, endDate]
  );

  // Salary balances use all approved advances and all valid linked payments.
  // The date filters do not change the current amount owed.
  const workerSalaries = useMemo(() => {
    return data.salaries
      .filter((salary) => {
        if (salary.workerId !== selectedWorkerId) return false;

        const assignment = assignmentMap.get(salary.assignmentId);
        const projectId = salary.projectId || assignment?.projectId;

        return true;
      })
      .map((salary) => {
        const salaryAssignment = assignmentMap.get(salary.assignmentId);
        const salaryProjectId =
          salary.projectId || salaryAssignment?.projectId;

        const matchingAssignments = data.assignments.filter(
          (assignment) =>
            assignment.workerId === salary.workerId &&
            assignment.projectId === salaryProjectId
        );

        const advances = data.requests
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

            // Legacy requests can only be attributed safely when a
            // worker has exactly one assignment for the relevant project.
            return (
              matchingAssignments.length === 1 &&
              request.projectId === salaryProjectId
            );
          })
          .reduce((sum, request) => sum + Number(request.amount || 0), 0);

        const paid = data.payments
          .filter(
            (payment) =>
              payment.salaryId === salary.id &&
              payment.workerId === salary.workerId &&
              payment.status !== "void"
          )
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

        return {
          ...salary,
          projectId: salaryProjectId,
          project: projectMap.get(salaryProjectId),
          advances,
          paid,
          balance: Number(salary.agreedSalary || 0) - advances - paid,
        };
      });
  }, [
    data.salaries,
    data.requests,
    data.payments,
    data.assignments,
    selectedWorkerId,
    assignmentMap,
    projectMap,
  ]);

  const totals = useMemo(() => {
    const salaryTotal = workerSalaries.reduce(
      (sum, item) => sum + Number(item.agreedSalary || 0),
      0
    );

    const advances = workerSalaries.reduce(
      (sum, item) => sum + item.advances,
      0
    );

    const paid = workerSalaries.reduce((sum, item) => sum + item.paid, 0);

    const balance = workerSalaries.reduce(
      (sum, item) => sum + item.balance,
      0
    );

    const approvedRequests = workerRequests
      .filter((item) => item.status === "approved")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const pendingRequests = workerRequests.filter(
      (item) => item.status === "pending"
    ).length;

    const expenseTotal = workerExpenses.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    return {
      assignments: workerAssignments.length,
      completed: workerAssignments.filter(
        (item) => item.status === "completed"
      ).length,
      inProgress: workerAssignments.filter((item) =>
        ["in-progress", "in_progress"].includes(item.status)
      ).length,
      pendingRequests,
      approvedRequests,
      expenseTotal,
      salaryTotal,
      advances,
      paid,
      balance,
      submissions: workerSubmissions.length,
      pendingSubmissions: workerSubmissions.filter(
        (item) => item.status === "pending"
      ).length,
    };
  }, [
    workerSalaries,
    workerRequests,
    workerExpenses,
    workerAssignments,
    workerSubmissions,
  ]);

  const allWorkerSummaries = useMemo(() => {
    return visibleWorkers.map((worker) => {
      const salaries = data.salaries.filter(
        (salary) => salary.workerId === worker.id
      );

      const totalSalary = salaries.reduce(
        (sum, salary) => sum + Number(salary.agreedSalary || 0),
        0
      );

      const totalPaid = salaries.reduce((sum, salary) => {
        return (
          sum +
          data.payments
            .filter(
              (payment) =>
                payment.salaryId === salary.id &&
                payment.workerId === worker.id &&
                payment.status !== "void"
            )
            .reduce(
              (paymentSum, payment) =>
                paymentSum + Number(payment.amount || 0),
              0
            )
        );
      }, 0);

      const advances = salaries.reduce((sum, salary) => {
        const projectId =
          salary.projectId ||
          assignmentMap.get(salary.assignmentId)?.projectId;

        const sameAssignments = data.assignments.filter(
          (assignment) =>
            assignment.workerId === worker.id &&
            assignment.projectId === projectId
        );

        const allocated = data.requests
          .filter((request) => {
            if (
              request.workerId !== worker.id ||
              request.status !== "approved"
            ) {
              return false;
            }

            if (request.assignmentId) {
              return request.assignmentId === salary.assignmentId;
            }

            return (
              sameAssignments.length === 1 &&
              request.projectId === projectId
            );
          })
          .reduce((amount, request) => amount + Number(request.amount || 0), 0);

        return sum + allocated;
      }, 0);

      const assignmentCount = data.assignments.filter(
        (item) =>
          item.workerId === worker.id &&
          inPeriod(item.createdAt || item.startDate, startDate, endDate)
      ).length;

      return {
        worker,
        salary: totalSalary,
        advances,
        paid: totalPaid,
        balance: totalSalary - advances - totalPaid,
        assignments: assignmentCount,
      };
    });
  }, [
    visibleWorkers,
    data.salaries,
    data.payments,
    data.requests,
    data.assignments,
    assignmentMap,
    startDate,
    endDate,
  ]);

  function downloadWorkerReport() {
    if (!selectedWorker) return;

    // Only the selected worker's report is printed.
    const safeName = personName(selectedWorker)
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "");

    document.title = `Abes-Worker-Report-${safeName}-${startDate || "all-time"}-${endDate || "present"}`;
    window.print();
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-80 items-center justify-center gap-3 bg-[#F8FBFF] text-[#172033]">
        <LoaderCircle
          className="animate-spin text-[#1769E0]"
          size={26}
        />
        <span className="font-medium">Loading staff reports...</span>
      </div>
    );
  }

  if (!user || profile?.role !== "admin") {
    return (
      <div className="rounded-2xl border border-[#DCE5F0] bg-white p-8 text-center text-[#172033]">
        <h1 className="text-xl font-bold">Admin access required</h1>
        <p className="mt-2 text-sm text-[#475467]">
          Sign in as an administrator to view staff reports.
        </p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 bg-[#F8FBFF] p-1 text-[#172033]">
      {/* PAGE HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-bold tracking-wider text-[#1769E0]">
            MANAGEMENT REPORTS
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#172033] sm:text-3xl">
            Staff & Finance Reports
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#475467]">
            Review each worker's assignments, requests, expenses, salary
            payments, outstanding balance, and submitted work.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-[#DCE5F0] bg-white px-4 py-3 text-sm text-[#172033]">
          <Users size={19} className="text-[#1769E0]" />
          <span className="font-semibold">{data.workers.length} workers</span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">Some report data could not be loaded.</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* FILTERS */}
      <Panel
        title="Report filters"
        description="Choose a worker and reporting period. Salary balances always show the current outstanding amount."
      >
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-semibold text-[#344054]">
            Search workers
            <div className="relative mt-2">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475467]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, ID, email..."
                className="w-full rounded-xl border border-[#B8C7D9] bg-white py-2.5 pl-9 pr-3 text-sm text-[#172033] placeholder:text-[#667085] outline-none focus:border-[#1769E0] focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </label>

          <label className="text-sm font-semibold text-[#344054]">
            Select worker
            <select
              value={selectedWorkerId}
              onChange={(event) => setSelectedWorkerId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#B8C7D9] bg-white px-3 py-2.5 text-sm text-[#172033] outline-none focus:border-[#1769E0] focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Choose a worker</option>
              {data.workers
                .slice()
                .sort((a, b) => personName(a).localeCompare(personName(b)))
                .map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {personName(worker)}
                  </option>
                ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-[#344054]">
            Start date
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#B8C7D9] bg-white px-3 py-2.5 text-sm text-[#172033] outline-none focus:border-[#1769E0] focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="text-sm font-semibold text-[#344054]">
            End date
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#B8C7D9] bg-white px-3 py-2.5 text-sm text-[#172033] outline-none focus:border-[#1769E0] focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#DCE5F0] px-5 py-4">
          <p className="text-xs leading-5 text-[#475467]">
            Activity tables use the selected date range. Salary obligations
            use all approved advances and valid salary-linked payments.
          </p>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setSelectedWorkerId("");
              setStartDate("");
              setEndDate("");
            }}
            className="rounded-lg border border-[#B8C7D9] bg-white px-4 py-2 text-sm font-semibold text-[#172033] hover:bg-[#F1F5F9]"
          >
            Clear filters
          </button>
        </div>
      </Panel>

      {/* ALL WORKERS SUMMARY */}
      <Panel
        title="Worker overview"
        description="Outstanding salary balances for every worker. Select View report to open an individual report."
      >
        <div className="border-b border-[#DCE5F0] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              icon={Users}
              label="Workers"
              value={data.workers.length}
              note="Registered worker records"
            />
            <StatCard
              icon={BriefcaseBusiness}
              label="Assignments"
              value={data.assignments.filter((item) =>
                inPeriod(item.createdAt || item.startDate, startDate, endDate)
              ).length}
              note="Assignments in the selected period"
            />
            <StatCard
              icon={Clock}
              label="Pending requests"
              value={
                data.requests.filter(
                  (item) =>
                    item.status === "pending" &&
                    inPeriod(item.createdAt, startDate, endDate)
                ).length
              }
              note="Requests awaiting admin review"
            />
          </div>
        </div>

        <ReportTable
          headers={[
            "Worker",
            "Assignments",
            "Agreed salary",
            "Approved advances",
            "Salary paid",
            "Balance owed",
            "Action",
          ]}
          emptyMessage="No workers match your search."
        >
          {allWorkerSummaries.map((row) => (
            <tr
              key={row.worker.id}
              className={
                row.worker.id === selectedWorkerId
                  ? "bg-[#EAF4FF]"
                  : "bg-white hover:bg-[#F8FAFC]"
              }
            >
              <td className="px-4 py-4">
                <p className="font-bold text-[#172033]">
                  {personName(row.worker)}
                </p>
                <p className="mt-1 text-xs text-[#475467]">
                  {row.worker.employeeId || row.worker.email || "Staff member"}
                </p>
              </td>
              <td className="px-4 py-4 text-[#172033]">
                {row.assignments}
              </td>
              <td className="px-4 py-4">{moneyCell(row.salary)}</td>
              <td className="px-4 py-4">{moneyCell(row.advances)}</td>
              <td className="px-4 py-4">{moneyCell(row.paid)}</td>
              <td className="px-4 py-4 font-bold">
                <span
                  className={
                    row.balance > 0
                      ? "text-[#9A3412]"
                      : row.balance < 0
                        ? "text-[#9F1239]"
                        : "text-emerald-800"
                  }
                >
                  {currency(row.balance)}
                </span>
              </td>
              <td className="px-4 py-4">
                <button
                  type="button"
                  onClick={() => setSelectedWorkerId(row.worker.id)}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-[#1769E0] px-3 py-2 text-xs font-bold text-white hover:bg-[#0F3D70]"
                >
                  <FileText size={15} />
                  View report
                </button>
              </td>
            </tr>
          ))}
        </ReportTable>
      </Panel>

      {/* INDIVIDUAL WORKER REPORT */}
      {selectedWorker ? (
        <div className="space-y-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-bold text-[#172033]">
                Individual worker report
              </h2>
              <p className="mt-1 text-sm text-[#475467]">
                All sections below belong to {personName(selectedWorker)}.
              </p>
            </div>

            <button
              type="button"
              onClick={downloadWorkerReport}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#0F3D70]"
            >
              <Download size={18} />
              Download this worker's PDF
            </button>
          </div>

          <div id="worker-print-report" className="space-y-5">
            {/* Printable heading */}
            <div className="worker-print-heading hidden">
              <h1>Abes Power and Construction</h1>
              <h2>Individual Staff & Finance Report</h2>
              <p>
                Worker: <strong>{personName(selectedWorker)}</strong>
              </p>
              <p>
                Employee ID: {selectedWorker.employeeId || "Not recorded"}
              </p>
              <p>Email: {selectedWorker.email || "Not recorded"}</p>
              <p>Phone: {selectedWorker.phone || "Not recorded"}</p>
              <p>
                Reporting period: {startDate || "All available dates"} to{" "}
                {endDate || "Present"}
              </p>
              <p>Generated: {new Date().toLocaleString()}</p>
            </div>

            {/* Worker identity */}
            <section className="rounded-2xl border border-[#DCE5F0] bg-white p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-bold tracking-wider text-[#1769E0]">
                    STAFF MEMBER
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-[#172033]">
                    {personName(selectedWorker)}
                  </h2>
                  <p className="mt-2 text-sm text-[#344054]">
                    Employee ID: {selectedWorker.employeeId || "—"}
                  </p>
                  <p className="mt-1 text-sm text-[#344054]">
                    Email: {selectedWorker.email || "—"}
                  </p>
                  <p className="mt-1 text-sm text-[#344054]">
                    Phone: {selectedWorker.phone || "—"}
                  </p>
                </div>

                <div className="rounded-xl border border-[#DCE5F0] bg-[#F8FBFF] p-4 sm:min-w-52">
                  <p className="text-sm font-medium text-[#344054]">
                    Current salary balance
                  </p>
                  <p className="mt-2 text-2xl font-bold text-[#172033]">
                    {currency(totals.balance)}
                  </p>
                  <p className="mt-1 text-xs text-[#475467]">
                    Across this worker's salary records
                  </p>
                </div>
              </div>
            </section>

            {/* Financial and activity summary */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={Wallet}
                label="Agreed salaries"
                value={currency(totals.salaryTotal)}
                note="Total of current salary records"
              />
              <StatCard
                icon={Receipt}
                label="Approved advances"
                value={currency(totals.advances)}
                note="Allocated to salary records"
              />
              <StatCard
                icon={Banknote}
                label="Salary paid"
                value={currency(totals.paid)}
                note="Valid payments linked to salary records"
              />
              <StatCard
                icon={Activity}
                label="Outstanding balance"
                value={currency(totals.balance)}
                note="Salary less advances and payments"
              />
              <StatCard
                icon={BriefcaseBusiness}
                label="Assignments"
                value={totals.assignments}
                note={`${totals.completed} completed · ${totals.inProgress} in progress`}
              />
              <StatCard
                icon={Clock}
                label="Pending requests"
                value={totals.pendingRequests}
                note="Waiting for admin review"
              />
              <StatCard
                icon={Camera}
                label="Work submissions"
                value={totals.submissions}
                note={`${totals.pendingSubmissions} awaiting review`}
              />
              <StatCard
                icon={Receipt}
                label="Recorded expenses"
                value={currency(totals.expenseTotal)}
                note="Reported separately from salary deductions"
              />
            </div>

            {/* Salary breakdown */}
            <Panel
              title="1. Salary and outstanding balance"
              description="Each salary record is calculated separately to avoid mixing payments or advances between jobs."
            >
              <ReportTable
                headers={[
                  "Project / job",
                  "Agreed salary",
                  "Approved advances",
                  "Paid",
                  "Balance owed",
                ]}
                emptyMessage="No salary records found for this worker."
              >
                {workerSalaries.map((salary) => (
                  <tr key={salary.id}>
                    <td className="px-4 py-4 font-semibold text-[#172033]">
                      {salary.project?.name ||
                        salary.project?.service ||
                        salary.projectId ||
                        salary.assignmentId ||
                        "Unassigned job"}
                    </td>
                    <td className="px-4 py-4">
                      {moneyCell(salary.agreedSalary)}
                    </td>
                    <td className="px-4 py-4">
                      {moneyCell(salary.advances)}
                    </td>
                    <td className="px-4 py-4">
                      {moneyCell(salary.paid)}
                    </td>
                    <td className="px-4 py-4 font-bold">
                      {moneyCell(salary.balance)}
                    </td>
                  </tr>
                ))}
              </ReportTable>
            </Panel>

            {/* Requests */}
            <Panel
              title="2. Money requests"
              description="Requests submitted by this worker during the selected period."
            >
              <ReportTable
                headers={[
                  "Date",
                  "Request type",
                  "Project",
                  "Amount",
                  "Status",
                  "Reason",
                ]}
                emptyMessage="No money requests found for this worker in this period."
              >
                {workerRequests.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-4 py-4">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      {statusLabel(item.type)}
                    </td>
                    <td className="px-4 py-4">
                      {projectMap.get(item.projectId)?.name ||
                        projectMap.get(item.projectId)?.service ||
                        "—"}
                    </td>
                    <td className="px-4 py-4">{moneyCell(item.amount)}</td>
                    <td className="px-4 py-4">
                      <StatusBadge value={item.status} />
                    </td>
                    <td className="max-w-xs px-4 py-4 text-[#344054]">
                      {item.reason || item.description || item.notes || "—"}
                    </td>
                  </tr>
                ))}
              </ReportTable>
            </Panel>

            {/* Expenses */}
            <Panel
              title="3. Recorded expenses"
              description="Expenses assigned to this worker. These are reported separately because an expense may already be represented by a money request."
            >
              <div className="border-b border-[#DCE5F0] bg-[#F8FBFF] px-4 py-3">
                <p className="text-sm font-medium text-[#344054]">
                  Total recorded expenses:{" "}
                  <strong className="text-[#172033]">
                    {currency(totals.expenseTotal)}
                  </strong>
                </p>
              </div>

              <ReportTable
                headers={[
                  "Date",
                  "Category",
                  "Description",
                  "Project",
                  "Amount",
                  "Status",
                ]}
                emptyMessage="No recorded expenses found for this worker in this period."
              >
                {workerExpenses.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-4 py-4">
                      {formatDate(item.createdAt || item.expenseDate)}
                    </td>
                    <td className="px-4 py-4">
                      {statusLabel(item.category || item.type)}
                    </td>
                    <td className="max-w-xs px-4 py-4 text-[#344054]">
                      {item.description || item.notes || "—"}
                    </td>
                    <td className="px-4 py-4">
                      {projectMap.get(item.projectId)?.name ||
                        projectMap.get(item.projectId)?.service ||
                        "—"}
                    </td>
                    <td className="px-4 py-4">{moneyCell(item.amount)}</td>
                    <td className="px-4 py-4">
                      <StatusBadge value={item.status} />
                    </td>
                  </tr>
                ))}
              </ReportTable>
            </Panel>

            {/* Payments */}
            <Panel
              title="4. Salary payment history"
              description="Payments made to this worker during the selected period. Only payments linked to salary records are included in the salary balance calculation."
            >
              <ReportTable
                headers={[
                  "Payment date",
                  "Project",
                  "Amount",
                  "Method",
                  "Reference",
                  "Status",
                ]}
                emptyMessage="No salary payments found for this worker in this period."
              >
                {workerPayments.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-4 py-4">
                      {formatDate(item.paymentDate || item.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      {projectMap.get(item.projectId)?.name ||
                        projectMap.get(item.projectId)?.service ||
                        workerSalaries.find(
                          (salary) => salary.id === item.salaryId
                        )?.project?.name ||
                        "—"}
                    </td>
                    <td className="px-4 py-4">{moneyCell(item.amount)}</td>
                    <td className="px-4 py-4">
                      {item.method || item.paymentMethod || "—"}
                    </td>
                    <td className="px-4 py-4">
                      {item.reference || item.receiptNumber || "—"}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge value={item.status || "recorded"} />
                    </td>
                  </tr>
                ))}
              </ReportTable>
            </Panel>

            {/* Assignments */}
            <Panel
              title="5. Assigned jobs and progress"
              description="Jobs assigned to this worker in the selected reporting period."
            >
              <ReportTable
                headers={[
                  "Project",
                  "Start date",
                  "Expected completion",
                  "Status",
                  "Notes",
                ]}
                emptyMessage="No assignments found for this worker in this period."
              >
                {workerAssignments.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-4 font-semibold text-[#172033]">
                      {projectMap.get(item.projectId)?.name ||
                        projectMap.get(item.projectId)?.service ||
                        item.projectId ||
                        "Unknown project"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      {formatDate(item.startDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      {formatDate(item.expectedCompletion)}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge value={item.status} />
                    </td>
                    <td className="px-4 py-4 text-[#344054]">
                      {item.notes || item.description || "—"}
                    </td>
                  </tr>
                ))}
              </ReportTable>
            </Panel>

            {/* Work submissions */}
            <Panel
              title="6. Work submissions and reviews"
              description="Work evidence and review statuses submitted by this worker."
            >
              <ReportTable
                headers={[
                  "Submission date",
                  "Project",
                  "Comment",
                  "Review status",
                ]}
                emptyMessage="No work submissions found for this worker in this period."
              >
                {workerSubmissions.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-4 py-4">
                      {formatDate(item.createdAt || item.submittedAt)}
                    </td>
                    <td className="px-4 py-4">
                      {projectMap.get(item.projectId)?.name ||
                        projectMap.get(item.projectId)?.service ||
                        "—"}
                    </td>
                    <td className="max-w-sm px-4 py-4 text-[#344054]">
                      {item.comment || item.description || "No comment"}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge value={item.status} />
                    </td>
                  </tr>
                ))}
              </ReportTable>
            </Panel>

            {/* Financial notes */}
            <section className="rounded-2xl border border-[#DCE5F0] bg-white p-5">
              <h2 className="font-bold text-[#172033]">
                Important financial notes
              </h2>

              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#344054]">
                <li>
                  Salary balance = agreed salary − approved advances − valid
                  payments linked to that salary.
                </li>
                <li>
                  Expenses are shown separately and are not automatically
                  deducted from salary.
                </li>
                <li>
                  Approved requests may not have been paid out yet. Approval
                  alone does not prove disbursement.
                </li>
                <li>
                  The date range filters activity records, but the salary
                  balance shows the current balance across the full history.
                </li>
                <li>
                  An advance without an assignment ID is allocated only when
                  there is exactly one matching assignment for that worker and
                  project. Unmatched legacy requests may not appear in the
                  salary deduction total.
                </li>
              </ul>
            </section>

            <footer className="worker-print-footer hidden">
              Abes Power and Construction · Confidential staff report ·{" "}
              {new Date().toLocaleString()}
            </footer>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#B8C7D9] bg-white px-6 py-12 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF4FF] text-[#1769E0]">
            <FileText size={27} />
          </span>
          <h2 className="mt-4 text-lg font-bold text-[#172033]">
            Select a worker to view their report
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#475467]">
            Choose a worker from the selector above or click View report in the
            worker overview. The individual report will show only that worker's
            records and can be printed or saved as a PDF.
          </p>
        </div>
      )}

      <style jsx global>{`
        /* Improve readable text colors on the regular screen. */
        #worker-print-report {
          color: #172033;
        }

        #worker-print-report p,
        #worker-print-report td,
        #worker-print-report th,
        #worker-print-report li {
          -webkit-text-fill-color: currentColor;
        }

        /* Do not let global dashboard print styles affect this report. */
        @media print {
          @page {
            size: A4 landscape;
            margin: 12mm;
          }

          html,
          body {
            background: #ffffff !important;
            color: #172033 !important;
            font-family: Arial, Helvetica, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * {
            visibility: hidden !important;
          }

          #worker-print-report,
          #worker-print-report * {
            visibility: visible !important;
          }

          #worker-print-report {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
            color: #172033 !important;
            background: #ffffff !important;
            font-size: 10px !important;
          }

          #worker-print-report .worker-print-heading {
            display: block !important;
            margin-bottom: 18px !important;
            color: #172033 !important;
          }

          #worker-print-report .worker-print-heading h1 {
            margin-bottom: 5px !important;
            color: #172033 !important;
            font-size: 21px !important;
            font-weight: 700 !important;
          }

          #worker-print-report .worker-print-heading h2 {
            margin-bottom: 10px !important;
            color: #172033 !important;
            font-size: 16px !important;
            font-weight: 700 !important;
          }

          #worker-print-report .worker-print-heading p {
            margin-top: 3px !important;
            color: #172033 !important;
            font-size: 10px !important;
          }

          #worker-print-report .worker-print-footer {
            display: block !important;
            margin-top: 18px !important;
            border-top: 1px solid #cbd5e1 !important;
            padding-top: 8px !important;
            color: #344054 !important;
            font-size: 9px !important;
          }

          #worker-print-report section,
          #worker-print-report .rounded-2xl {
            overflow: visible !important;
            box-shadow: none !important;
            break-inside: auto !important;
          }

          #worker-print-report .grid {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          #worker-print-report table {
            width: 100% !important;
            min-width: 0 !important;
            border-collapse: collapse !important;
            font-size: 9px !important;
          }

          #worker-print-report thead {
            display: table-header-group !important;
          }

          #worker-print-report tr {
            break-inside: avoid !important;
          }

          #worker-print-report th,
          #worker-print-report td {
            padding: 6px !important;
            color: #172033 !important;
            background-color: #ffffff !important;
            border: 1px solid #cbd5e1 !important;
            overflow-wrap: anywhere !important;
            -webkit-text-fill-color: #172033 !important;
          }

          #worker-print-report thead th {
            background-color: #eaf4ff !important;
            color: #172033 !important;
            font-weight: 700 !important;
          }

          #worker-print-report p,
          #worker-print-report span,
          #worker-print-report li,
          #worker-print-report strong,
          #worker-print-report h2 {
            color: #172033 !important;
            -webkit-text-fill-color: #172033 !important;
            opacity: 1 !important;
          }

          #worker-print-report .text-emerald-800 {
            color: #065f46 !important;
            -webkit-text-fill-color: #065f46 !important;
          }

          #worker-print-report .text-amber-900 {
            color: #78350f !important;
            -webkit-text-fill-color: #78350f !important;
          }

          #worker-print-report .text-red-800 {
            color: #991b1b !important;
            -webkit-text-fill-color: #991b1b !important;
          }

          #worker-print-report .text-[#9A3412],
          #worker-print-report .text-[#9F1239] {
            color: #172033 !important;
            -webkit-text-fill-color: #172033 !important;
          }

          /* Hide all dashboard controls and the all-workers overview. */
          body > * {
            visibility: hidden !important;
          }

          nav,
          aside,
          button,
          input,
          select,
          label {
            display: none !important;
          }

          #worker-print-report button,
          #worker-print-report input,
          #worker-print-report select {
            display: none !important;
          }

          a {
            color: #172033 !important;
            text-decoration: none !important;
          }
        }
      `}</style>
    </main>
  );
}
