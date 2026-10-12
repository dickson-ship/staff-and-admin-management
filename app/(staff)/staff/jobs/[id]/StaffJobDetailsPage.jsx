"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  UserRound,
  WalletCards,
  Wrench,
  AlertCircle,
  ChevronRight,
  CircleDollarSign,
  Camera,
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

const statusConfig = {
  assigned: {
    label: "Assigned",
    className: "bg-blue-50 text-blue-700 border-blue-100",
    icon: Clock3,
  },

  "in-progress": {
    label: "In Progress",
    className: "bg-amber-50 text-amber-700 border-amber-100",
    icon: BriefcaseBusiness,
  },

  completed: {
    label: "Completed",
    className: "bg-green-50 text-green-700 border-green-100",
    icon: CheckCircle2,
  },

  cancelled: {
    label: "Cancelled",
    className: "bg-red-50 text-red-700 border-red-100",
    icon: AlertCircle,
  },
};

function formatDate(value) {
  if (!value) return "Not set";

  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Not set";
    }

    return date.toLocaleDateString("en-GH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Not set";
  }
}

function formatDateTime(value) {
  if (!value) return "Not set";

  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Not set";
    }

    return date.toLocaleString("en-GH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "Not set";
  }
}

function formatMoney(value) {
  const amount = Number(value || 0);

  return `GH₵ ${amount.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getProgress(value) {
  const progress = Number(value);

  if (Number.isNaN(progress)) return 0;

  return Math.min(Math.max(progress, 0), 100);
}

function getStatus(status) {
  return (
    statusConfig[status] || {
      label: status || "Unknown",
      className: "bg-gray-50 text-gray-700 border-gray-100",
      icon: AlertCircle,
    }
  );
}

/*
 * Compress image before storing in Firestore.
 *
 * Firestore has a document size limit, so we don't want
 * to save the original camera image.
 */
function compressImage(file, maxWidth = 1000, quality = 0.65) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const image = new Image();

      image.onload = () => {
        let width = image.width;
        let height = image.height;

        if (width > maxWidth) {
          const ratio = maxWidth / width;

          width = maxWidth;
          height = height * ratio;
        }

        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        context.drawImage(
          image,
          0,
          0,
          width,
          height
        );

        const compressed = canvas.toDataURL(
          "image/jpeg",
          quality
        );

        resolve(compressed);
      };

      image.onerror = () => {
        reject(new Error("Unable to process image."));
      };

      image.src = event.target.result;
    };

    reader.onerror = () => {
      reject(new Error("Unable to read image."));
    };

    reader.readAsDataURL(file);
  });
}

export default function StaffJobDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const { user, loading: authLoading } = useAuth();

  const assignmentId = params?.id;

  const [assignment, setAssignment] = useState(null);
  const [project, setProject] = useState(null);
  const [requests, setRequests] = useState([]);
  const [workSubmissions, setWorkSubmissions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /*
   * Work submission state
   */
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [workComment, setWorkComment] = useState("");
  const [submittingWork, setSubmittingWork] = useState(false);
  const [workMessage, setWorkMessage] = useState("");
  const [workError, setWorkError] = useState("");

  useEffect(() => {
    if (authLoading || !user || !assignmentId) {
      return;
    }

    let unsubscribeRequests;
    let unsubscribeSubmissions;

    async function loadJob() {
      try {
        setLoading(true);
        setError("");

        /*
         * Load assignment.
         */
        const assignmentRef = doc(
          db,
          "assignments",
          assignmentId
        );

        const assignmentSnap = await getDoc(assignmentRef);

        if (!assignmentSnap.exists()) {
          setError("This job assignment could not be found.");
          setLoading(false);
          return;
        }

        const assignmentData = {
          id: assignmentSnap.id,
          ...assignmentSnap.data(),
        };

        /*
         * Make sure this assignment belongs to
         * the logged-in staff member.
         */
        if (assignmentData.workerId !== user.uid) {
          setError(
            "You do not have permission to view this job."
          );

          setLoading(false);
          return;
        }

        setAssignment(assignmentData);

        /*
         * Load project.
         */
        if (assignmentData.projectId) {
          const projectSnap = await getDoc(
            doc(db, "projects", assignmentData.projectId)
          );

          if (projectSnap.exists()) {
            setProject({
              id: projectSnap.id,
              ...projectSnap.data(),
            });
          }
        }

        /*
         * Load money requests.
         */
        if (assignmentData.projectId) {
          const requestsQuery = query(
            collection(db, "moneyRequests"),
            where("workerId", "==", user.uid),
            where(
              "projectId",
              "==",
              assignmentData.projectId
            )
          );

          unsubscribeRequests = onSnapshot(
            requestsQuery,
            (snapshot) => {
              const requestData = snapshot.docs
                .map((requestDoc) => ({
                  id: requestDoc.id,
                  ...requestDoc.data(),
                }))
                .sort((a, b) => {
                  const aTime =
                    typeof a.createdAt?.toMillis === "function"
                      ? a.createdAt.toMillis()
                      : 0;

                  const bTime =
                    typeof b.createdAt?.toMillis === "function"
                      ? b.createdAt.toMillis()
                      : 0;

                  return bTime - aTime;
                });

              setRequests(requestData);
            }
          );
        }

        /*
         * Load work submissions.
         */
        const submissionsQuery = query(
          collection(db, "workSubmissions"),
          where("assignmentId", "==", assignmentId),
          where("workerId", "==", user.uid)
        );

        unsubscribeSubmissions = onSnapshot(
          submissionsQuery,
          (snapshot) => {
            const submissions = snapshot.docs
              .map((submissionDoc) => ({
                id: submissionDoc.id,
                ...submissionDoc.data(),
              }))
              .sort((a, b) => {
                const aTime =
                  typeof a.createdAt?.toMillis === "function"
                    ? a.createdAt.toMillis()
                    : 0;

                const bTime =
                  typeof b.createdAt?.toMillis === "function"
                    ? b.createdAt.toMillis()
                    : 0;

                return bTime - aTime;
              });

            setWorkSubmissions(submissions);
          }
        );

        setLoading(false);
      } catch (loadError) {
        console.error("Error loading job:", loadError);

        setError(
          "Unable to load this job. Please try again."
        );

        setLoading(false);
      }
    }

    loadJob();

    return () => {
      if (unsubscribeRequests) {
        unsubscribeRequests();
      }

      if (unsubscribeSubmissions) {
        unsubscribeSubmissions();
      }
    };
  }, [user, authLoading, assignmentId]);

  /*
   * Handle selecting photos.
   */
  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);

    setWorkError("");
    setWorkMessage("");

    if (!files.length) return;

    /*
     * Keep the number of photos small because
     * we are storing them in Firestore.
     */
    if (files.length > 4) {
      setWorkError(
        "You can upload a maximum of 4 photos per work update."
      );

      return;
    }

    const validFiles = files.filter((file) => {
      if (!file.type.startsWith("image/")) {
        return false;
      }

      /*
       * Original file can be up to 10MB because
       * we compress it before Firestore.
       */
      if (file.size > 10 * 1024 * 1024) {
        return false;
      }

      return true;
    });

    if (validFiles.length !== files.length) {
      setWorkError(
        "Some files were rejected. Please select image files under 10MB each."
      );
    }

    setSelectedFiles(validFiles);
  }

  /*
   * Remove selected image.
   */
  function removeSelectedFile(index) {
    setSelectedFiles((current) =>
      current.filter((_, fileIndex) => fileIndex !== index)
    );
  }

  /*
   * Submit work update.
   */
  async function handleSubmitWork() {
    if (!user || !assignment || !project) {
      return;
    }

    setWorkError("");
    setWorkMessage("");

    if (!selectedFiles.length) {
      setWorkError(
        "Please upload at least one photo of your work."
      );

      return;
    }

    if (!workComment.trim()) {
      setWorkError(
        "Please add a short comment describing the work."
      );

      return;
    }

    try {
      setSubmittingWork(true);

      /*
       * Compress images.
       */
      const images = [];

      for (const file of selectedFiles) {
        const compressedImage = await compressImage(file);

        images.push({
          name: file.name,
          type: "image/jpeg",
          data: compressedImage,
        });
      }

      /*
       * Save submission.
       */
      await addDoc(collection(db, "workSubmissions"), {
        assignmentId: assignment.id,
        projectId: project.id,

        workerId: user.uid,
        workerName:
          user.displayName ||
          user.email ||
          "Staff member",

        images,

        comment: workComment.trim(),

        /*
         * Worker submission status.
         *
         * The worker DOES NOT mark the job completed.
         */
        status: "submitted",

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      /*
       * Clear form.
       */
      setSelectedFiles([]);
      setWorkComment("");

      setWorkMessage(
        "Your work update has been submitted successfully."
      );
    } catch (submissionError) {
      console.error(
        "Error submitting work:",
        submissionError
      );

      setWorkError(
        "Unable to submit your work update. Please try again."
      );
    } finally {
      setSubmittingWork(false);
    }
  }

  const status = useMemo(
    () => getStatus(assignment?.status),
    [assignment?.status]
  );

  const StatusIcon = status.icon;

  const progress = getProgress(project?.progress);

  const customerName =
    project?.customer?.name ||
    [
      project?.customer?.firstName,
      project?.customer?.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Customer";

  const approvedRequests = requests.filter(
    (request) => request.status === "approved"
  );

  const pendingRequests = requests.filter(
    (request) => request.status === "pending"
  );

  const approvedAmount = approvedRequests.reduce(
    (total, request) =>
      total + Number(request.amount || 0),
    0
  );

  if (authLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-28 animate-pulse rounded bg-gray-200" />

        <div className="h-48 animate-pulse rounded-2xl bg-white" />

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="h-64 animate-pulse rounded-2xl bg-white lg:col-span-2" />

          <div className="h-64 animate-pulse rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#667085] hover:text-[#1769E0]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to jobs
        </button>

        <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-red-500">
            <AlertCircle className="h-7 w-7" />
          </div>

          <h1 className="mt-4 text-lg font-bold text-[#172033]">
            Unable to open job
          </h1>

          <p className="mx-auto mt-2 max-w-md text-sm text-[#667085]">
            {error}
          </p>

          <button
            type="button"
            onClick={() => router.push("/staff/jobs")}
            className="mt-5 rounded-xl bg-[#1769E0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1259C2]"
          >
            Back to My Jobs
          </button>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* BACK */}
      <Link
        href="/staff/jobs"
        className="inline-flex items-center gap-2 text-sm font-medium text-[#667085] transition hover:text-[#1769E0]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Jobs
      </Link>

      {/* HERO */}
      <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
        <div className="bg-gradient-to-br from-[#0F3D70] via-[#1769E0] to-[#3184EC] px-5 py-7 text-white sm:px-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <BriefcaseBusiness className="h-7 w-7" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-medium text-blue-100">
                  Assigned Job
                </p>

                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                  {project?.name || "Project"}
                </h1>

                <p className="mt-2 text-sm text-blue-100">
                  {project?.service ||
                    "Construction project"}
                </p>
              </div>
            </div>

            <div
              className={`inline-flex w-fit items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-bold ${status.className}`}
            >
              <StatusIcon className="h-4 w-4" />
              {status.label}
            </div>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <HeroDetail
              icon={MapPin}
              label="Location"
              value={project?.location || "Not set"}
            />

            <HeroDetail
              icon={CalendarDays}
              label="Expected completion"
              value={formatDate(
                assignment.expectedCompletion
              )}
            />

            <HeroDetail
              icon={UserRound}
              label="Customer"
              value={customerName}
            />
          </div>
        </div>

        {/* PROGRESS */}
        <div className="p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#172033]">
                Project Progress
              </p>

              <p className="mt-1 text-xs text-[#667085]">
                Current progress reported for this project
              </p>
            </div>

            <span className="text-lg font-bold text-[#1769E0]">
              {progress}%
            </span>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#EAF4FF]">
            <div
              className="h-full rounded-full bg-[#1769E0] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[#172033]">
            Quick Actions
          </h2>

          <p className="mt-1 text-sm text-[#667085]">
            Manage things related to this job.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            href={`/staff/requests?projectId=${
              project?.id || ""
            }`}
            icon={WalletCards}
            title="Request Money"
            description="Request transport, food or other expenses."
          />

          <QuickAction
            href="/staff/resources"
            icon={Wrench}
            title="My Resources"
            description="View equipment assigned to you."
          />

          <QuickAction
            href="#work-submission"
            icon={Camera}
            title="Work Updates"
            description="Upload photos and update the admin."
          />

          <QuickAction
            href="#job-notes"
            icon={MessageSquare}
            title="Job Notes"
            description="View instructions and project notes."
          />
        </div>
      </section>

      {/* MAIN CONTENT */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT */}
        <div className="space-y-6 lg:col-span-2">
          {/* PROJECT INFORMATION */}
          <section className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm sm:p-6">
            <SectionHeader
              icon={BriefcaseBusiness}
              title="Project Information"
              description="Details about the project you are working on."
            />

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <InfoItem
                label="Project name"
                value={
                  project?.name || "Not available"
                }
              />

              <InfoItem
                label="Service"
                value={
                  project?.service || "Not available"
                }
              />

              <InfoItem
                label="Location"
                value={
                  project?.location || "Not available"
                }
              />

              <InfoItem
                label="Project deadline"
                value={formatDate(project?.deadline)}
              />

              <InfoItem
                label="Project status"
                value={
                  project?.status || "Not available"
                }
              />

              <InfoItem
                label="Assigned date"
                value={formatDate(assignment.createdAt)}
              />
            </div>

            {project?.description && (
              <div className="mt-6 border-t border-[#EEF3F8] pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
                  Project Description
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#667085]">
                  {project.description}
                </p>
              </div>
            )}

            {assignment.notes && (
              <div
                id="job-notes"
                className="mt-5 rounded-xl border border-blue-100 bg-[#F5FAFF] p-4"
              >
                <div className="flex gap-3">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#1769E0]" />

                  <div>
                    <p className="text-sm font-semibold text-[#172033]">
                      Assignment Notes
                    </p>

                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#667085]">
                      {assignment.notes}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* CUSTOMER */}
          <section className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm sm:p-6">
            <SectionHeader
              icon={UserRound}
              title="Customer"
              description="Customer information related to this project."
            />

            <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#EAF4FF] text-[#1769E0]">
                <UserRound className="h-6 w-6" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-[#172033]">
                  {customerName}
                </h3>

                {project?.customer?.company && (
                  <p className="mt-1 text-sm text-[#667085]">
                    {project.customer.company}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {project?.customer?.phone && (
                  <a
                    href={`tel:${project.customer.phone}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#DCEAF8] px-3 py-2 text-sm font-medium text-[#1769E0] hover:bg-[#F5FAFF]"
                  >
                    <Phone className="h-4 w-4" />
                    Call
                  </a>
                )}

                {project?.customer?.email && (
                  <a
                    href={`mailto:${project.customer.email}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#DCEAF8] px-3 py-2 text-sm font-medium text-[#1769E0] hover:bg-[#F5FAFF]"
                  >
                    <Mail className="h-4 w-4" />
                    Email
                  </a>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-4 border-t border-[#EEF3F8] pt-5 sm:grid-cols-2">
              <InfoItem
                label="Phone"
                value={
                  project?.customer?.phone ||
                  "Not available"
                }
              />

              <InfoItem
                label="Email"
                value={
                  project?.customer?.email ||
                  "Not available"
                }
              />
            </div>
          </section>

          {/* WORK UPDATES */}
          <section
            id="work-submission"
            className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm sm:p-6"
          >
            <SectionHeader
              icon={Camera}
              title="Work Updates"
              description="Upload photos of your work at any time. Admin will review your updates."
            />

            {/* FORM */}
            <div className="mt-6 rounded-2xl border border-dashed border-[#C9DDF4] bg-[#F8FBFF] p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
                  <Camera className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-[#172033]">
                    Upload work photos
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-[#667085]">
                    You can upload photos while working on
                    the project. You do not need to wait until
                    the job is finished.
                  </p>
                </div>
              </div>

              {/* FILE INPUT */}
              <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#C9DDF4] bg-white px-5 py-8 text-center transition hover:border-[#1769E0] hover:bg-[#F5FAFF]">
                <Upload className="h-7 w-7 text-[#1769E0]" />

                <p className="mt-3 text-sm font-semibold text-[#172033]">
                  Click to upload photos
                </p>

                <p className="mt-1 text-xs text-[#667085]">
                  PNG, JPG or JPEG · Maximum 4 photos
                </p>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {/* SELECTED PHOTOS */}
              {selectedFiles.length > 0 && (
                <div className="mt-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
                    Selected photos
                  </p>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {selectedFiles.map((file, index) => (
                      <SelectedImage
                        key={`${file.name}-${index}`}
                        file={file}
                        onRemove={() =>
                          removeSelectedFile(index)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* COMMENT */}
              <div className="mt-5">
                <label className="text-sm font-semibold text-[#172033]">
                  Work description
                </label>

                <textarea
                  value={workComment}
                  onChange={(event) =>
                    setWorkComment(event.target.value)
                  }
                  rows={4}
                  placeholder="Describe what you completed or the progress you made..."
                  className="mt-2 w-full rounded-xl border border-[#DCEAF8] bg-white px-4 py-3 text-sm text-[#172033] outline-none transition placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* ERROR */}
              {workError && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

                  <p>{workError}</p>
                </div>
              )}

              {/* SUCCESS */}
              {workMessage && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

                  <p>{workMessage}</p>
                </div>
              )}

              {/* SUBMIT */}
              <button
                type="button"
                onClick={handleSubmitWork}
                disabled={
                  submittingWork ||
                  assignment.status === "completed" ||
                  assignment.status === "cancelled"
                }
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1259C2] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 sm:w-auto"
              >
                {submittingWork ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Submit Work Update
                  </>
                )}
              </button>

              <p className="mt-3 text-xs leading-5 text-[#98A2B3]">
                Submitting this update does not complete the
                job. Only the admin can mark the job as completed.
              </p>
            </div>

            {/* SUBMISSION HISTORY */}
            <div className="mt-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#172033]">
                    Submission History
                  </h3>

                  <p className="mt-1 text-xs text-[#667085]">
                    Photos and updates you have submitted.
                  </p>
                </div>

                <span className="rounded-full bg-[#EAF4FF] px-2.5 py-1 text-xs font-bold text-[#1769E0]">
                  {workSubmissions.length}
                </span>
              </div>

              {workSubmissions.length === 0 ? (
                <div className="mt-4 rounded-xl border border-[#E5EDF5] bg-[#F8FBFF] p-6 text-center">
                  <ImageIcon className="mx-auto h-7 w-7 text-[#98A2B3]" />

                  <p className="mt-2 text-sm font-semibold text-[#172033]">
                    No work updates yet
                  </p>

                  <p className="mt-1 text-xs text-[#667085]">
                    Your submitted work updates will appear
                    here.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {workSubmissions.map((submission) => (
                    <WorkSubmissionCard
                      key={submission.id}
                      submission={submission}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {/* ASSIGNMENT */}
          <section className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm">
            <SectionHeader
              icon={CalendarDays}
              title="Assignment"
              description="Your assignment details."
            />

            <div className="mt-5 space-y-4">
              <InfoItem
                label="Start date"
                value={formatDate(assignment.startDate)}
              />

              <InfoItem
                label="Expected completion"
                value={formatDate(
                  assignment.expectedCompletion
                )}
              />

              <InfoItem
                label="Assignment status"
                value={status.label}
              />
            </div>
          </section>

          {/* FINANCIAL */}
          <section className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm">
            <SectionHeader
              icon={CircleDollarSign}
              title="Job Expenses"
              description="Your approved money requests for this job."
            />

            <div className="mt-5 rounded-xl bg-[#F5FAFF] p-4">
              <p className="text-xs font-medium text-[#667085]">
                Approved expenses
              </p>

              <p className="mt-1 text-xl font-bold text-[#172033]">
                {formatMoney(approvedAmount)}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniStat
                label="Pending"
                value={pendingRequests.length}
              />

              <MiniStat
                label="Requests"
                value={requests.length}
              />
            </div>

            <Link
              href={`/staff/requests?projectId=${
                project?.id || ""
              }`}
              className="mt-4 flex items-center justify-between rounded-xl border border-[#DCEAF8] px-4 py-3 text-sm font-semibold text-[#1769E0] transition hover:bg-[#F5FAFF]"
            >
              <span>View my requests</span>

              <ChevronRight className="h-4 w-4" />
            </Link>
          </section>

          {/* PROJECT VALUE */}


          {/* RESOURCES */}
          <section className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm">
            <SectionHeader
              icon={Wrench}
              title="My Resources"
              description="Equipment assigned to you."
            />

            <div className="mt-5 rounded-xl border border-dashed border-[#DCEAF8] bg-[#F8FBFF] p-5 text-center">
              <Wrench className="mx-auto h-6 w-6 text-[#1769E0]" />

              <p className="mt-2 text-sm font-semibold text-[#172033]">
                Resource tracking
              </p>

              <p className="mt-1 text-xs leading-5 text-[#667085]">
                Your assigned tools and equipment will appear
                here.
              </p>

              <Link
                href="/staff/resources"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1769E0]"
              >
                View resources

                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------
   COMPONENTS
--------------------------------------------- */

function HeroDetail({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
      <div className="flex items-center gap-2 text-blue-100">
        <Icon className="h-4 w-4" />

        <span className="text-xs font-medium">
          {label}
        </span>
      </div>

      <p className="mt-1 truncate text-sm font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
        <Icon className="h-5 w-5" />
      </div>

      <div>
        <h2 className="font-bold text-[#172033]">
          {title}
        </h2>

        <p className="mt-1 text-xs leading-5 text-[#667085]">
          {description}
        </p>
      </div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-medium text-[#172033]">
        {value}
      </p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border border-[#E5EDF5] bg-white p-3">
      <p className="text-xs text-[#667085]">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold text-[#172033]">
        {value}
      </p>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-[#E5EDF5] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#BFD8F7] hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
          <Icon className="h-5 w-5" />
        </div>

        <ChevronRight className="h-4 w-4 text-[#98A2B3] transition group-hover:translate-x-0.5 group-hover:text-[#1769E0]" />
      </div>

      <h3 className="mt-4 text-sm font-bold text-[#172033]">
        {title}
      </h3>

      <p className="mt-1 text-xs leading-5 text-[#667085]">
        {description}
      </p>
    </Link>
  );
}

/*
 * Selected photo preview.
 */
function SelectedImage({ file, onRemove }) {
  const [preview, setPreview] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(file);

    setPreview(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#DCEAF8] bg-white">
      {preview && (
        <img
          src={preview}
          alt={file.name}
          className="aspect-square w-full object-cover"
        />
      )}

      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/*
 * Previous work submission.
 */
function WorkSubmissionCard({ submission }) {
  return (
    <div className="rounded-2xl border border-[#E5EDF5] bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-[#172033]">
            Work Update
          </p>

          <p className="mt-1 text-xs text-[#98A2B3]">
            {formatDateTime(submission.createdAt)}
          </p>
        </div>

        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
          <Clock3 className="h-3.5 w-3.5" />
          {submission.status === "submitted"
            ? "Submitted"
            : submission.status}
        </span>
      </div>

      {/* PHOTOS */}
      {submission.images?.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {submission.images.map((image, index) => (
            <a
              key={`${image.name}-${index}`}
              href={image.data}
              target="_blank"
              rel="noopener noreferrer"
              className="overflow-hidden rounded-xl border border-[#E5EDF5]"
            >
              <img
                src={image.data}
                alt={`Work photo ${index + 1}`}
                className="aspect-square w-full object-cover transition hover:scale-105"
              />
            </a>
          ))}
        </div>
      )}

      {/* COMMENT */}
      {submission.comment && (
        <div className="mt-4 rounded-xl bg-[#F8FBFF] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
            Comment
          </p>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#667085]">
            {submission.comment}
          </p>
        </div>
      )}
    </div>
  );
}