                       
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Camera,
  ClipboardList,
  Clock3,
  Package,
  WalletCards,
  CreditCard,
  AlertCircle,
  RefreshCw,
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

const money = (amount) =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));

const formatDate = (value) => {
  if (!value) return "Not set";

  const date = value?.toDate
    ? value.toDate()
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const statusStyles = {
  assigned: "bg-blue-50 text-blue-700",
  "in-progress": "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
};

function StatusBadge({ status }) {
  const normalized = String(status || "unknown")
    .toLowerCase()
    .replaceAll("_", "-");

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        statusStyles[normalized] ||
        "bg-slate-100 text-slate-600"
      }`}
    >
      {normalized.replaceAll("-", " ")}
    </span>
  );
}

const quickActions = [
  {
    title: "My Jobs",
    description: "View assignments, project details and deadlines.",
    href: "/staff/jobs",
    icon: BriefcaseBusiness,
  },
  {
    title: "Submit Work",
    description: "Choose a job to upload photos and progress updates.",
    href: "/staff/jobs",
    icon: Camera,
  },
  {
    title: "Money Requests",
    description: "Request transport, food or other job expenses.",
    href: "/staff/requests",
    icon: WalletCards,
  },
  {
    title: "My Resources",
    description: "View equipment and resources issued to you.",
    href: "/staff/resources",
    icon: Package,
  },
];

export default function StaffDashboard() {
  const { user, profile, loading: authLoading } = useAuth();

  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [payments, setPayments] = useState([]);

  const [loadingJobs, setLoadingJobs] = useState(true);
  const [dataError, setDataError] = useState("");

  useEffect(() => {
    if (
      authLoading ||
      !user?.uid ||
      profile?.role !== "staff"
    ) {
      return;
    }

    let active = true;

    setLoadingJobs(true);
    setDataError("");

    const handleError = (error) => {
      console.error("Staff dashboard error:", error);

      if (active) {
        setDataError(
          "Some dashboard information could not be loaded. Please refresh or try again later."
        );
      }
    };

    const assignmentsQuery = query(
      collection(db, "assignments"),
      where("workerId", "==", user.uid)
    );

    const submissionsQuery = query(
      collection(db, "workSubmissions"),
      where("workerId", "==", user.uid)
    );

    const requestsQuery = query(
      collection(db, "moneyRequests"),
      where("workerId", "==", user.uid)
    );

    const paymentsQuery = query(
      collection(db, "workerPayments"),
      where("workerId", "==", user.uid)
    );

    const unsubscribeAssignments = onSnapshot(
      assignmentsQuery,
      async (snapshot) => {
        try {
          const assignmentRecords = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));

          const enrichedAssignments = await Promise.all(
            assignmentRecords.map(async (assignment) => {
              if (!assignment.projectId) {
                return {
                  ...assignment,
                  project: null,
                };
              }

              try {
                const projectSnapshot = await getDoc(
                  doc(db, "projects", assignment.projectId)
                );

                return {
                  ...assignment,
                  project: projectSnapshot.exists()
                    ? {
                        id: projectSnapshot.id,
                        ...projectSnapshot.data(),
                      }
                    : null,
                };
              } catch (error) {
                console.error(
                  "Could not load assigned project:",
                  error
                );

                return {
                  ...assignment,
                  project: null,
                };
              }
            })
          );

          if (!active) return;

          enrichedAssignments.sort((a, b) => {
            const aDate = a.createdAt?.toMillis?.() || 0;
            const bDate = b.createdAt?.toMillis?.() || 0;
            return bDate - aDate;
          });

          setAssignments(enrichedAssignments);
          setLoadingJobs(false);
        } catch (error) {
          handleError(error);
          if (active) setLoadingJobs(false);
        }
      },
      (error) => {
        handleError(error);
        if (active) setLoadingJobs(false);
      }
    );

    const unsubscribeSubmissions = onSnapshot(
      submissionsQuery,
      (snapshot) => {
        if (!active) return;

        setSubmissions(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      handleError
    );

    const unsubscribeRequests = onSnapshot(
      requestsQuery,
      (snapshot) => {
        if (!active) return;

        setRequests(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      handleError
    );

    const unsubscribePayments = onSnapshot(
      paymentsQuery,
      (snapshot) => {
        if (!active) return;

        setPayments(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      handleError
    );

    return () => {
      active = false;
      unsubscribeAssignments();
      unsubscribeSubmissions();
      unsubscribeRequests();
      unsubscribePayments();
    };
  }, [user?.uid, profile?.role, authLoading]);

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-[#667085]">
          <RefreshCw size={20} className="animate-spin" />
          Loading your workspace...
        </div>
      </div>
    );
  }

  if (!user || profile?.role !== "staff") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-[#E5EDF5] bg-white p-8 text-center shadow-sm">
        <AlertCircle
          size={36}
          className="mx-auto text-amber-600"
        />
        <h2 className="mt-4 text-lg font-bold text-[#172033]">
          Staff access required
        </h2>
        <p className="mt-2 text-sm text-[#667085]">
          Please sign in with an authorized staff account to
          access this dashboard.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex rounded-xl bg-[#1769E0] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0F3D70]"
        >
          Go to login
        </Link>
      </div>
    );
  }

  const activeAssignments = assignments.filter((assignment) => {
    const status = String(assignment.status || "")
      .toLowerCase()
      .replaceAll("_", "-");

    return ["assigned", "in-progress"].includes(status);
  });

  const inProgressCount = assignments.filter(
    (assignment) =>
      String(assignment.status || "")
        .toLowerCase()
        .replaceAll("_", "-") === "in-progress"
  ).length;

  const pendingSubmissions = submissions.filter(
    (submission) =>
      String(submission.status || "").toLowerCase() === "pending"
  ).length;

  const pendingRequests = requests.filter(
    (request) =>
      String(request.status || "").toLowerCase() === "pending"
  ).length;

  const totalPayments = payments
    .filter(
      (payment) =>
        String(payment.status || "").toLowerCase() !== "void"
    )
    .reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0
    );

  const firstName =
    profile?.firstName ||
    profile?.name?.split(" ")[0] ||
    user.displayName?.split(" ")[0] ||
    "Staff Member";

  const metrics = [
    {
      title: "Assigned Jobs",
      value: loadingJobs ? "—" : assignments.length,
      note: `${activeAssignments.length} active`,
      icon: BriefcaseBusiness,
      iconStyle: "bg-blue-50 text-[#1769E0]",
    },
    {
      title: "In Progress",
      value: loadingJobs ? "—" : inProgressCount,
      note: "Jobs currently underway",
      icon: Clock3,
      iconStyle: "bg-amber-50 text-amber-700",
    },
    {
      title: "Work Reviews",
      value: pendingSubmissions,
      note: "Submissions awaiting review",
      icon: Camera,
      iconStyle: "bg-violet-50 text-violet-700",
    },
    {
      title: "Money Requests",
      value: pendingRequests,
      note: "Requests awaiting a decision",
      icon: WalletCards,
      iconStyle: "bg-emerald-50 text-emerald-700",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Welcome */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F3D70] to-[#1769E0] p-6 text-white shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full border-[35px] border-white/10" />
        <div className="pointer-events-none absolute -bottom-20 right-32 h-44 w-44 rounded-full bg-white/5" />

        <div className="relative max-w-2xl">
          <p className="text-sm font-medium text-blue-100">
            My workspace
          </p>

          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
            Welcome, {firstName}!
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
            Manage your assigned jobs, submit work updates, track
            requests and keep up with your job-related payments.
          </p>

          <Link
            href="/staff/jobs"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#0F3D70] transition hover:bg-blue-50"
          >
            View my jobs
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      {/* Error */}
      {dataError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <p>{dataError}</p>
        </div>
      )}

      {/* Metrics */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[#172033]">
            Your activity
          </h2>
          <p className="mt-1 text-sm text-[#667085]">
            A live overview of your work and requests.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <div
                key={metric.title}
                className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#667085]">
                      {metric.title}
                    </p>
                    <p className="mt-3 text-3xl font-bold text-[#172033]">
                      {metric.value}
                    </p>
                  </div>

                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${metric.iconStyle}`}
                  >
                    <Icon size={21} />
                  </div>
                </div>

                <p className="mt-3 text-xs text-[#98A2B3]">
                  {metric.note}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[#172033]">
            Quick actions
          </h2>
          <p className="mt-1 text-sm text-[#667085]">
            Get to the tools you need for your work.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;

            return (
              <Link
                key={action.title}
                href={action.href}
                className="group rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#B9D7FF] hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
                    <Icon size={22} />
                  </div>

                  <ArrowRight
                    size={18}
                    className="text-[#98A2B3] transition group-hover:translate-x-1 group-hover:text-[#1769E0]"
                  />
                </div>

                <h3 className="mt-4 font-bold text-[#172033]">
                  {action.title}
                </h3>

                <p className="mt-2 text-sm leading-5 text-[#667085]">
                  {action.description}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Current Assignments */}
      <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E5EDF5] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
              <ClipboardList size={21} />
            </div>

            <div>
              <h2 className="font-bold text-[#172033]">
                My current work
              </h2>
              <p className="mt-1 text-xs text-[#667085]">
                Your latest assigned projects.
              </p>
            </div>
          </div>

          <Link
            href="/staff/jobs"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#1769E0] hover:text-[#0F3D70]"
          >
            View all jobs
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="divide-y divide-[#E5EDF5]">
          {loadingJobs ? (
            <div className="flex items-center justify-center gap-3 px-5 py-12 text-sm text-[#667085]">
              <RefreshCw size={18} className="animate-spin" />
              Loading your assignments...
            </div>
          ) : assignments.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5FAFF] text-[#1769E0]">
                <BriefcaseBusiness size={25} />
              </div>

              <h3 className="mt-4 font-semibold text-[#172033]">
                No jobs assigned yet
              </h3>

              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#667085]">
                When an administrator assigns you a project, it
                will appear here.
              </p>
            </div>
          ) : (
            assignments.slice(0, 5).map((assignment) => {
              const project = assignment.project;
              const projectName =
                project?.name ||
                project?.service ||
                "Assigned project";

              const projectLocation =
                project?.location || "Location not specified";

              return (
                <div
                  key={assignment.id}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F5FAFF] text-[#1769E0]">
                      <BriefcaseBusiness size={21} />
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-semibold text-[#172033]">
                        {projectName}
                      </h3>

                      <p className="mt-1 text-sm text-[#667085]">
                        {projectLocation}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#667085]">
                        <span>
                          Deadline:{" "}
                          <strong className="font-medium text-[#172033]">
                            {formatDate(
                              assignment.expectedCompletion ||
                                project?.deadline
                            )}
                          </strong>
                        </span>

                        <span>
                          Assigned:{" "}
                          {formatDate(assignment.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <StatusBadge status={assignment.status} />

                    <Link
                      href={`/staff/jobs/${assignment.id}`}
                      aria-label={`View ${projectName}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E5EDF5] text-[#667085] transition hover:border-[#B9D7FF] hover:bg-[#F5FAFF] hover:text-[#1769E0]"
                    >
                      <ArrowRight size={17} />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Requests and payments */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <WalletCards size={21} />
            </div>

            <div className="flex-1">
              <h2 className="font-bold text-[#172033]">
                Money requests
              </h2>
              <p className="mt-1 text-sm text-[#667085]">
                Track requests for job-related expenses.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl bg-[#F8FBFF] p-4">
            <p className="text-sm text-[#667085]">
              Requests awaiting a decision
            </p>
            <p className="mt-1 text-2xl font-bold text-[#172033]">
              {pendingRequests}
            </p>
          </div>

          <Link
            href="/staff/requests"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#1769E0] hover:text-[#0F3D70]"
          >
            View my requests
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <CreditCard size={21} />
            </div>

            <div className="flex-1">
              <h2 className="font-bold text-[#172033]">
                My payments
              </h2>
              <p className="mt-1 text-sm text-[#667085]">
                Total salary payments recorded for you.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl bg-[#F8FBFF] p-4">
            <p className="text-sm text-[#667085]">
              Total recorded payments
            </p>
            <p className="mt-1 text-2xl font-bold text-[#172033]">
              {money(totalPayments)}
            </p>
          </div>

          <Link
            href="/staff/payments"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#1769E0] hover:text-[#0F3D70]"
          >
            View payment history
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Work submission reminder */}
      <section className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-[#F0F7FF] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#1769E0]">
            <Camera size={22} />
          </div>

          <div>
            <h2 className="font-bold text-[#172033]">
              Keep your work updated
            </h2>

            <p className="mt-1 text-sm leading-6 text-[#667085]">
              Submit job photos and comments so the administrator
              can review your progress.
              {pendingSubmissions > 0
                ? ` You have ${pendingSubmissions} submission${
                    pendingSubmissions === 1 ? "" : "s"
                  } awaiting review.`
                : ""}
            </p>
          </div>
        </div>

        <Link
          href="/staff/jobs"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0F3D70]"
        >
          Open my jobs
          <ArrowRight size={17} />
        </Link>
      </section>
    </div>
  );
}
