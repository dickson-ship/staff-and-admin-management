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

const SETTLED_ADVANCE_STATUSES = new Set([
  "paid",
  "disbursed",
  "issued",
  "released",
  "completed",
  "complete",
]);

const VALID_PAYMENT_STATUSES = new Set([
  "paid",
  "completed",
  "complete",
  "recorded",
  "confirmed",
  "successful",
  "success",
  "disbursed",
]);

const INVALID_TRANSACTION_STATUSES = new Set([
  "void",
  "voided",
  "cancelled",
  "canceled",
  "rejected",
  "declined",
]);

const PENDING_PAYMENT_STATUSES = new Set([
  "pending",
  "processing",
  "draft",
  "unpaid",
  "awaiting-payment",
  "awaiting-approval",
]);

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

function normalizeStatus(value) {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");
}

function statusLabel(value) {
  return String(value || "unknown")
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function personName(worker) {
  if (!worker) return "Unknown worker";

  return (
    worker.name ||
    `${worker.firstName || ""} ${worker.lastName || ""}`.trim() ||
    worker.fullName ||
    worker.email ||
    "Unknown worker"
  );
}

function inPeriod(value, start, end) {
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

function amountOf(record, ...fields) {
  for (const field of fields) {
    const value = record?.[field];

    if (value !== undefined && value !== null && value !== "") {
      const amount = Number(value);
      return Number.isFinite(amount) ? amount : 0;
    }
  }

  return 0;
}

function isInvalidTransaction(record) {
  const status = normalizeStatus(record?.status);
  return INVALID_TRANSACTION_STATUSES.has(status);
}

/**
 * An approved request is not necessarily money that has been issued.
 *
 * This checks common fields so the report can support existing documents
 * that already track disbursement in different ways.
 *
 * To count an advance, use a settled status such as "disbursed" or set
 * disbursedAt / issuedAt / paidAt when the money is actually handed over.
 */
function isRequestDisbursed(request) {
  if (!request) return false;

  if (
    request.isDisbursed === true ||
    request.disbursed === true ||
    request.isPaid === true ||
    request.paid === true
  ) {
    return true;
  }

  const statusFields = [
    request.disbursementStatus,
    request.payoutStatus,
    request.paymentStatus,
    request.status,
  ];

  if (
    statusFields.some((value) =>
      SETTLED_ADVANCE_STATUSES.has(normalizeStatus(value))
    )
  ) {
    return true;
  }

  return Boolean(
    request.disbursedAt ||
      request.issuedAt ||
      request.paidAt ||
      request.releasedAt
  );
}

function requestDisplayStatus(request) {
  if (isRequestDisbursed(request)) return "Disbursed";

  if (normalizeStatus(request?.status) === "approved") {
    return "Approved — not issued";
  }

  return statusLabel(request?.status);
}

/**
 * Recorded payments with no status are treated as valid because the
 * workerPayments collection is used for payments actually recorded by admin.
 *
 * Explicit pending, draft, void, rejected or cancelled payments are not
 * deducted from the outstanding salary balance.
 */
function isPaymentCountable(payment) {
  if (!payment || isInvalidTransaction(payment)) return false;

  const status = normalizeStatus(payment.status);

  if (PENDING_PAYMENT_STATUSES.has(status)) return false;

  if (!payment.status) return true;

  return VALID_PAYMENT_STATUSES.has(status);
}

function isExpenseCountable(expense) {
  return Boolean(expense) && !isInvalidTransaction(expense);
}

function personRecordWorkerId(record, assignmentMap) {
  if (record?.workerId) return record.workerId;
  if (record?.staffId) return record.staffId;

  const assignmentId = record?.assignmentId;
  if (assignmentId) {
    return assignmentMap.get(assignmentId)?.workerId || null;
  }

  return null;
}

function projectIdForAssignment(assignment, projectMap) {
  if (!assignment) return null;

  const directProjectId =
    assignment.projectId || assignment.projectID || assignment.jobId;

  if (directProjectId) return directProjectId;

  const project = projectMap.get(assignment.projectRef);
  return project?.id || null;
}

function projectIdForSalary(salary, assignmentMap, projectMap) {
  if (salary?.projectId || salary?.projectID || salary?.jobId) {
    return salary.projectId || salary.projectID || salary.jobId;
  }

  const assignment = assignmentMap.get(salary?.assignmentId);
  return projectIdForAssignment(assignment, projectMap);
}

function projectIdForRecord(record, assignmentMap, projectMap) {
  const directProjectId =
    record?.projectId || record?.projectID || record?.jobId;

  if (directProjectId) return directProjectId;

  const assignment = assignmentMap.get(record?.assignmentId);
  return projectIdForAssignment(assignment, projectMap);
}

function salaryAmount(salary) {
  return amountOf(salary, "agreedSalary", "salaryAmount", "amount", "salary");
}

/**
 * Determines whether an advance, payment or expense belongs to one salary
 * record.
 *
 * Direct salaryId matches take priority. Assignment matches are next.
 * If only a project is available, the record is attributed only when there
 * is one matching assignment and one matching salary record for that worker
 * and project. This avoids assigning one transaction to multiple jobs.
 */
function recordMatchesSalary(record, salary, context) {
  const {
    salaries,
    assignments,
    assignmentMap,
    projectMap,
  } = context;

  if (!record || !salary) return false;

  if (
    record.salaryId &&
    String(record.salaryId) !== String(salary.id)
  ) {
    return false;
  }

  const recordAssignmentId = record.assignmentId || null;
  const salaryAssignmentId = salary.assignmentId || null;

  const recordWorkerId = personRecordWorkerId(record, assignmentMap);

  if (
    recordWorkerId &&
    salary.workerId &&
    String(recordWorkerId) !== String(salary.workerId)
  ) {
    return false;
  }

  if (
    record.workerId &&
    salary.workerId &&
    String(record.workerId) !== String(salary.workerId)
  ) {
    return false;
  }

  if (recordAssignmentId && salaryAssignmentId) {
    return (
      String(recordAssignmentId) === String(salaryAssignmentId) &&
      (!recordWorkerId ||
        String(recordWorkerId) === String(salary.workerId))
    );
  }

  const salaryProjectId = projectIdForSalary(
    salary,
    assignmentMap,
    projectMap
  );

  const recordProjectId = projectIdForRecord(
    record,
    assignmentMap,
    projectMap
  );

  if (
    !salaryProjectId ||
    !recordProjectId ||
    String(salaryProjectId) !== String(recordProjectId)
  ) {
    return false;
  }

  if (
    recordWorkerId &&
    salary.workerId &&
    String(recordWorkerId) !== String(salary.workerId)
  ) {
    return false;
  }

  const assignmentsForProject = assignments.filter((assignment) => {
    const assignmentProjectId = projectIdForAssignment(
      assignment,
      projectMap
    );

    return (
      String(assignment.workerId || "") === String(salary.workerId || "") &&
      String(assignmentProjectId || "") === String(salaryProjectId)
    );
  });

  const salariesForProject = salaries.filter((item) => {
    const itemProjectId = projectIdForSalary(
      item,
      assignmentMap,
      projectMap
    );

    return (
      String(item.workerId || "") === String(salary.workerId || "") &&
      String(itemProjectId || "") === String(salaryProjectId)
    );
  });

  if (
    assignmentsForProject.length !== 1 ||
    salariesForProject.length !== 1
  ) {
    return false;
  }

  if (recordAssignmentId) {
    return (
      String(assignmentsForProject[0].id) ===
      String(recordAssignmentId)
    );
  }

  return true;
}

/**
 * Avoid deducting the same amount twice when an issued money request also
 * has an expense record documenting that same advance.
 *
 * If an expense is explicitly linked to a disbursed request, the request is
 * counted as the advance and that duplicate expense is excluded.
 */
function expenseLinkedRequestId(expense) {
  return (
    expense.moneyRequestId ||
    expense.requestId ||
    expense.sourceRequestId ||
    expense.advanceRequestId ||
    expense.relatedRequestId ||
    null
  );
}

function isSalaryDeductibleExpense(expense, issuedRequestIds) {
  if (!isExpenseCountable(expense)) return false;

  const linkedRequestId = expenseLinkedRequestId(expense);

  if (
    linkedRequestId &&
    issuedRequestIds.has(String(linkedRequestId))
  ) {
    return false;
  }

  const categoryText = [
    expense.category,
    expense.type,
    expense.expenseType,
    expense.sourceType,
    expense.transactionType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll("-", " ");

  // Advance/request entries should be counted from the request record,
  // rather than being deducted a second time as an expense.
  if (
    /\badvance\b/.test(categoryText) ||
    /\bmoney request\b/.test(categoryText) ||
    /\bcash request\b/.test(categoryText)
  ) {
    return false;
  }

  // Honour an explicit admin decision where present.
  const deductionFlags = [
    expense.salaryDeductible,
    expense.deductFromSalary,
    expense.chargeToWorker,
    expense.deductible,
  ];

  const explicitFlag = deductionFlags.find(
    (value) => typeof value === "boolean"
  );

  if (typeof explicitFlag === "boolean") {
    return explicitFlag;
  }

  // Default: ordinary expenses linked to the worker's job are deductible.
  return true;
}

/**
 * Calculates one salary row using all available history, regardless of
 * the selected activity date filter.
 */
function calculateSalaryRow(salary, context) {
  const {
    requests,
    expenses,
    payments,
    assignmentMap,
    projectMap,
  } = context;

  const salaryProjectId = projectIdForSalary(
    salary,
    assignmentMap,
    projectMap
  );

  const matchingAssignments = context.assignments.filter((assignment) => {
    return (
      String(assignment.workerId || "") === String(salary.workerId || "") &&
      String(
        projectIdForAssignment(assignment, projectMap) || ""
      ) === String(salaryProjectId || "")
    );
  });

  const issuedRequests = requests.filter(
    (request) =>
      isRequestDisbursed(request) &&
      recordMatchesSalary(request, salary, context)
  );

  const advances = issuedRequests.reduce(
    (sum, request) => sum + amountOf(request, "amount", "requestedAmount"),
    0
  );

  const issuedRequestIds = new Set(
    issuedRequests.map((request) => String(request.id))
  );

  const deductibleExpenses = expenses.filter((expense) => {
    if (!isExpenseCountable(expense)) return false;

    if (!recordMatchesSalary(expense, salary, context)) return false;

    return isSalaryDeductibleExpense(expense, issuedRequestIds);
  });

  const expensesDeducted = deductibleExpenses.reduce(
    (sum, expense) => sum + amountOf(expense, "amount", "total"),
    0
  );

  const validPayments = payments.filter(
    (payment) =>
      isPaymentCountable(payment) &&
      recordMatchesSalary(payment, salary, context)
  );

  const paid = validPayments.reduce(
    (sum, payment) =>
      sum + amountOf(payment, "amount", "paidAmount", "paymentAmount"),
    0
  );

  const agreedSalary = salaryAmount(salary);

  return {
    ...salary,
    projectId: salaryProjectId,
    project: projectMap.get(salaryProjectId),
    agreedSalary,
    advances,
    expensesDeducted,
    paid,
    balance: agreedSalary - advances - expensesDeducted - paid,
    matchingAssignments,
  };
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
  const normalized = normalizeStatus(value);

  let color = "bg-gray-100 text-gray-800";

  if (
    [
      "approved",
      "completed",
      "complete",
      "active",
      "paid",
      "accepted",
      "disbursed",
      "recorded",
      "confirmed",
      "successful",
    ].includes(normalized)
  ) {
    color = "bg-emerald-100 text-emerald-800";
  } else if (
    [
      "pending",
      "assigned",
      "in-progress",
      "submitted",
      "processing",
      "approved-not-issued",
    ].includes(normalized)
  ) {
    color = "bg-amber-100 text-amber-900";
  } else if (
    [
      "rejected",
      "cancelled",
      "canceled",
      "declined",
      "void",
      "voided",
    ].includes(normalized)
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

function ReportTable({
  headers,
  children,
  emptyMessage = "No records found.",
}) {
  const isEmpty =
    !children || (Array.isArray(children) && children.length === 0);

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
    const errors = new Map();
    const unsubscribers = [];
    let active = true;

    for (const [key, collectionName] of REPORT_SOURCES) {
      const unsubscribe = onSnapshot(
        collection(db, collectionName),
        (snapshot) => {
          if (!active) return;

          setData((current) => ({
            ...current,
            [key]: snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            })),
          }));

          firstSnapshots.add(key);
          errors.delete(collectionName);

          if (firstSnapshots.size === REPORT_SOURCES.length) {
            setLoading(false);
          }

          if (errors.size === 0) {
            setError("");
          }
        },
        (err) => {
          if (!active) return;

          console.error(
            `Report loading error (${collectionName}):`,
            err
          );

          errors.set(
            collectionName,
            err.code === "permission-denied"
              ? `Access denied to "${collectionName}". Check the Firestore security rules.`
              : `Unable to load "${collectionName}". Some report figures may be incomplete.`
          );

          setError([...errors.values()].join(" "));
          setLoading(false);
        }
      );

      unsubscribers.push(unsubscribe);
    }

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
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
    () =>
      new Map(
        data.assignments.map((assignment) => [
          assignment.id,
          assignment,
        ])
      ),
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

  const salaryCalculationContext = useMemo(
    () => ({
      salaries: data.salaries,
      requests: data.requests,
      expenses: data.expenses,
      payments: data.payments,
      assignments: data.assignments,
      assignmentMap,
      projectMap,
    }),
    [
      data.salaries,
      data.requests,
      data.expenses,
      data.payments,
      data.assignments,
      assignmentMap,
      projectMap,
    ]
  );

  // Calculate each salary consistently so the overview and individual report
  // always use the same matching and deduction rules.
  const allSalaryRows = useMemo(
    () =>
      data.salaries.map((salary) =>
        calculateSalaryRow(salary, salaryCalculationContext)
      ),
    [data.salaries, salaryCalculationContext]
  );

  const workerSalaries = useMemo(
    () =>
      allSalaryRows.filter(
        (salary) => salary.workerId === selectedWorkerId
      ),
    [allSalaryRows, selectedWorkerId]
  );

  // Activity tables use the selected date filter. Salary balances above use
  // the worker's full salary history.
  const workerAssignments = useMemo(
    () =>
      data.assignments.filter(
        (item) =>
          item.workerId === selectedWorkerId &&
          inPeriod(
            item.createdAt || item.startDate,
            startDate,
            endDate
          )
      ),
    [data.assignments, selectedWorkerId, startDate, endDate]
  );

  const workerRequests = useMemo(
    () =>
      data.requests.filter(
        (item) =>
          item.workerId === selectedWorkerId &&
          inPeriod(
            item.createdAt || item.requestedAt,
            startDate,
            endDate
          )
      ),
    [data.requests, selectedWorkerId, startDate, endDate]
  );

  const workerExpenses = useMemo(
    () =>
      data.expenses.filter(
        (item) =>
          personRecordWorkerId(item, assignmentMap) === selectedWorkerId &&
          isExpenseCountable(item) &&
          inPeriod(
            item.createdAt || item.expenseDate,
            startDate,
            endDate
          )
      ),
    [
      data.expenses,
      assignmentMap,
      selectedWorkerId,
      startDate,
      endDate,
    ]
  );

  const workerPayments = useMemo(
    () =>
      data.payments.filter(
        (item) =>
          personRecordWorkerId(item, assignmentMap) === selectedWorkerId &&
          !isInvalidTransaction(item) &&
          inPeriod(
            item.paymentDate || item.createdAt,
            startDate,
            endDate
          )
      ),
    [
      data.payments,
      assignmentMap,
      selectedWorkerId,
      startDate,
      endDate,
    ]
  );

  const workerSubmissions = useMemo(
    () =>
      data.submissions.filter(
        (item) =>
          item.workerId === selectedWorkerId &&
          inPeriod(
            item.createdAt || item.submittedAt,
            startDate,
            endDate
          )
      ),
    [data.submissions, selectedWorkerId, startDate, endDate]
  );

  const totals = useMemo(() => {
    const salaryTotal = workerSalaries.reduce(
      (sum, item) => sum + item.agreedSalary,
      0
    );

    const advances = workerSalaries.reduce(
      (sum, item) => sum + item.advances,
      0
    );

    const expensesDeducted = workerSalaries.reduce(
      (sum, item) => sum + item.expensesDeducted,
      0
    );

    const paid = workerSalaries.reduce(
      (sum, item) => sum + item.paid,
      0
    );

    const balance = workerSalaries.reduce(
      (sum, item) => sum + item.balance,
      0
    );

    const pendingRequests = workerRequests.filter(
      (item) => normalizeStatus(item.status) === "pending"
    ).length;

    const expenseTotal = workerExpenses.reduce(
      (sum, item) => sum + amountOf(item, "amount", "total"),
      0
    );

    return {
      assignments: workerAssignments.length,
      completed: workerAssignments.filter(
        (item) => normalizeStatus(item.status) === "completed"
      ).length,
      inProgress: workerAssignments.filter((item) =>
        ["in-progress", "in-progress"].includes(
          normalizeStatus(item.status)
        )
      ).length,
      pendingRequests,
      salaryTotal,
      advances,
      expensesDeducted,
      paid,
      balance,
      submissions: workerSubmissions.length,
      pendingSubmissions: workerSubmissions.filter(
        (item) =>
          ["pending", "submitted"].includes(
            normalizeStatus(item.reviewStatus || item.status)
          )
      ).length,
      expenseTotal,
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
      const salaries = allSalaryRows.filter(
        (salary) => salary.workerId === worker.id
      );

      const totalSalary = salaries.reduce(
        (sum, salary) => sum + salary.agreedSalary,
        0
      );

      const advances = salaries.reduce(
        (sum, salary) => sum + salary.advances,
        0
      );

      const expensesDeducted = salaries.reduce(
        (sum, salary) => sum + salary.expensesDeducted,
        0
      );

      const totalPaid = salaries.reduce(
        (sum, salary) => sum + salary.paid,
        0
      );

      const assignmentCount = data.assignments.filter(
        (item) =>
          item.workerId === worker.id &&
          inPeriod(
            item.createdAt || item.startDate,
            startDate,
            endDate
          )
      ).length;

      return {
        worker,
        salary: totalSalary,
        advances,
        expensesDeducted,
        paid: totalPaid,
        balance: totalSalary - advances - expensesDeducted - totalPaid,
        assignments: assignmentCount,
      };
    });
  }, [
    visibleWorkers,
    allSalaryRows,
    data.assignments,
    startDate,
    endDate,
  ]);

  const filteredAssignmentCount = useMemo(
    () =>
      data.assignments.filter((item) =>
        inPeriod(
          item.createdAt || item.startDate,
          startDate,
          endDate
        )
      ).length,
    [data.assignments, startDate, endDate]
  );

  const filteredPendingRequests = useMemo(
    () =>
      data.requests.filter(
        (item) =>
          normalizeStatus(item.status) === "pending" &&
          inPeriod(
            item.createdAt || item.requestedAt,
            startDate,
            endDate
          )
      ).length,
    [data.requests, startDate, endDate]
  );

  function downloadWorkerReport() {
    if (!selectedWorker) return;

    const safeName = personName(selectedWorker)
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "");

    const previousTitle = document.title;

    document.title =
      `Abes-Worker-Report-${safeName}-${startDate || "all-time"}-${endDate || "present"}`;

    window.print();

    // Restore the original title after the browser has opened the print
    // dialogue. A short timeout is not required for the print operation.
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 1000);
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
            Review staff assignments, money requests, job expenses, salary
            payments, outstanding balances, and submitted work.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-[#DCE5F0] bg-white px-4 py-3 text-sm text-[#172033]">
          <Users size={19} className="text-[#1769E0]" />
          <span className="font-semibold">
            {data.workers.length} workers
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">
            Some report data could not be loaded.
          </p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* FILTERS */}
      <Panel
        title="Report filters"
        description="Choose a worker and reporting period. Salary balances show the current balance across the full salary history."
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
              {visibleWorkers.map((worker) => (
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
            Activity tables use the selected date range. Salary balances use
            full-history issued advances, eligible expenses, and valid
            salary payments.
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
        description="Review each worker's current salary balance, including issued advances and eligible expenses. Select View report for a detailed breakdown."
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
              value={filteredAssignmentCount}
              note="Assignments in the selected period"
            />

            <StatCard
              icon={Clock}
              label="Pending requests"
              value={filteredPendingRequests}
              note="Requests awaiting admin review"
            />
          </div>
        </div>

        <ReportTable
          headers={[
            "Worker",
            "Assignments",
            "Agreed salary",
            "Issued advances",
            "Job expenses deducted",
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
                  {row.worker.employeeId ||
                    row.worker.email ||
                    "Staff member"}
                </p>
              </td>

              <td className="px-4 py-4">{row.assignments}</td>

              <td className="px-4 py-4">{moneyCell(row.salary)}</td>

              <td className="px-4 py-4">{moneyCell(row.advances)}</td>

              <td className="px-4 py-4">
                {moneyCell(row.expensesDeducted)}
              </td>

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
              Print / Save as PDF
            </button>
          </div>

          <div id="worker-print-report" className="space-y-5">
            {/* PRINTABLE HEADING */}
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

            {/* WORKER IDENTITY */}
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

            {/* FINANCIAL AND ACTIVITY SUMMARY */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                icon={Wallet}
                label="Agreed salaries"
                value={currency(totals.salaryTotal)}
                note="Total agreed salary across all salary records"
              />

              <StatCard
                icon={Banknote}
                label="Issued advances"
                value={currency(totals.advances)}
                note="Requests confirmed as issued or paid"
              />

              <StatCard
                icon={Receipt}
                label="Job expenses deducted"
                value={currency(totals.expensesDeducted)}
                note="Eligible job expenses after duplicate checks"
              />

              <StatCard
                icon={Banknote}
                label="Salary paid"
                value={currency(totals.paid)}
                note="Valid salary payments attributed to this worker"
              />

              <StatCard
                icon={Activity}
                label="Outstanding balance"
                value={currency(totals.balance)}
                note="Salary less advances, eligible expenses, and payments"
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
                note="Requests waiting for admin review"
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
                note="Valid expenses recorded in the selected period"
              />
            </div>

            {/* SALARY BREAKDOWN */}
            <Panel
              title="1. Salary and outstanding balance"
              description="Each salary record is calculated separately. Transactions are attributed to a job where possible to prevent mixing amounts between assignments."
            >
              <ReportTable
                headers={[
                  "Project / job",
                  "Agreed salary",
                  "Issued advances",
                  "Job expenses deducted",
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
                        salary.project?.title ||
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
                      {moneyCell(salary.expensesDeducted)}
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

              <div className="border-t border-[#DCE5F0] bg-[#F8FBFF] px-5 py-4">
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <p className="text-[#475467]">Agreed salary</p>
                    <p className="mt-1 font-bold">
                      {currency(totals.salaryTotal)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[#475467]">Issued advances</p>
                    <p className="mt-1 font-bold">
                      {currency(totals.advances)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[#475467]">Eligible expenses</p>
                    <p className="mt-1 font-bold">
                      {currency(totals.expensesDeducted)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[#475467]">Salary paid</p>
                    <p className="mt-1 font-bold">
                      {currency(totals.paid)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[#475467]">Current balance</p>
                    <p className="mt-1 font-bold text-[#1769E0]">
                      {currency(totals.balance)}
                    </p>
                  </div>
                </div>
              </div>
            </Panel>

            {/* MONEY REQUESTS */}
            <Panel
              title="2. Money requests"
              description="Approved requests are not automatically treated as issued advances. The report checks disbursement fields before deducting an advance from salary."
            >
              <ReportTable
                headers={[
                  "Date",
                  "Request type",
                  "Project",
                  "Amount",
                  "Request / disbursement status",
                  "Reason",
                ]}
                emptyMessage="No money requests found for this worker in this period."
              >
                {workerRequests.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-4 py-4">
                      {formatDate(item.createdAt || item.requestedAt)}
                    </td>

                    <td className="px-4 py-4">
                      {statusLabel(item.type || item.category)}
                    </td>

                    <td className="px-4 py-4">
                      {projectMap.get(item.projectId)?.name ||
                        projectMap.get(item.projectId)?.service ||
                        projectMap.get(item.projectId)?.title ||
                        "—"}
                    </td>

                    <td className="px-4 py-4">
                      {moneyCell(
                        amountOf(item, "amount", "requestedAmount")
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge value={requestDisplayStatus(item)} />
                    </td>

                    <td className="max-w-xs px-4 py-4 text-[#344054]">
                      {item.reason || item.description || item.notes || "—"}
                    </td>
                  </tr>
                ))}
              </ReportTable>
            </Panel>

            {/* RECORDED EXPENSES */}
            <Panel
              title="3. Recorded expenses"
              description="This table shows valid expense records in the selected period. Only expenses attributed to a salary record are deducted from that salary; expenses linked to an already-counted issued advance are excluded from the deduction to avoid double-counting."
            >
              <div className="border-b border-[#DCE5F0] bg-[#F8FBFF] px-4 py-3">
                <p className="text-sm font-medium text-[#344054]">
                  Recorded expenses in this period:{" "}
                  <strong className="text-[#172033]">
                    {currency(totals.expenseTotal)}
                  </strong>
                </p>

                <p className="mt-1 text-xs leading-5 text-[#475467]">
                  Salary-deductible expenses across the full salary history:{" "}
                  <strong>{currency(totals.expensesDeducted)}</strong>
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
                        projectMap.get(item.projectId)?.title ||
                        "—"}
                    </td>

                    <td className="px-4 py-4">
                      {moneyCell(amountOf(item, "amount", "total"))}
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge value={item.status || "recorded"} />
                    </td>
                  </tr>
                ))}
              </ReportTable>
            </Panel>

            {/* SALARY PAYMENT HISTORY */}
            <Panel
              title="4. Salary payment history"
              description="Only valid payments are deducted from the salary balance. Pending or void payment records remain visible here where applicable but are not counted as completed payments."
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
                {workerPayments.map((item) => {
                  const linkedSalary = workerSalaries.find(
                    (salary) =>
                      (item.salaryId &&
                        String(salary.id) === String(item.salaryId)) ||
                      (item.assignmentId &&
                        salary.assignmentId &&
                        String(salary.assignmentId) ===
                          String(item.assignmentId))
                  );

                  const paymentProjectId =
                    item.projectId ||
                    item.projectID ||
                    linkedSalary?.projectId;

                  const paymentIsCounted = isPaymentCountable(item);

                  return (
                    <tr key={item.id}>
                      <td className="whitespace-nowrap px-4 py-4">
                        {formatDate(item.paymentDate || item.createdAt)}
                      </td>

                      <td className="px-4 py-4">
                        {projectMap.get(paymentProjectId)?.name ||
                          projectMap.get(paymentProjectId)?.service ||
                          projectMap.get(paymentProjectId)?.title ||
                          linkedSalary?.project?.name ||
                          "—"}
                      </td>

                      <td className="px-4 py-4">
                        {moneyCell(
                          amountOf(
                            item,
                            "amount",
                            "paidAmount",
                            "paymentAmount"
                          )
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {item.method || item.paymentMethod || "—"}
                      </td>

                      <td className="px-4 py-4">
                        {item.reference || item.receiptNumber || "—"}
                      </td>

                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <StatusBadge
                            value={item.status || "recorded"}
                          />

                          {!paymentIsCounted && (
                            <p className="text-xs text-[#475467]">
                              Not deducted from salary
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </ReportTable>
            </Panel>

            {/* ASSIGNMENTS */}
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
                {workerAssignments.map((item) => {
                  const projectId =
                    item.projectId || item.projectID || item.jobId;
                  const project = projectMap.get(projectId);

                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-4 font-semibold text-[#172033]">
                        {project?.name ||
                          project?.service ||
                          project?.title ||
                          projectId ||
                          "Unknown project"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        {formatDate(item.startDate)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        {formatDate(
                          item.expectedCompletion || item.deadline
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge value={item.status} />
                      </td>

                      <td className="px-4 py-4 text-[#344054]">
                        {item.notes || item.description || "—"}
                      </td>
                    </tr>
                  );
                })}
              </ReportTable>
            </Panel>

            {/* WORK SUBMISSIONS */}
            <Panel
              title="6. Work submissions and reviews"
              description="Submission review status takes priority over the general submission status when it is available."
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
                {workerSubmissions.map((item) => {
                  const submissionProjectId =
                    item.projectId || item.projectID || item.jobId;

                  return (
                    <tr key={item.id}>
                      <td className="whitespace-nowrap px-4 py-4">
                        {formatDate(item.createdAt || item.submittedAt)}
                      </td>

                      <td className="px-4 py-4">
                        {projectMap.get(submissionProjectId)?.name ||
                          projectMap.get(submissionProjectId)?.service ||
                          projectMap.get(submissionProjectId)?.title ||
                          "—"}
                      </td>

                      <td className="max-w-sm px-4 py-4 text-[#344054]">
                        {item.comment ||
                          item.description ||
                          item.notes ||
                          "No comment"}
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge
                          value={item.reviewStatus || item.status}
                        />
                      </td>
                    </tr>
                  );
                })}
              </ReportTable>
            </Panel>

            {/* FINANCIAL NOTES */}
            <section className="rounded-2xl border border-[#DCE5F0] bg-white p-5">
              <h2 className="font-bold text-[#172033]">
                Important financial notes
              </h2>

              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#344054]">
                <li>
                  Salary balance = agreed salary − issued advances −
                  salary-deductible expenses − valid salary payments.
                </li>

                <li>
                  A request with status "approved" is not counted as an
                  advance unless the record also confirms that the money was
                  issued or paid.
                </li>

                <li>
                  When money is issued, update the money request with a
                  disbursement status such as "disbursed", or set a field such
                  as "disbursedAt". The report recognizes common disbursement
                  fields, including "issuedAt" and "paidAt".
                </li>

                <li>
                  For reliable matching, record the relevant worker,
                  assignment, and project IDs on expenses and payments. If a
                  record has only a project ID, it is attributed only when
                  there is one matching assignment and one matching salary
                  record for that worker and project.
                </li>

                <li>
                  To prevent double deductions, link an expense created from
                  an issued money request using a field such as
                  "moneyRequestId", "requestId", or "sourceRequestId".
                </li>

                <li>
                  Set "salaryDeductible" or "deductFromSalary" to false on an
                  expense that should be reported but must not reduce the
                  worker's salary. If neither flag is set, an ordinary
                  job-linked expense is treated as deductible.
                </li>

                <li>
                  Date filters affect activity tables. The salary balance
                  always uses the full available salary history.
                </li>

                <li>
                  A negative balance means the deductions and payments
                  recorded against the salary are greater than the agreed
                  salary. Check the underlying records before making further
                  payments.
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
            Choose a worker from the selector above or click View report in
            the worker overview. The individual report will show that
            worker's records and can be printed or saved as a PDF.
          </p>
        </div>
      )}

      <style jsx global>{`
        #worker-print-report {
          color: #172033;
        }

        #worker-print-report p,
        #worker-print-report td,
        #worker-print-report th,
        #worker-print-report li {
          -webkit-text-fill-color: currentColor;
        }

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
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
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