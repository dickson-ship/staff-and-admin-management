"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  RefreshCw,
  Wallet,
  AlertCircle,
  ReceiptText,
} from "lucide-react";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

const formatMoney = (amount) =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));

const formatDate = (value) => {
  if (!value) return "—";

  const date = value?.toDate ? value.toDate() : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const normalizeStatus = (status) =>
  String(status || "")
    .toLowerCase()
    .replaceAll("_", "-");

function StatusBadge({ status }) {
  const normalized = normalizeStatus(status) || "recorded";

  const styles = {
    active: "bg-blue-50 text-blue-700",
    recorded: "bg-emerald-50 text-emerald-700",
    completed: "bg-emerald-50 text-emerald-700",
    pending: "bg-amber-50 text-amber-700",
    approved: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-700",
    void: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[normalized] || "bg-slate-100 text-slate-600"
      }`}
    >
      {normalized.replaceAll("-", " ")}
    </span>
  );
}

function SummaryCard({ title, amount, description, icon: Icon, color }) {
  return (
    <div className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#667085]">{title}</p>
          <p className="mt-3 break-words text-2xl font-bold text-[#172033] sm:text-3xl">
            {amount}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}
        >
          <Icon size={22} />
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-[#98A2B3]">
        {description}
      </p>
    </div>
  );
}

export default function StaffPaymentsPage() {
  const { user, profile, loading: authLoading } = useAuth();

  const [salaries, setSalaries] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [payments, setPayments] = useState([]);
  const [projects, setProjects] = useState({});

  const [loaded, setLoaded] = useState({
    salaries: false,
    assignments: false,
    requests: false,
    payments: false,
  });

  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("salaries");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (
      authLoading ||
      !user?.uid ||
      profile?.role !== "staff"
    ) {
      return;
    }

    let active = true;

    setError("");

    const markLoaded = (key) => {
      if (active) {
        setLoaded((previous) => ({
          ...previous,
          [key]: true,
        }));
      }
    };

    const handleError = (collectionName, firestoreError) => {
      console.error(
        `Error loading staff ${collectionName}:`,
        firestoreError
      );

      if (active) {
        setError(
          "Some payment information could not be loaded. Check your Firestore rules and try refreshing the page."
        );
        markLoaded(collectionName);
      }
    };

    const unsubscribers = [];

    const subscribe = (key, collectionName, setter) => {
      const staffQuery = query(
        collection(db, collectionName),
        where("workerId", "==", user.uid)
      );

      const unsubscribe = onSnapshot(
        staffQuery,
        (snapshot) => {
          if (!active) return;

          setter(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            }))
          );

          markLoaded(key);
        },
        (firestoreError) => handleError(key, firestoreError)
      );

      unsubscribers.push(unsubscribe);
    };

    subscribe("salaries", "workerSalaries", setSalaries);
    subscribe("assignments", "assignments", setAssignments);
    subscribe("requests", "moneyRequests", setRequests);
    subscribe("payments", "workerPayments", setPayments);

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [user?.uid, profile?.role, authLoading]);

  // Load project information for the staff member's assignments and salaries.
  useEffect(() => {
    if (!user?.uid || profile?.role !== "staff") return;

    let active = true;

    const projectIds = [
      ...new Set(
        [...salaries, ...assignments]
          .map((item) => item.projectId)
          .filter(Boolean)
      ),
    ];

    const loadProjects = async () => {
      const entries = await Promise.all(
        projectIds.map(async (projectId) => {
          try {
            const projectSnapshot = await getDoc(
              doc(db, "projects", projectId)
            );

            if (!projectSnapshot.exists()) {
              return [projectId, null];
            }

            return [
              projectId,
              {
                id: projectSnapshot.id,
                ...projectSnapshot.data(),
              },
            ];
          } catch (projectError) {
            console.error(
              `Could not load project ${projectId}:`,
              projectError
            );

            return [projectId, null];
          }
        })
      );

      if (active) {
        setProjects(Object.fromEntries(entries));
      }
    };

    loadProjects();

    return () => {
      active = false;
    };
  }, [salaries, assignments, user?.uid, profile?.role]);

  const isLoading = Object.values(loaded).some(
    (value) => !value
  );

  const salaryRecords = useMemo(
    () =>
      salaries.filter(
        (salary) =>
          !["void", "cancelled", "deleted"].includes(
            normalizeStatus(salary.status)
          )
      ),
    [salaries]
  );

  const activeAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          !["cancelled", "deleted"].includes(
            normalizeStatus(assignment.status)
          )
      ),
    [assignments]
  );

  // Include approved requests against the correct job.
  // Legacy requests without assignmentId are allocated only when
  // the worker has exactly one assignment for that project.
  const getAdvanceForSalary = (salary) => {
    if (!salary.assignmentId) return 0;

    const assignmentsForProject = activeAssignments.filter(
      (assignment) =>
        assignment.projectId === salary.projectId
    );

    const approvedRequests = requests.filter((request) => {
      if (normalizeStatus(request.status) !== "approved") {
        return false;
      }

      if (request.assignmentId) {
        return request.assignmentId === salary.assignmentId;
      }

      return (
        request.projectId === salary.projectId &&
        assignmentsForProject.length === 1 &&
        assignmentsForProject[0].id === salary.assignmentId
      );
    });

    return approvedRequests.reduce(
      (total, request) => total + Number(request.amount || 0),
      0
    );
  };

  const getPaymentsForSalary = (salary) => {
    return payments.filter((payment) => {
      if (normalizeStatus(payment.status) === "void") {
        return false;
      }

      // Prefer the exact salary record link.
      if (payment.salaryId) {
        return payment.salaryId === salary.id;
      }

      // Support older payment records without salaryId.
      return (
        Boolean(salary.assignmentId) &&
        payment.assignmentId === salary.assignmentId
      );
    });
  };

  const salaryRows = useMemo(() => {
    return salaryRecords.map((salary) => {
      const agreedSalary = Number(salary.agreedSalary || 0);
      const advances = getAdvanceForSalary(salary);
      const salaryPayments = getPaymentsForSalary(salary);

      const paid = salaryPayments.reduce(
        (total, payment) => total + Number(payment.amount || 0),
        0
      );

      const project = projects[salary.projectId];

      return {
        ...salary,
        project,
        projectName:
          project?.name ||
          project?.service ||
          "Assigned project",
        agreedSalary,
        advances,
        paid,
        balance: agreedSalary - advances - paid,
      };
    });
  }, [salaryRecords, requests, payments, projects, activeAssignments]);

  const totals = useMemo(() => {
    return salaryRows.reduce(
      (result, salary) => {
        result.agreed += salary.agreedSalary;
        result.advances += salary.advances;
        result.paid += salary.paid;
        result.balance += salary.balance;
        return result;
      },
      {
        agreed: 0,
        advances: 0,
        paid: 0,
        balance: 0,
      }
    );
  }, [salaryRows]);

  const visibleSalaryRows = salaryRows.filter((salary) =>
    salary.projectName.toLowerCase().includes(search.toLowerCase())
  );

  const visiblePayments = payments
    .filter(
      (payment) =>
        normalizeStatus(payment.status) !== "void"
    )
    .filter((payment) => {
      const projectName =
        projects[payment.projectId]?.name ||
        projects[payment.projectId]?.service ||
        "";

      const searchText = [
        projectName,
        payment.method,
        payment.reference,
        payment.notes,
      ]
        .join(" ")
        .toLowerCase();

      return searchText.includes(search.toLowerCase());
    })
    .sort((a, b) => {
      const dateA =
        a.paymentDate?.toDate?.().getTime() ||
        new Date(a.paymentDate || 0).getTime() ||
        0;

      const dateB =
        b.paymentDate?.toDate?.().getTime() ||
        new Date(b.paymentDate || 0).getTime() ||
        0;

      return dateB - dateA;
    });

  const pendingRequests = requests.filter(
    (request) =>
      normalizeStatus(request.status) === "pending"
  ).length;

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-[#667085]">
        <RefreshCw size={19} className="animate-spin" />
        Checking your account...
      </div>
    );
  }

  if (!user || profile?.role !== "staff") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-[#E5EDF5] bg-white p-8 text-center shadow-sm">
        <AlertCircle
          size={36}
          className="mx-auto text-amber-600"
        />
        <h1 className="mt-4 text-xl font-bold text-[#172033]">
          Staff access required
        </h1>
        <p className="mt-2 text-sm text-[#667085]">
          Sign in with an authorized staff account to view your
          payment information.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex rounded-xl bg-[#1769E0] px-5 py-3 text-sm font-semibold text-white"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      {/* Header */}
      <section>
        <Link
          href="/staff"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#667085] hover:text-[#1769E0]"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#1769E0]">
              Staff finances
            </p>

            <h1 className="mt-1 text-2xl font-bold text-[#172033] sm:text-3xl">
              My Payments
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
              View the agreed salary for each assigned job, approved
              advances, payments recorded by the administrator,
              and your remaining balance.
            </p>
          </div>

          <Link
            href="/staff/requests"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DCEAF8] bg-white px-4 py-3 text-sm font-semibold text-[#1769E0] transition hover:bg-[#F5FAFF]"
          >
            <Wallet size={17} />
            My money requests
          </Link>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <AlertCircle size={20} className="shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Summary cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Agreed Salaries"
          amount={isLoading ? "—" : formatMoney(totals.agreed)}
          description="Total salary recorded for your jobs"
          icon={BriefcaseBusiness}
          color="bg-blue-50 text-[#1769E0]"
        />

        <SummaryCard
          title="Approved Advances"
          amount={isLoading ? "—" : formatMoney(totals.advances)}
          description="Approved money requests counted against salary"
          icon={Wallet}
          color="bg-amber-50 text-amber-700"
        />

        <SummaryCard
          title="Total Paid"
          amount={isLoading ? "—" : formatMoney(totals.paid)}
          description="Payments recorded by the administrator"
          icon={CheckCircle2}
          color="bg-emerald-50 text-emerald-700"
        />

        <SummaryCard
          title="Remaining Balance"
          amount={isLoading ? "—" : formatMoney(totals.balance)}
          description="Agreed salary less advances and payments"
          icon={Banknote}
          color="bg-violet-50 text-violet-700"
        />
      </section>

      {/* Notice */}
      <section className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-[#F0F7FF] p-4">
        <AlertCircle
          size={20}
          className="mt-0.5 shrink-0 text-[#1769E0]"
        />
        <div>
          <p className="text-sm font-semibold text-[#172033]">
            How your balance is calculated
          </p>
          <p className="mt-1 text-sm leading-6 text-[#667085]">
            Remaining balance = agreed job salary − approved
            advances − recorded payments. This follows the current
            system's rule that approved requests count as advances.
            If approval does not mean money has actually been
            disbursed, the calculation should be changed to deduct
            advances only after disbursement is recorded.
          </p>
        </div>
      </section>

      {/* Tabs and search */}
      <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[#E5EDF5] p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("salaries")}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === "salaries"
                  ? "bg-[#1769E0] text-white"
                  : "bg-[#F5FAFF] text-[#667085] hover:bg-[#EAF4FF]"
              }`}
            >
              Job salaries
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === "history"
                  ? "bg-[#1769E0] text-white"
                  : "bg-[#F5FAFF] text-[#667085] hover:bg-[#EAF4FF]"
              }`}
            >
              Payment history
            </button>
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              activeTab === "salaries"
                ? "Search by project name..."
                : "Search project, method or reference..."
            }
            className="w-full rounded-xl border border-[#DCEAF8] bg-white px-4 py-3 text-sm text-[#172033] outline-none transition placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:ring-2 focus:ring-[#1769E0]/10"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 px-5 py-14 text-sm text-[#667085]">
            <RefreshCw size={19} className="animate-spin" />
            Loading your payment records...
          </div>
        ) : activeTab === "salaries" ? (
          <div>
            {visibleSalaryRows.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5FAFF] text-[#1769E0]">
                  <ReceiptText size={25} />
                </div>

                <h3 className="mt-4 font-semibold text-[#172033]">
                  No salary records found
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#667085]">
                  {salaryRecords.length === 0
                    ? "Your agreed job salaries will appear here after the administrator records them."
                    : "No salary records match your search."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E5EDF5]">
                {visibleSalaryRows.map((salary) => (
                  <article
                    key={salary.id}
                    className="p-5 sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
                          <BriefcaseBusiness size={21} />
                        </div>

                        <div>
                          <h3 className="font-bold text-[#172033]">
                            {salary.projectName}
                          </h3>

                          <p className="mt-1 text-sm text-[#667085]">
                            {salary.project?.location ||
                              "Location not specified"}
                          </p>

                          <div className="mt-2">
                            <StatusBadge status={salary.status} />
                          </div>
                        </div>
                      </div>

                      <div className="sm:text-right">
                        <p className="text-xs text-[#667085]">
                          Remaining salary
                        </p>
                        <p
                          className={`mt-1 text-xl font-bold ${
                            salary.balance < 0
                              ? "text-red-600"
                              : "text-[#172033]"
                          }`}
                        >
                          {formatMoney(salary.balance)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl bg-[#F8FBFF] p-3">
                        <p className="text-xs text-[#667085]">
                          Agreed salary
                        </p>
                        <p className="mt-1 font-bold text-[#172033]">
                          {formatMoney(salary.agreedSalary)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#F8FBFF] p-3">
                        <p className="text-xs text-[#667085]">
                          Approved advances
                        </p>
                        <p className="mt-1 font-bold text-amber-700">
                          {formatMoney(salary.advances)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#F8FBFF] p-3">
                        <p className="text-xs text-[#667085]">
                          Payments recorded
                        </p>
                        <p className="mt-1 font-bold text-emerald-700">
                          {formatMoney(salary.paid)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#F8FBFF] p-3">
                        <p className="text-xs text-[#667085]">
                          Salary record date
                        </p>
                        <p className="mt-1 flex items-center gap-2 font-semibold text-[#172033]">
                          <CalendarDays
                            size={15}
                            className="text-[#667085]"
                          />
                          {formatDate(salary.createdAt)}
                        </p>
                      </div>
                    </div>

                    {salary.balance < 0 && (
                      <p className="mt-3 text-xs leading-5 text-red-600">
                        The recorded advances and payments exceed
                        this agreed salary. Please contact the
                        administrator to review the records.
                      </p>
                    )}

                    <div className="mt-4">
                      <Link
                        href="/staff/jobs"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-[#1769E0] hover:text-[#0F3D70]"
                      >
                        View assigned jobs
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {visiblePayments.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5FAFF] text-[#1769E0]">
                  <CreditCard size={25} />
                </div>

                <h3 className="mt-4 font-semibold text-[#172033]">
                  No payment history found
                </h3>

                <p className="mt-2 text-sm text-[#667085]">
                  Payments recorded by the administrator will appear here.
                </p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#F8FBFF] text-xs uppercase tracking-wide text-[#667085]">
                      <tr>
                        <th className="px-6 py-4 font-semibold">
                          Project
                        </th>
                        <th className="px-6 py-4 font-semibold">
                          Date
                        </th>
                        <th className="px-6 py-4 font-semibold">
                          Method
                        </th>
                        <th className="px-6 py-4 font-semibold">
                          Reference
                        </th>
                        <th className="px-6 py-4 text-right font-semibold">
                          Amount
                        </th>
                        <th className="px-6 py-4 font-semibold">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#E5EDF5]">
                      {visiblePayments.map((payment) => (
                        <tr
                          key={payment.id}
                          className="hover:bg-[#F8FBFF]"
                        >
                          <td className="px-6 py-4 font-medium text-[#172033]">
                            {projects[payment.projectId]?.name ||
                              projects[payment.projectId]?.service ||
                              "Assigned project"}
                          </td>

                          <td className="px-6 py-4 text-[#667085]">
                            {formatDate(
                              payment.paymentDate ||
                                payment.createdAt
                            )}
                          </td>

                          <td className="px-6 py-4 capitalize text-[#667085]">
                            {String(
                              payment.method || "Not specified"
                            ).replaceAll("_", " ")}
                          </td>

                          <td className="px-6 py-4 text-[#667085]">
                            {payment.reference || "—"}
                          </td>

                          <td className="px-6 py-4 text-right font-semibold text-[#172033]">
                            {formatMoney(payment.amount)}
                          </td>

                          <td className="px-6 py-4">
                            <StatusBadge status={payment.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-[#E5EDF5] md:hidden">
                  {visiblePayments.map((payment) => (
                    <article
                      key={payment.id}
                      className="space-y-3 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-[#172033]">
                            {projects[payment.projectId]?.name ||
                              projects[payment.projectId]?.service ||
                              "Assigned project"}
                          </h3>

                          <p className="mt-1 text-xs text-[#667085]">
                            {formatDate(
                              payment.paymentDate ||
                                payment.createdAt
                            )}
                          </p>
                        </div>

                        <p className="font-bold text-[#172033]">
                          {formatMoney(payment.amount)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
                        <span className="rounded-lg bg-[#F8FBFF] px-3 py-2 capitalize">
                          {String(
                            payment.method || "Not specified"
                          ).replaceAll("_", " ")}
                        </span>

                        <StatusBadge status={payment.status} />
                      </div>

                      {payment.reference && (
                        <p className="text-xs text-[#667085]">
                          Reference: {payment.reference}
                        </p>
                      )}

                      {payment.notes && (
                        <p className="text-sm leading-5 text-[#667085]">
                          {payment.notes}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* Pending requests reminder */}
      {pendingRequests > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Clock3
              size={21}
              className="mt-0.5 shrink-0 text-amber-700"
            />
            <div>
              <h3 className="font-semibold text-amber-900">
                You have {pendingRequests} pending money request
                {pendingRequests === 1 ? "" : "s"}
              </h3>
              <p className="mt-1 text-sm text-amber-800">
                Check the status of your submitted requests.
              </p>
            </div>
          </div>

          <Link
            href="/staff/requests"
            className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-amber-900 hover:underline"
          >
            Check requests
            <ArrowRight size={16} />
          </Link>
        </section>
      )}
    </div>
  );
}