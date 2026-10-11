
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  FileText,
  MapPin,
  Phone,
  Mail,
  User,
  Users,
  WalletCards,
  Package,
  Image as ImageIcon,
  AlertCircle,
  MoreHorizontal,
} from "lucide-react";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "@/config/Firebase";

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function formatDate(value) {
  if (!value) {
    return "Not specified";
  }

  try {
    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleDateString("en-GH", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

    return new Date(`${value}T00:00:00`).toLocaleDateString(
      "en-GH",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  } catch {
    return "Invalid date";
  }
}

function getStatusClasses(status) {
  switch (status) {
    case "Completed":
      return "bg-green-50 text-green-700 border-green-200";

    case "In Progress":
      return "bg-blue-50 text-blue-700 border-blue-200";

    case "Planning":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "Cancelled":
      return "bg-red-50 text-red-700 border-red-200";

    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function InfoItem({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5FAFF]">
        <Icon className="h-4 w-4 text-[#1769E0]" />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-[#98A2B3]">
          {label}
        </p>

        <p className="mt-1 break-words text-sm font-medium text-[#172033]">
          {value || "Not provided"}
        </p>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#E5EDF5] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF4FF]">
          <Icon className="h-5 w-5 text-[#1769E0]" />
        </div>

        <div>
          <h2 className="font-semibold text-[#172033]">
            {title}
          </h2>

          {description && (
            <p className="mt-0.5 text-sm text-[#667085]">
              {description}
            </p>
          )}
        </div>
      </div>

      {action}
    </div>
  );
}

function PlaceholderCard({
  icon: Icon,
  title,
  description,
  buttonText,
  onClick,
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5FAFF]">
        <Icon className="h-6 w-6 text-[#1769E0]" />
      </div>

      <h3 className="mt-4 font-semibold text-[#172033]">
        {title}
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-[#667085]">
        {description}
      </p>

      {buttonText && (
        <button
          type="button"
          onClick={onClick}
          className="mt-5 rounded-xl bg-[#1769E0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1259C1]"
        >
          {buttonText}
        </button>
      )}
    </div>
  );
}

function LoadingPage() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-24 animate-pulse rounded bg-[#EAF4FF]" />

      <div className="rounded-2xl border border-[#E5EDF5] bg-white p-6">
        <div className="animate-pulse">
          <div className="h-6 w-2/3 rounded bg-[#EAF4FF]" />
          <div className="mt-3 h-4 w-1/3 rounded bg-[#F5FAFF]" />

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="h-16 rounded-xl bg-[#F5FAFF]" />
            <div className="h-16 rounded-xl bg-[#F5FAFF]" />
            <div className="h-16 rounded-xl bg-[#F5FAFF]" />
            <div className="h-16 rounded-xl bg-[#F5FAFF]" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl bg-white" />
        <div className="h-72 animate-pulse rounded-2xl bg-white" />
      </div>
    </div>
  );
}

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const projectId = params?.id;

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) {
      return;
    }

    async function fetchProject() {
      try {
        setLoading(true);
        setError("");

        const projectRef = doc(
          db,
          "projects",
          projectId
        );

        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
          setError("This project could not be found.");
          setProject(null);
          return;
        }

        setProject({
          id: projectSnap.id,
          ...projectSnap.data(),
        });
      } catch (fetchError) {
        console.error(
          "Project details error:",
          fetchError
        );

        setError(
          "Unable to load this project. Please try again."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [projectId]);

  if (loading) {
    return <LoadingPage />;
  }

  if (error || !project) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>

          <h2 className="mt-4 text-lg font-semibold text-[#172033]">
            Project not found
          </h2>

          <p className="mt-2 text-sm text-[#667085]">
            {error ||
              "The requested project does not exist."}
          </p>

          <button
            type="button"
            onClick={() => router.push("/admin/projects")}
            className="mt-5 rounded-xl bg-[#1769E0] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1259C1]"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const customerName =
    project.customer?.name ||
    `${project.customer?.firstName || ""} ${
      project.customer?.lastName || ""
    }`.trim() ||
    "No customer";

  const progress = Math.min(
    100,
    Math.max(0, Number(project.progress || 0))
  );

  const remainingAmount =
    Number(project.amount || 0);

  return (
    <div className="space-y-6">
      {/* BACK */}
      <Link
        href="/admin/projects"
        className="inline-flex items-center gap-2 text-sm font-medium text-[#667085] transition hover:text-[#1769E0]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      {/* PROJECT HEADER */}
      <div className="rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EAF4FF]">
                <BriefcaseBusiness className="h-7 w-7 text-[#1769E0]" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight text-[#172033]">
                    {project.name ||
                      "Unnamed Project"}
                  </h1>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                      project.status
                    )}`}
                  >
                    {project.status ||
                      "Unknown"}
                  </span>
                </div>

                <p className="mt-2 text-sm text-[#667085]">
                  {project.service ||
                    "No service specified"}
                </p>

                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#667085]">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#98A2B3]" />
                    {project.location ||
                      "No location"}
                  </span>

                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-[#98A2B3]" />
                    Due{" "}
                    {formatDate(
                      project.deadline
                    )}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push(
                  `/admin/projects/${project.id}/edit`
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DCEAF8] bg-white px-4 py-2.5 text-sm font-semibold text-[#172033] transition hover:border-[#1769E0] hover:text-[#1769E0]"
            >
              <Edit3 className="h-4 w-4" />
              Edit Project
            </button>
          </div>

          {/* PROJECT METRICS */}
          <div className="mt-7 grid gap-4 border-t border-[#E5EDF5] pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#98A2B3]">
                Project Value
              </p>

              <p className="mt-2 text-xl font-bold text-[#172033]">
                {formatCurrency(
                  project.amount
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#98A2B3]">
                Progress
              </p>

              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EAF4FF]">
                  <div
                    className="h-full rounded-full bg-[#1769E0]"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>

                <span className="text-sm font-bold text-[#172033]">
                  {progress}%
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#98A2B3]">
                Deadline
              </p>

              <p className="mt-2 text-sm font-semibold text-[#172033]">
                {formatDate(
                  project.deadline
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#98A2B3]">
                Project ID
              </p>

              <p className="mt-2 truncate font-mono text-xs text-[#667085]">
                {project.id}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* PROJECT INFORMATION */}
        <div className="rounded-2xl border border-[#E5EDF5] bg-white shadow-sm xl:col-span-2">
          <SectionHeader
            icon={FileText}
            title="Project Information"
            description="Details about this project"
          />

          <div className="p-5 sm:p-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <InfoItem
                icon={BriefcaseBusiness}
                label="Service"
                value={project.service}
              />

              <InfoItem
                icon={MapPin}
                label="Location"
                value={project.location}
              />

              <InfoItem
                icon={CalendarDays}
                label="Deadline"
                value={formatDate(
                  project.deadline
                )}
              />

              <InfoItem
                icon={Clock3}
                label="Status"
                value={project.status}
              />
            </div>

            <div className="mt-7 border-t border-[#E5EDF5] pt-6">
              <p className="text-xs font-medium uppercase tracking-wide text-[#98A2B3]">
                Description
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#667085]">
                {project.description ||
                  "No project description provided."}
              </p>
            </div>

            {project.notes && (
              <div className="mt-6 border-t border-[#E5EDF5] pt-6">
                <p className="text-xs font-medium uppercase tracking-wide text-[#98A2B3]">
                  Notes
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#667085]">
                  {project.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* CUSTOMER */}
        <div className="rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
          <SectionHeader
            icon={User}
            title="Customer"
            description="Project customer"
          />

          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF4FF] text-sm font-bold text-[#1769E0]">
                {customerName
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="min-w-0">
                <h3 className="font-semibold text-[#172033]">
                  {customerName}
                </h3>

                {project.customer?.company && (
                  <p className="mt-1 text-sm text-[#667085]">
                    {project.customer.company}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {project.customer?.email && (
                <a
                  href={`mailto:${project.customer.email}`}
                  className="flex items-center gap-3 text-sm text-[#667085] hover:text-[#1769E0]"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="break-all">
                    {project.customer.email}
                  </span>
                </a>
              )}

              {project.customer?.phone && (
                <a
                  href={`tel:${project.customer.phone}`}
                  className="flex items-center gap-3 text-sm text-[#667085] hover:text-[#1769E0]"
                >
                  <Phone className="h-4 w-4 shrink-0" />
                  {project.customer.phone}
                </a>
              )}
            </div>

            {project.leadId && (
              <div className="mt-6 border-t border-[#E5EDF5] pt-5">
                <p className="text-xs text-[#98A2B3]">
                  Original CRM Lead
                </p>

                <p className="mt-1 truncate font-mono text-xs text-[#667085]">
                  {project.leadId}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FINANCIAL SUMMARY */}
      <div className="rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
        <SectionHeader
          icon={WalletCards}
          title="Financial Summary"
          description="Project financial position"
        />

        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-[#F5FAFF] p-4">
            <p className="text-sm text-[#667085]">
              Project Value
            </p>

            <p className="mt-2 text-xl font-bold text-[#172033]">
              {formatCurrency(
                project.amount
              )}
            </p>
          </div>

          <div className="rounded-xl bg-[#F5FAFF] p-4">
            <p className="text-sm text-[#667085]">
              Worker Advances
            </p>

            <p className="mt-2 text-xl font-bold text-[#172033]">
              GH₵0
            </p>

            <p className="mt-1 text-xs text-[#98A2B3]">
              Approved requests
            </p>
          </div>

          <div className="rounded-xl bg-[#F5FAFF] p-4">
            <p className="text-sm text-[#667085]">
              Other Expenses
            </p>

            <p className="mt-2 text-xl font-bold text-[#172033]">
              GH₵0
            </p>

            <p className="mt-1 text-xs text-[#98A2B3]">
              Project expenses
            </p>
          </div>

          <div className="rounded-xl bg-[#EAF4FF] p-4">
            <p className="text-sm text-[#667085]">
              Remaining
            </p>

            <p className="mt-2 text-xl font-bold text-[#1769E0]">
              {formatCurrency(
                remainingAmount
              )}
            </p>

            <p className="mt-1 text-xs text-[#667085]">
              Before expenses
            </p>
          </div>
        </div>
      </div>

      {/* WORKERS + RESOURCES */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ASSIGNED WORKERS */}
        <div className="rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
          <SectionHeader
            icon={Users}
            title="Assigned Workers"
            description="Workers assigned to this project"
            action={
              <button
                type="button"
                className="rounded-lg border border-[#DCEAF8] px-3 py-2 text-xs font-semibold text-[#1769E0] hover:bg-[#F5FAFF]"
              >
                Assign Worker
              </button>
            }
          />

          <PlaceholderCard
            icon={Users}
            title="No workers assigned"
            description="Assign workers to this project so they can view the job, request money, receive resources and submit completed work."
          />
        </div>

        {/* RESOURCES */}
        <div className="rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
          <SectionHeader
            icon={Package}
            title="Project Resources"
            description="Equipment and materials used"
            action={
              <button
                type="button"
                className="rounded-lg border border-[#DCEAF8] px-3 py-2 text-xs font-semibold text-[#1769E0] hover:bg-[#F5FAFF]"
              >
                Add Resource
              </button>
            }
          />

          <PlaceholderCard
            icon={Package}
            title="No resources assigned"
            description="Resources issued to workers for this project will appear here."
          />
        </div>
      </div>

      {/* WORK SUBMISSIONS */}
      <div className="rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
        <SectionHeader
          icon={ImageIcon}
          title="Completed Work"
          description="Review photos and work submitted by workers"
        />

        <PlaceholderCard
          icon={ImageIcon}
          title="No work submissions"
          description="When assigned workers submit photos of completed work, you'll be able to review and approve them here."
        />
      </div>

      {/* PAYMENT */}
      <div className="rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
        <SectionHeader
          icon={WalletCards}
          title="Worker Payment"
          description="Calculate and record payment after work approval"
        />

        <div className="p-5 sm:p-6">
          <div className="rounded-xl border border-dashed border-[#DCEAF8] bg-[#F8FBFF] p-6 text-center">
            <WalletCards className="mx-auto h-7 w-7 text-[#1769E0]" />

            <h3 className="mt-3 font-semibold text-[#172033]">
              Payment not ready
            </h3>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#667085]">
              Worker payments will become available after workers
              are assigned, approved expenses are recorded and
              completed work has been approved.
            </p>
          </div>
        </div>
      </div>

      {/* PROJECT ACTIVITY */}
      <div className="rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
        <SectionHeader
          icon={MoreHorizontal}
          title="Project Activity"
          description="History of actions on this project"
        />

        <div className="p-6 text-center">
          <p className="text-sm text-[#98A2B3]">
            Project activity will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
