"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  RefreshCw,
  Users,
  Wallet,
  WalletCards,
  Receipt,
} from "lucide-react";

import { collection, onSnapshot } from "firebase/firestore";

import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

// Firestore collections used by the dashboard.
const REPORT_COLLECTIONS = {
  workers: "workers",
  projects: "projects",
  clientPayments: "payments",
  expenses: "expenses",
  workerPayments: "workerPayments",
  moneyRequests: "moneyRequests",
  resources: "resourceInventory",
};

const moneyFormatter = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function money(value) {
  return moneyFormatter.format(Number(value) || 0);
}

function amountOf(record) {
  return Number(record?.amount ?? record?.total ?? 0) || 0;
}

function normalizedStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function getTimestamp(value) {
  if (!value) return 0;

  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value) {
  const timestamp = getTimestamp(value);

  if (!timestamp) return "Date unavailable";

  return new Date(timestamp).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/*
 * Client payments count as money received only when their status
 * confirms that the payment has been completed.
 */
function isCompletedPayment(record) {
  return [
    "paid",
    "completed",
    "successful",
    "received",
    "approved",
  ].includes(normalizedStatus(record?.status));
}

/*
 * Worker payment records are created by the finance page with
 * status "recorded". They should therefore count as money spent.
 */
function isRecordedWorkerPayment(record) {
  const status = normalizedStatus(record?.status);

  if (!status) return true;

  return [
    "recorded",
    "paid",
    "completed",
    "successful",
    "approved",
    "confirmed",
  ].includes(status);
}

/*
 * Include manual and historical expense records but exclude
 * pending, rejected, cancelled, and void transactions.
 */
function isRecordedExpense(record) {
  const status = normalizedStatus(record?.status);

  if (!status) return true;

  return [
    "paid",
    "completed",
    "approved",
    "recorded",
  ].includes(status);
}

/*
 * Approved money requests are the authoritative advance records.
 * If another expense document represents the same advance, exclude
 * it from ordinary expenses to avoid counting the advance twice.
 */
function isAdvanceLinkedExpense(record) {
  const source = normalizedStatus(record?.source || record?.type);
  const category = normalizedStatus(record?.category);

  return Boolean(
    record?.moneyRequestId ||
      record?.advanceId ||
      record?.requestId ||
      source.includes("money_request") ||
      source.includes("money request") ||
      source.includes("advance") ||
      category === "advance"
  );
}

function getPersonName(person) {
  if (!person) return "Unknown";

  const fullName = [
    person.firstName,
    person.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    person.name ||
    fullName ||
    person.fullName ||
    person.email ||
    "Unnamed"
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconStyle = "blue",
}) {
  const styles = {
    blue: "bg-[#EAF4FF] text-[#1769E0]",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#667085]">
            {title}
          </p>

          <p className="mt-3 break-words text-2xl font-bold tracking-tight text-[#172033]">
            {value}
          </p>

          <p className="mt-2 text-xs text-[#667085]">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${styles[iconStyle]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ title, description, icon: Icon }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
        <Icon className="h-5 w-5" />
      </div>

      <div>
        <h2 className="font-semibold text-[#172033]">{title}</h2>

        <p className="mt-1 text-sm text-[#667085]">
          {description}
        </p>
      </div>
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#EAF4FF] border-t-[#1769E0]" />

        <p className="mt-4 text-sm text-[#667085]">
          Loading your dashboard...
        </p>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [records, setRecords] = useState({
    workers: [],
    projects: [],
    clientPayments: [],
    expenses: [],
    workerPayments: [],
    moneyRequests: [],
    resources: [],
  });

  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  // --------------------------------------------------
  // AUTHENTICATION
  // --------------------------------------------------

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

  // --------------------------------------------------
  // FIRESTORE LISTENERS
  // --------------------------------------------------

  useEffect(() => {
    if (authLoading || !user || profile?.role !== "admin") {
      return;
    }

    const initiallyLoaded = new Set();

    setDataLoading(true);
    setDataError("");

    const collectionEntries = Object.entries(REPORT_COLLECTIONS);

    const unsubscribers = collectionEntries.map(
      ([key, collectionName]) =>
        onSnapshot(
          collection(db, collectionName),
          (snapshot) => {
            const items = snapshot.docs.map((document) => ({
              id: document.id,
              ...document.data(),
            }));

            setRecords((previous) => ({
              ...previous,
              [key]: items,
            }));

            initiallyLoaded.add(key);

            if (initiallyLoaded.size === collectionEntries.length) {
              setDataLoading(false);
            }
          },
          (error) => {
            console.error(
              `Dashboard error in ${collectionName}:`,
              error
            );

            setDataError(
              "Some dashboard information could not be loaded. Check your Firestore collection names and security rules."
            );

            setDataLoading(false);
          }
        )
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [authLoading, user, profile?.role]);

  // --------------------------------------------------
  // CALCULATE FINANCIAL AND OPERATIONAL TOTALS
  // --------------------------------------------------

  const totals = useMemo(() => {
    const {
      workers,
      projects,
      clientPayments,
      expenses,
      workerPayments,
      moneyRequests,
      resources,
    } = records;

    // Money coming into the company.
    const moneyIn = clientPayments
      .filter(isCompletedPayment)
      .reduce((sum, record) => sum + amountOf(record), 0);

    // Confirmed advances.
    const approvedAdvances = moneyRequests.filter(
      (request) =>
        normalizedStatus(request.status) === "approved"
    );

    const advancesTotal = approvedAdvances.reduce(
      (sum, request) => sum + amountOf(request),
      0
    );

    // Ordinary expenses do not include documents that duplicate advances.
    const recordedExpenses = expenses.filter(
      (record) =>
        isRecordedExpense(record) &&
        !isAdvanceLinkedExpense(record)
    );

    const expensesTotal = recordedExpenses.reduce(
      (sum, record) => sum + amountOf(record),
      0
    );

    // Salary payments saved by the finance page use status "recorded".
    const validWorkerPayments = workerPayments.filter(
      isRecordedWorkerPayment
    );

    const staffPaymentsTotal = validWorkerPayments.reduce(
      (sum, record) => sum + amountOf(record),
      0
    );

    /*
     * Total money out:
     * approved advances + separate expenses + salary payments.
     */
    const moneyOut =
      advancesTotal + expensesTotal + staffPaymentsTotal;

    const pendingRequests = moneyRequests.filter((request) =>
      [
        "pending",
        "submitted",
        "under_review",
      ].includes(normalizedStatus(request.status))
    );

    const pendingAmount = pendingRequests.reduce(
      (sum, request) => sum + amountOf(request),
      0
    );

    const activeWorkers = workers.filter((worker) => {
      const status = normalizedStatus(worker.status);

      return ![
        "inactive",
        "terminated",
        "suspended",
        "disabled",
      ].includes(status);
    });

    const activeProjects = projects.filter((project) => {
      const status = normalizedStatus(project.status);

      return [
        "active",
        "in progress",
        "in_progress",
        "ongoing",
      ].includes(status);
    });

    // ----------------------------------------------
    // RECENT FINANCIAL ACTIVITY
    // ----------------------------------------------

    const activity = [
      ...clientPayments
        .filter(isCompletedPayment)
        .map((record) => ({
          ...record,
          activityType: "Money received",
          direction: "in",
          amount: amountOf(record),
          date:
            record.paymentDate ||
            record.createdAt ||
            record.updatedAt,
        })),

      ...approvedAdvances.map((record) => ({
        ...record,
        activityType: "Worker advance",
        direction: "out",
        amount: amountOf(record),
        date:
          record.approvedAt ||
          record.updatedAt ||
          record.createdAt,
      })),

      ...recordedExpenses.map((record) => ({
        ...record,
        activityType: "Expense recorded",
        direction: "out",
        amount: amountOf(record),
        date:
          record.expenseDate ||
          record.date ||
          record.createdAt,
      })),

      ...validWorkerPayments.map((record) => ({
        ...record,
        activityType: "Salary payment",
        direction: "out",
        amount: amountOf(record),
        date:
          record.paymentDate ||
          record.createdAt ||
          record.updatedAt,
      })),
    ]
      .sort((a, b) => getTimestamp(b.date) - getTimestamp(a.date))
      .slice(0, 6);

    return {
      moneyIn,
      moneyOut,
      balance: moneyIn - moneyOut,

      advancesTotal,
      expensesTotal,
      staffPaymentsTotal,

      pendingRequests: pendingRequests.length,
      pendingAmount,

      activeWorkers: activeWorkers.length,
      activeProjects: activeProjects.length,
      resourcesCount: resources.length,

      activity,
    };
  }, [records]);

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  if (authLoading || !user || profile?.role !== "admin") {
    return <LoadingDashboard />;
  }

  const firstName =
    profile?.firstName ||
    user?.displayName?.split(" ")[0] ||
    "Admin";

  return (
    <main className="space-y-7 bg-[#F8FBFF] text-[#172033]">
      {/* PAGE HEADER */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1769E0]">
            ABES POWER & CONSTRUCTION
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
            Welcome back, {firstName}
          </h1>

          <p className="mt-2 text-sm text-[#667085]">
            Here is your company&apos;s financial and operational summary.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[#DCEAF8] bg-white px-4 py-2.5 text-sm font-semibold text-[#172033] transition hover:bg-[#F5FAFF] sm:self-auto"
        >
          <RefreshCw className="h-4 w-4 text-[#1769E0]" />
          Refresh dashboard
        </button>
      </section>

      {dataError && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {dataError}
        </div>
      )}

      {dataLoading ? (
        <LoadingDashboard />
      ) : (
        <>
          {/* FINANCIAL SUMMARY */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[#172033]">
                Financial overview
              </h2>

              <p className="mt-1 text-sm text-[#667085]">
                Confirmed payments, advances, and expenses recorded in your system.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                title="Money In"
                value={money(totals.moneyIn)}
                description="Confirmed client payments"
                icon={ArrowDownLeft}
                iconStyle="green"
              />

              <StatCard
                title="Money Out"
                value={money(totals.moneyOut)}
                description="Advances, expenses, and salary payments"
                icon={ArrowUpRight}
                iconStyle="red"
              />

              <StatCard
                title="Net Cash Movement"
                value={money(totals.balance)}
                description="Money in minus money out"
                icon={Wallet}
                iconStyle={totals.balance < 0 ? "red" : "blue"}
              />
            </div>
          </section>

          {/* EXPENSE BREAKDOWN */}
          <section className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm sm:p-6">
            <SectionHeading
              title="Where the money goes"
              description="Breakdown of recorded company cash movement"
              icon={CircleDollarSign}
            />

            <div className="mt-6 space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-[#344054]">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Money received
                  </span>

                  <span className="text-sm font-semibold text-emerald-700">
                    {money(totals.moneyIn)}
                  </span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-[#F2F4F7]">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: `${
                        totals.moneyIn + totals.moneyOut > 0
                          ? (totals.moneyIn /
                              (totals.moneyIn + totals.moneyOut)) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-[#344054]">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    Money spent
                  </span>

                  <span className="text-sm font-semibold text-rose-700">
                    {money(totals.moneyOut)}
                  </span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-[#F2F4F7]">
                  <div
                    className="h-full rounded-full bg-rose-500 transition-all"
                    style={{
                      width: `${
                        totals.moneyIn + totals.moneyOut > 0
                          ? (totals.moneyOut /
                              (totals.moneyIn + totals.moneyOut)) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Individual spending categories */}
            <div className="mt-6 grid gap-3 border-t border-[#E5EDF5] pt-5 sm:grid-cols-3">
              <div className="rounded-xl bg-[#F8FBFF] p-4">
                <p className="text-sm text-[#667085]">
                  Approved advances
                </p>

                <p className="mt-2 text-lg font-bold text-[#172033]">
                  {money(totals.advancesTotal)}
                </p>
              </div>

              <div className="rounded-xl bg-[#F8FBFF] p-4">
                <p className="text-sm text-[#667085]">
                  Other expenses
                </p>

                <p className="mt-2 text-lg font-bold text-[#172033]">
                  {money(totals.expensesTotal)}
                </p>
              </div>

              <div className="rounded-xl bg-[#F8FBFF] p-4">
                <p className="text-sm text-[#667085]">
                  Salary payments
                </p>

                <p className="mt-2 text-lg font-bold text-[#172033]">
                  {money(totals.staffPaymentsTotal)}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#DCEAF8] bg-[#F5FAFF] p-4">
              <span className="text-sm font-semibold text-[#172033]">
                Total money out
              </span>

              <span className="text-lg font-bold text-[#1769E0]">
                {money(totals.moneyOut)}
              </span>
            </div>

            <p className="mt-4 text-xs leading-5 text-[#667085]">
              Pending money requests are not included in money spent. Advances
              are counted from approved requests, ordinary expenses exclude
              linked advance records to prevent double counting, and recorded
              salary payments are included.
            </p>
          </section>

          {/* OPERATIONS */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[#172033]">
                Operations at a glance
              </h2>

              <p className="mt-1 text-sm text-[#667085]">
                The numbers that need your attention.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Active Workers"
                value={totals.activeWorkers}
                description={`${records.workers.length} workers in total`}
                icon={Users}
              />

              <StatCard
                title="Active Projects"
                value={totals.activeProjects}
                description={`${records.projects.length} projects in total`}
                icon={BriefcaseBusiness}
              />

              <StatCard
                title="Pending Requests"
                value={totals.pendingRequests}
                description={`${money(totals.pendingAmount)} requested`}
                icon={Clock3}
                iconStyle="amber"
              />

              <StatCard
                title="Resources Tracked"
                value={totals.resourcesCount}
                description="Items in inventory"
                icon={WalletCards}
              />
            </div>
          </section>

          {/* RECENT FINANCIAL ACTIVITY */}
          <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-[#E5EDF5] p-5 sm:p-6">
              <SectionHeading
                title="Recent financial activity"
                description="Latest recorded payments, advances, and expenses"
                icon={Activity}
              />

              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            </div>

            {totals.activity.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F5FAFF] text-[#1769E0]">
                  <Activity className="h-5 w-5" />
                </div>

                <h3 className="mt-4 font-semibold text-[#172033]">
                  No financial activity yet
                </h3>

                <p className="mt-1 max-w-sm text-sm text-[#667085]">
                  Confirmed client payments, approved advances, recorded expenses,
                  and salary payments will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-[#F8FBFF] text-xs uppercase tracking-wide text-[#667085]">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Activity</th>
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 text-right font-semibold">
                        Amount
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#E5EDF5]">
                    {totals.activity.map((item) => (
                      <tr
                        key={`${item.activityType}-${item.id}`}
                        className="transition hover:bg-[#F8FBFF]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                                item.direction === "in"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-rose-50 text-rose-700"
                              }`}
                            >
                              {item.direction === "in" ? (
                                <ArrowDownLeft className="h-4 w-4" />
                              ) : (
                                <ArrowUpRight className="h-4 w-4" />
                              )}
                            </div>

                            <div>
                              <p className="font-medium text-[#172033]">
                                {item.activityType}
                              </p>

                              <p className="mt-1 text-xs text-[#667085]">
                                {item.description ||
                                  item.category ||
                                  item.projectName ||
                                  item.notes ||
                                  "Recorded transaction"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-[#667085]">
                          {formatDate(item.date)}
                        </td>

                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium capitalize text-emerald-700">
                            {item.status || "Recorded"}
                          </span>
                        </td>

                        <td
                          className={`whitespace-nowrap px-5 py-4 text-right font-semibold ${
                            item.direction === "in"
                              ? "text-emerald-700"
                              : "text-rose-700"
                          }`}
                        >
                          {item.direction === "in" ? "+" : "-"}
                          {money(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* QUICK ACTIONS */}
          <section className="rounded-2xl bg-[#0F3D70] p-6 text-white shadow-sm sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Manage your operations
                </h2>

                <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100">
                  Review workers, projects, staff requests, and financial records
                  from your admin workspace.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/admin/workers")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#0F3D70] transition hover:bg-[#F5FAFF]"
                >
                  <Users className="h-4 w-4" />
                  Manage Workers
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/admin/finance")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <Wallet className="h-4 w-4" />
                  View Finance
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}