"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Edit3,
  ExternalLink,
  FileImage,
  FileText,
  LoaderCircle,
  MapPin,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
  Users,
  X,
  AlertCircle,
  Image as ImageIcon,
  Download,
  File,
  Eye,
} from "lucide-react";

import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

const PROJECT_STATUSES = [
  "Planning",
  "In Progress",
  "Completed",
  "Cancelled",
];

const inputClass =
  "w-full rounded-xl border border-[#DCEAF8] bg-white px-3.5 py-2.5 text-sm text-[#172033] outline-none transition focus:border-[#1769E0] focus:ring-2 focus:ring-[#EAF4FF]";

/* --------------------------------------------------
   GENERAL HELPERS
-------------------------------------------------- */

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function getTimestamp(value) {
  if (!value) return 0;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value) {
  const timestamp = getTimestamp(value);

  if (!timestamp) return "Not specified";

  return new Date(timestamp).toLocaleDateString("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  const timestamp = getTimestamp(value);

  if (!timestamp) return "Date unavailable";

  return new Date(timestamp).toLocaleString("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusClasses(status) {
  switch (String(status || "").toLowerCase()) {
    case "completed":
      return "border-green-200 bg-green-50 text-green-700";

    case "in progress":
    case "in_progress":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "planning":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getPersonName(person) {
  if (!person) return "Unknown worker";

  return (
    person.name ||
    person.fullName ||
    [person.firstName, person.lastName].filter(Boolean).join(" ").trim() ||
    person.email ||
    "Unknown worker"
  );
}

function getCustomerName(project) {
  const customer = project?.customer || {};

  return (
    customer.name ||
    [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() ||
    customer.fullName ||
    project?.customerName ||
    "No customer"
  );
}

function getSubmissionDescription(submission) {
  return (
    submission.workDescription ||
    submission.description ||
    submission.notes ||
    submission.comment ||
    submission.message ||
    submission.details ||
    ""
  );
}

/* --------------------------------------------------
   ATTACHMENT DETECTION

   Recognises common URL and data fields:
   imageUrl, photoUrl, fileUrl, attachmentUrl,
   files, photos, attachments, imageDataUrl,
   fileBase64, and similar names.

   A usable URL or actual file data must exist.
-------------------------------------------------- */

const ATTACHMENT_FIELD_PATTERN =
  /image|photo|picture|file|attachment|document|proof|upload|media|base64|dataurl|downloadurl|work.?file/i;

const URL_FIELD_NAMES = new Set([
  "url",
  "src",
  "href",
  "downloadurl",
  "downloadURL",
  "fileurl",
  "fileURL",
  "imageurl",
  "imageURL",
  "photourl",
  "photoURL",
]);

const BASE64_FIELD_NAMES = new Set([
  "base64",
  "fileBase64",
  "imageBase64",
  "photoBase64",
  "data",
  "content",
  "fileData",
  "imageData",
  "photoData",
]);

function guessMimeType(name = "", source = "", providedType = "") {
  const explicitType = String(providedType || "").toLowerCase();

  if (
    explicitType.startsWith("image/") ||
    explicitType.startsWith("application/") ||
    explicitType.startsWith("text/")
  ) {
    return explicitType;
  }

  const combined = `${name} ${source}`.toLowerCase();

  if (/\.jpe?g(?:[?#]|$)|data:image\/jpe?g/i.test(combined)) {
    return "image/jpeg";
  }

  if (/\.png(?:[?#]|$)|data:image\/png/i.test(combined)) {
    return "image/png";
  }

  if (/\.gif(?:[?#]|$)|data:image\/gif/i.test(combined)) {
    return "image/gif";
  }

  if (/\.webp(?:[?#]|$)|data:image\/webp/i.test(combined)) {
    return "image/webp";
  }

  if (/\.avif(?:[?#]|$)|data:image\/avif/i.test(combined)) {
    return "image/avif";
  }

  if (/\.pdf(?:[?#]|$)|pdf/i.test(name)) {
    return "application/pdf";
  }

  if (/\.docx?(?:[?#]|$)/i.test(combined)) {
    return "application/msword";
  }

  if (/\.xlsx?(?:[?#]|$)/i.test(combined)) {
    return "application/vnd.ms-excel";
  }

  return "";
}

function guessAttachmentName(source, providedName = "", index = 0) {
  if (
    providedName &&
    providedName !== "Submitted attachment" &&
    providedName !== "attachments" &&
    providedName !== "files"
  ) {
    return providedName;
  }

  if (typeof source === "string") {
    try {
      if (source.startsWith("data:")) {
        return `Submitted file ${index + 1}`;
      }

      const parsed = new URL(source);

      const filename = decodeURIComponent(
        parsed.pathname.split("/").pop() || ""
      );

      if (filename && filename.includes(".")) {
        return filename;
      }
    } catch {
      // Keep the fallback below for data URLs or unusual filenames.
    }
  }

  return `Attachment ${index + 1}`;
}

function getSubmissionAttachments(submission) {
  const attachments = [];

  function addAttachment(source, name = "", type = "") {
    if (typeof source !== "string") return;

    const src = source.trim();

    if (!src) return;

    // Browser blob URLs are local to the uploading browser and cannot
    // generally be used by a different admin device.
    const isHttpUrl = /^https?:\/\//i.test(src);
    const isDataUrl = /^data:[^,]+,/i.test(src);

    if (!isHttpUrl && !isDataUrl) return;

    if (attachments.some((item) => item.src === src)) return;

    const mimeType = guessMimeType(name, src, type);

    attachments.push({
      src,
      name: guessAttachmentName(src, name, attachments.length),
      type: mimeType,
    });
  }

  function decodeBase64(value, fieldName, name, mimeType) {
    if (typeof value !== "string") return;

    let encoded = value.trim();

    if (encoded.startsWith("data:")) {
      addAttachment(encoded, name || fieldName, mimeType);
      return;
    }

    // Avoid interpreting short descriptions or arbitrary text as files.
    if (encoded.length < 100) return;

    encoded = encoded.replace(/\s/g, "");

    // Basic Base64 characters only. This is not a substitute for proper
    // file upload storage, but supports Base64 data already in Firestore.
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return;

    const inferredMime =
      guessMimeType(name, "", mimeType) ||
      (/image|photo|picture/i.test(fieldName)
        ? "image/jpeg"
        : /pdf/i.test(`${fieldName} ${name}`)
        ? "application/pdf"
        : "application/octet-stream");

    addAttachment(
      `data:${inferredMime};base64,${encoded}`,
      name || fieldName,
      inferredMime
    );
  }

  function walk(
    value,
    fieldName = "",
    inherited = {},
    depth = 0
  ) {
    if (value == null || depth > 7) return;

    const field = String(fieldName || "");
    const isAttachmentContext =
      inherited.isAttachment ||
      ATTACHMENT_FIELD_PATTERN.test(field);

    if (Array.isArray(value)) {
      value.forEach((item) =>
        walk(
          item,
          fieldName,
          { ...inherited, isAttachment: isAttachmentContext },
          depth + 1
        )
      );
      return;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (BASE64_FIELD_NAMES.has(fieldName)) {
        decodeBase64(
          trimmed,
          fieldName,
          inherited.name || fieldName,
          inherited.type || ""
        );
        return;
      }

      if (
        isAttachmentContext ||
        URL_FIELD_NAMES.has(fieldName)
      ) {
        addAttachment(
          trimmed,
          inherited.name || fieldName,
          inherited.type || ""
        );
      }

      return;
    }

    if (typeof value !== "object") return;

    const mimeType =
      value.mimeType ||
      value.contentType ||
      value.fileType ||
      value.type ||
      inherited.type ||
      "";

    const name =
      value.fileName ||
      value.filename ||
      value.originalName ||
      value.originalFilename ||
      value.name ||
      inherited.name ||
      fieldName ||
      "Submitted attachment";

    // Direct URL and Base64 fields within the attachment object.
    for (const key of URL_FIELD_NAMES) {
      const directValue = value[key];

      if (typeof directValue === "string") {
        addAttachment(directValue, name, mimeType);
      }
    }

    for (const key of BASE64_FIELD_NAMES) {
      if (typeof value[key] === "string") {
        decodeBase64(value[key], key, name, mimeType);
      }
    }

    // Scan likely attachment fields recursively, including nested file
    // metadata and arrays such as [{ name, url, type }].
    for (const [key, child] of Object.entries(value)) {
      if (
        URL_FIELD_NAMES.has(key) ||
        BASE64_FIELD_NAMES.has(key)
      ) {
        continue;
      }

      if (
        ATTACHMENT_FIELD_PATTERN.test(key) ||
        isAttachmentContext
      ) {
        walk(
          child,
          key,
          {
            name,
            type: mimeType,
            isAttachment: true,
          },
          depth + 1
        );
      }
    }
  }

  for (const [key, value] of Object.entries(submission || {})) {
    if (ATTACHMENT_FIELD_PATTERN.test(key)) {
      walk(
        value,
        key,
        {
          name: "",
          type:
            submission.mimeType ||
            submission.contentType ||
            "",
          isAttachment: true,
        },
        0
      );
    }
  }

  return attachments;
}

function isImageAttachment(attachment) {
  const mimeType = String(attachment.type || "").toLowerCase();
  const src = String(attachment.src || "").toLowerCase();

  if (mimeType.startsWith("image/")) return true;
  if (src.startsWith("data:image/")) return true;

  return /\.(png|jpe?g|gif|webp|bmp|avif|svg)(?:[?#]|$)/i.test(src);
}

function isPdfAttachment(attachment) {
  const mimeType = String(attachment.type || "").toLowerCase();
  const src = String(attachment.src || "").toLowerCase();

  return (
    mimeType === "application/pdf" ||
    src.startsWith("data:application/pdf") ||
    /\.pdf(?:[?#]|$)/i.test(src)
  );
}

/* --------------------------------------------------
   UI COMPONENTS
-------------------------------------------------- */

function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#E5EDF5] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FF]">
          <Icon className="h-5 w-5 text-[#1769E0]" />
        </div>

        <div>
          <h2 className="font-semibold text-[#172033]">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-[#667085]">{description}</p>
          )}
        </div>
      </div>

      {action}
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5FAFF]">
        <Icon className="h-4 w-4 text-[#1769E0]" />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-[#98A2B3]">{label}</p>
        <p className="mt-1 break-words text-sm font-medium text-[#172033]">
          {value || "Not provided"}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="px-5 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#F5FAFF] text-[#1769E0]">
        <Icon size={23} />
      </div>

      <h3 className="mt-3 font-semibold text-[#172033]">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[#667085]">
        {description}
      </p>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
        status
      )}`}
    >
      {status || "Unknown"}
    </span>
  );
}

function AttachmentCard({ attachment, index }) {
  const image = isImageAttachment(attachment);
  const pdf = isPdfAttachment(attachment);

  const [imageFailed, setImageFailed] = useState(false);

  const Icon = pdf ? FileText : File;

  return (
    <div className="overflow-hidden rounded-xl border border-[#E5EDF5] bg-white">
      {image && !imageFailed ? (
        <a
          href={attachment.src}
          target="_blank"
          rel="noreferrer"
          className="block bg-[#F8FBFF]"
          title="Open submitted image"
        >
          <img
            src={attachment.src}
            alt={attachment.name || `Submitted image ${index + 1}`}
            className="h-44 w-full object-cover transition hover:opacity-90"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        </a>
      ) : (
        <a
          href={attachment.src}
          target="_blank"
          rel="noreferrer"
          className="flex h-44 flex-col items-center justify-center gap-3 bg-[#F8FBFF] p-4 text-center transition hover:bg-[#EAF4FF]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#1769E0] shadow-sm">
            {image ? <ImageIcon size={24} /> : <Icon size={24} />}
          </div>

          <span className="text-xs text-[#667085]">
            {image
              ? "Image preview unavailable"
              : pdf
              ? "PDF document"
              : "Attached file"}
          </span>
        </a>
      )}

      <div className="flex items-center gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-[#344054]">
            {attachment.name || `Attachment ${index + 1}`}
          </p>

          <p className="mt-1 truncate text-[11px] text-[#98A2B3]">
            {attachment.type || (image ? "Image" : "File")}
          </p>
        </div>

        <a
          href={attachment.src}
          target="_blank"
          rel="noreferrer"
          title="Open attachment"
          aria-label={`Open ${attachment.name || "attachment"}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#1769E0] hover:bg-[#EAF4FF]"
        >
          <ExternalLink size={16} />
        </a>
      </div>
    </div>
  );
}

function LoadingPage() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LoaderCircle className="animate-spin text-[#1769E0]" size={28} />
    </div>
  );
}

/* --------------------------------------------------
   MAIN PROJECT DETAILS PAGE
-------------------------------------------------- */

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const { user, profile, loading: authLoading } = useAuth();

  const projectId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [project, setProject] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  const [projectLoading, setProjectLoading] = useState(true);
  const [error, setError] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [notice, setNotice] = useState("");

  const [progress, setProgress] = useState("0");
  const [status, setStatus] = useState("Planning");

  const [savingProject, setSavingProject] = useState(false);
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState("");

  /* AUTH */
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

  /* FIRESTORE LISTENERS */
  useEffect(() => {
    if (
      authLoading ||
      !user ||
      profile?.role !== "admin" ||
      !projectId
    ) {
      return;
    }

    setProjectLoading(true);
    setError("");
    setSubmissionError("");

    const unsubscribeProject = onSnapshot(
      doc(db, "projects", projectId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setProject(null);
          setError("This project could not be found.");
        } else {
          setProject({
            id: snapshot.id,
            ...snapshot.data(),
          });
          setError("");
        }

        setProjectLoading(false);
      },
      (snapshotError) => {
        console.error("Project listener error:", snapshotError);

        setError(
          "Unable to load this project. Check your Firestore permissions."
        );

        setProjectLoading(false);
      }
    );

    const unsubscribeAssignments = onSnapshot(
      collection(db, "assignments"),
      (snapshot) => {
        setAssignments(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (snapshotError) => {
        console.error("Assignments listener error:", snapshotError);
        setSubmissionError("Unable to load project assignments.");
      }
    );

    const unsubscribeWorkers = onSnapshot(
      collection(db, "workers"),
      (snapshot) => {
        setWorkers(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (snapshotError) => {
        console.error("Workers listener error:", snapshotError);
        setSubmissionError("Unable to load worker information.");
      }
    );

    const unsubscribeSubmissions = onSnapshot(
      collection(db, "workSubmissions"),
      (snapshot) => {
        setSubmissions(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );

        setSubmissionError("");
      },
      (snapshotError) => {
        console.error("Work submissions listener error:", snapshotError);

        setSubmissionError(
          "Unable to load submitted work. Check read permissions for workSubmissions."
        );
      }
    );

    return () => {
      unsubscribeProject();
      unsubscribeAssignments();
      unsubscribeWorkers();
      unsubscribeSubmissions();
    };
  }, [
    authLoading,
    user,
    profile?.role,
    projectId,
  ]);

  /* KEEP PROGRESS FORM IN SYNC */
  useEffect(() => {
    if (!project) return;

    const initialProgress = Number(project.progress ?? 0);

    setProgress(
      String(Math.min(100, Math.max(0, initialProgress)))
    );

    setStatus(project.status || "Planning");
  }, [project?.id, project?.progress, project?.status]);

  /* WORKERS ASSIGNED TO THIS PROJECT */
  const projectAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          assignment.projectId === projectId ||
          assignment.projectID === projectId
      ),
    [assignments, projectId]
  );

  const assignmentIds = useMemo(
    () => new Set(projectAssignments.map((item) => item.id)),
    [projectAssignments]
  );

  const workerMap = useMemo(
    () => new Map(workers.map((worker) => [worker.id, worker])),
    [workers]
  );

  /* MATCH SUBMISSIONS BY PROJECT OR ASSIGNMENT */
  const projectSubmissions = useMemo(() => {
    return submissions
      .filter((submission) => {
        const directProjectId =
          submission.projectId ||
          submission.projectID ||
          submission.project?.id;

        const relatedJobId =
          submission.jobId ||
          submission.jobID ||
          submission.assignmentId ||
          submission.assignmentID;

        return (
          directProjectId === projectId ||
          (relatedJobId && assignmentIds.has(relatedJobId))
        );
      })
      .sort(
        (a, b) =>
          getTimestamp(
            b.submittedAt ||
              b.createdAt ||
              b.timestamp ||
              b.submissionDate
          ) -
          getTimestamp(
            a.submittedAt ||
              a.createdAt ||
              a.timestamp ||
              a.submissionDate
          )
      );
  }, [submissions, projectId, assignmentIds]);

  const latestSubmissionDate = useMemo(() => {
    const first = projectSubmissions[0];

    return first
      ? first.submittedAt ||
          first.createdAt ||
          first.timestamp ||
          first.submissionDate
      : null;
  }, [projectSubmissions]);

  /* SAVE PROJECT PROGRESS AND STATUS */
  const saveProjectUpdates = useCallback(
    async (event) => {
      event.preventDefault();

      if (!project || !user || profile?.role !== "admin") {
        setError("You must be signed in as an administrator.");
        return;
      }

      const numericProgress = Number(progress);

      if (
        !Number.isFinite(numericProgress) ||
        numericProgress < 0 ||
        numericProgress > 100
      ) {
        setError("Project progress must be between 0 and 100.");
        return;
      }

      if (!PROJECT_STATUSES.includes(status)) {
        setError("Select a valid project status.");
        return;
      }

      const finalProgress =
        status === "Completed" ? 100 : numericProgress;

      setSavingProject(true);
      setError("");
      setNotice("");

      try {
        await updateDoc(doc(db, "projects", project.id), {
          progress: finalProgress,
          status,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
          completedAt:
            status === "Completed" ? serverTimestamp() : null,
        });

        setProgress(String(finalProgress));
        setNotice("Project progress and status updated successfully.");
      } catch (saveError) {
        console.error("Update project progress error:", saveError);

        setError(
          saveError?.code === "permission-denied"
            ? "You do not have permission to update this project. Check your Firestore rules."
            : saveError.message || "Unable to update the project."
        );
      } finally {
        setSavingProject(false);
      }
    },
    [project, user, profile?.role, progress, status]
  );

  /* MARK SUBMISSION AS REVIEWED */
  async function markSubmissionReviewed(submission) {
    if (!user || profile?.role !== "admin") {
      setError("Admin access is required.");
      return;
    }

    setReviewingSubmissionId(submission.id);
    setError("");
    setNotice("");

    try {
      await updateDoc(
        doc(db, "workSubmissions", submission.id),
        {
          reviewStatus: "reviewed",
          reviewedAt: serverTimestamp(),
          reviewedBy: user.uid,
          updatedAt: serverTimestamp(),
        }
      );

      setNotice("Work submission marked as reviewed.");
    } catch (reviewError) {
      console.error("Review submission error:", reviewError);

      setError(
        reviewError?.code === "permission-denied"
          ? "You do not have permission to update this submission."
          : reviewError.message || "Unable to update the submission."
      );
    } finally {
      setReviewingSubmissionId("");
    }
  }

  /* LOADING / ACCESS */
  if (
    authLoading ||
    !user ||
    (profile?.role && profile.role !== "admin") ||
    projectLoading
  ) {
    return <LoadingPage />;
  }

  if (error && !project) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto text-red-500" size={32} />

          <h2 className="mt-4 text-lg font-semibold text-[#172033]">
            Project unavailable
          </h2>

          <p className="mt-2 text-sm text-[#667085]">{error}</p>

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

  if (!project) return null;

  const customer = project.customer || {};
  const customerName = getCustomerName(project);

  const currentProgress = Math.min(
    100,
    Math.max(0, Number(project.progress || 0))
  );

  /* PAGE */
  return (
    <div className="space-y-6">
      <Link
        href="/admin/projects"
        className="inline-flex items-center gap-2 text-sm font-medium text-[#667085] transition hover:text-[#1769E0]"
      >
        <ArrowLeft size={17} />
        Back to Projects
      </Link>

      {/* ALERTS */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 shrink-0" size={18} />
          <p className="flex-1">{error}</p>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
          <p className="flex-1">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss message"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* PROJECT HEADER */}
      <section className="rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
        <div className="p-5 sm:p-6">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EAF4FF]">
              <BriefcaseBusiness className="h-7 w-7 text-[#1769E0]" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="break-words text-2xl font-bold tracking-tight text-[#172033]">
                  {project.name || "Unnamed Project"}
                </h1>

                <StatusBadge status={project.status} />
              </div>

              <p className="mt-2 text-sm text-[#667085]">
                {project.service || "No service specified"}
              </p>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#667085]">
                <span className="flex items-center gap-2">
                  <UserRound size={15} className="text-[#98A2B3]" />
                  {customerName}
                </span>

                <span className="flex items-center gap-2">
                  <MapPin size={15} className="text-[#98A2B3]" />
                  {project.location || "No location"}
                </span>

                <span className="flex items-center gap-2">
                  <CalendarDays size={15} className="text-[#98A2B3]" />
                  Due {formatDate(project.deadline)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-7 border-t border-[#E5EDF5] pt-6">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-[#667085]">
                Current project progress
              </p>

              <p className="text-sm font-bold text-[#172033]">
                {currentProgress}%
              </p>
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-[#EAF4FF]">
              <div
                className={`h-full rounded-full transition-all ${
                  currentProgress === 100
                    ? "bg-emerald-500"
                    : "bg-[#1769E0]"
                }`}
                style={{ width: `${currentProgress}%` }}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#98A2B3]">
              <span>0% — Not started</span>
              <span>100% — Complete</span>
            </div>
          </div>
        </div>
      </section>

      {/* EDIT PROGRESS / STATUS */}
      <section className="overflow-hidden rounded-2xl border border-[#DCEAF8] bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#E5EDF5] p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
            <Edit3 size={19} />
          </div>

          <div>
            <h2 className="font-semibold text-[#172033]">
              Update project progress
            </h2>

            <p className="mt-1 text-sm text-[#667085]">
              Review submitted work, then update the project's progress and status.
            </p>
          </div>
        </div>

        <form
          onSubmit={saveProjectUpdates}
          className="space-y-5 p-5 sm:p-6"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label
                  htmlFor="project-progress"
                  className="text-sm font-semibold text-[#344054]"
                >
                  Progress
                </label>

                <span className="rounded-lg bg-[#EAF4FF] px-2.5 py-1 text-sm font-bold text-[#1769E0]">
                  {progress || 0}%
                </span>
              </div>

              <input
                id="project-progress"
                type="range"
                min="0"
                max="100"
                step="5"
                value={progress === "" ? 0 : Number(progress)}
                disabled={savingProject || status === "Completed"}
                onChange={(event) => setProgress(event.target.value)}
                className="w-full accent-[#1769E0] disabled:opacity-50"
              />

              <div className="mt-2 flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={progress}
                  disabled={savingProject || status === "Completed"}
                  onChange={(event) => {
                    const value = event.target.value;

                    if (value === "") {
                      setProgress("");
                      return;
                    }

                    setProgress(
                      String(
                        Math.min(100, Math.max(0, Number(value)))
                      )
                    );
                  }}
                  className={inputClass}
                />

                <span className="text-sm text-[#667085]">%</span>
              </div>
            </div>

            <div>
              <label
                htmlFor="project-status"
                className="mb-2 block text-sm font-semibold text-[#344054]"
              >
                Project status
              </label>

              <select
                id="project-status"
                value={status}
                disabled={savingProject}
                onChange={(event) => {
                  const nextStatus = event.target.value;

                  setStatus(nextStatus);

                  if (nextStatus === "Completed") {
                    setProgress("100");
                  }
                }}
                className={inputClass}
              >
                {PROJECT_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs leading-5 text-[#667085]">
                Selecting Completed automatically sets progress to 100%.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#E5EDF5] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#667085]">
              Changes are saved to this project in Firestore.
            </p>

            <button
              type="submit"
              disabled={
                savingProject ||
                progress === "" ||
                !Number.isFinite(Number(progress))
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1259C1] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingProject ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : (
                <Save size={17} />
              )}

              {savingProject ? "Saving..." : "Save Project Updates"}
            </button>
          </div>
        </form>
      </section>

      {/* PROJECT DETAILS */}
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm xl:col-span-2">
          <SectionHeader
            icon={FileText}
            title="Project Information"
            description="Details from the original CRM lead"
          />

          <div className="p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2">
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
                value={formatDate(project.deadline)}
              />

              <InfoItem
                icon={Clock3}
                label="Last updated"
                value={formatDate(project.updatedAt)}
              />
            </div>

            <div className="mt-6 border-t border-[#E5EDF5] pt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-[#98A2B3]">
                Description
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#667085]">
                {project.description || "No project description provided."}
              </p>
            </div>

            {project.notes && (
              <div className="mt-6 border-t border-[#E5EDF5] pt-5">
                <p className="text-xs font-medium uppercase tracking-wide text-[#98A2B3]">
                  Internal notes
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#667085]">
                  {project.notes}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
          <SectionHeader
            icon={UserRound}
            title="Customer"
            description="Customer contact information"
          />

          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EAF4FF] text-lg font-bold text-[#1769E0]">
                {customerName.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0">
                <h3 className="break-words font-semibold text-[#172033]">
                  {customerName}
                </h3>

                {customer.company && (
                  <p className="mt-1 text-sm text-[#667085]">
                    {customer.company}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {customer.email && (
                <a
                  href={`mailto:${customer.email}`}
                  className="flex items-start gap-3 break-all text-sm text-[#667085] hover:text-[#1769E0]"
                >
                  <Mail size={16} className="mt-0.5 shrink-0" />
                  {customer.email}
                </a>
              )}

              {customer.phone && (
                <a
                  href={`tel:${customer.phone}`}
                  className="flex items-center gap-3 text-sm text-[#667085] hover:text-[#1769E0]"
                >
                  <Phone size={16} className="shrink-0" />
                  {customer.phone}
                </a>
              )}

              {!customer.email && !customer.phone && (
                <p className="text-sm text-[#98A2B3]">
                  No contact details available.
                </p>
              )}
            </div>

            {project.amount !== undefined && project.amount !== null && (
              <div className="mt-6 border-t border-[#E5EDF5] pt-5">
                <p className="text-xs text-[#98A2B3]">Project value</p>
                <p className="mt-1 text-2xl font-bold text-[#172033]">
                  {formatCurrency(project.amount)}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ASSIGNED WORKERS */}
      <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
        <SectionHeader
          icon={Users}
          title="Assigned Workers"
          description={`${projectAssignments.length} worker assignment${
            projectAssignments.length === 1 ? "" : "s"
          }`}
        />

        {projectAssignments.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No workers assigned"
            description="Workers assigned to this project will appear here."
          />
        ) : (
          <div className="divide-y divide-[#E5EDF5]">
            {projectAssignments.map((assignment) => {
              const worker = workerMap.get(assignment.workerId);

              return (
                <div
                  key={assignment.id}
                  className="flex items-center gap-3 px-5 py-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5FAFF] text-[#1769E0]">
                    <UserRound size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#172033]">
                      {assignment.workerName || getPersonName(worker)}
                    </p>

                    <p className="mt-1 text-xs capitalize text-[#667085]">
                      {String(assignment.status || "assigned").replaceAll(
                        "_",
                        " "
                      )}
                      {assignment.role ? ` · ${assignment.role}` : ""}
                    </p>
                  </div>

                  <span className="rounded-full bg-[#F5FAFF] px-2.5 py-1 text-xs font-medium capitalize text-[#667085]">
                    {assignment.status || "assigned"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SUBMITTED WORK AND ATTACHMENTS */}
      <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
        <SectionHeader
          icon={ImageIcon}
          title="Submitted Work"
          description="Review workers' updates, photos, and uploaded files"
          action={
            <span className="rounded-full bg-[#EAF4FF] px-3 py-1 text-xs font-semibold text-[#1769E0]">
              {projectSubmissions.length} submission
              {projectSubmissions.length === 1 ? "" : "s"}
            </span>
          }
        />

        {submissionError && (
          <div className="m-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <p>{submissionError}</p>
          </div>
        )}

        {projectSubmissions.length === 0 ? (
          <EmptyState
            icon={FileImage}
            title="No submitted work found"
            description="A submission must be linked to this project or one of its assignments to appear here."
          />
        ) : (
          <div className="divide-y divide-[#E5EDF5]">
            {projectSubmissions.map((submission) => {
              const worker =
                workerMap.get(submission.workerId) ||
                workerMap.get(submission.userId) ||
                workerMap.get(submission.staffId);

              const workerName =
                submission.workerName ||
                submission.staffName ||
                submission.userName ||
                getPersonName(worker);

              const attachments = getSubmissionAttachments(submission);

              const images = attachments.filter(isImageAttachment);

              const files = attachments.filter(
                (attachment) => !isImageAttachment(attachment)
              );

              const submittedDate =
                submission.submittedAt ||
                submission.createdAt ||
                submission.timestamp ||
                submission.submissionDate;

              const reviewStatus =
                submission.reviewStatus || "pending review";

              const isReviewed =
                String(reviewStatus).toLowerCase() === "reviewed";

              const isReviewSaving =
                reviewingSubmissionId === submission.id;

              return (
                <article
                  key={submission.id}
                  className="space-y-4 p-5 sm:p-6"
                >
                  {/* Submission header */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF4FF] text-[#1769E0]">
                        <UserRound size={18} />
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-semibold text-[#172033]">
                          {workerName}
                        </h3>

                        <p className="mt-1 text-sm text-[#667085]">
                          Submitted {formatDateTime(submittedDate)}
                        </p>

                        {submission.title && (
                          <p className="mt-2 font-medium text-[#344054]">
                            {submission.title}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          isReviewed
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {isReviewed ? "Reviewed" : "Needs review"}
                      </span>

                      {!isReviewed && (
                        <button
                          type="button"
                          disabled={isReviewSaving}
                          onClick={() => markSubmissionReviewed(submission)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCEAF8] px-3 py-2 text-xs font-semibold text-[#1769E0] hover:bg-[#F5FAFF] disabled:opacity-50"
                        >
                          {isReviewSaving ? (
                            <LoaderCircle
                              size={14}
                              className="animate-spin"
                            />
                          ) : (
                            <Check size={14} />
                          )}
                          Mark reviewed
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Work description */}
                  {getSubmissionDescription(submission) && (
                    <div className="rounded-xl bg-[#F8FBFF] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
                        Work update
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#344054]">
                        {getSubmissionDescription(submission)}
                      </p>
                    </div>
                  )}

                  {/* Images */}
                  {images.length > 0 && (
                    <div>
                      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#344054]">
                        <ImageIcon size={17} className="text-[#1769E0]" />
                        Photos ({images.length})
                      </p>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {images.map((attachment, index) => (
                          <AttachmentCard
                            key={`${submission.id}-image-${index}`}
                            attachment={attachment}
                            index={index}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Documents and other files */}
                  {files.length > 0 && (
                    <div>
                      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#344054]">
                        <FileText size={17} className="text-[#1769E0]" />
                        Files ({files.length})
                      </p>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {files.map((attachment, index) => (
                          <AttachmentCard
                            key={`${submission.id}-file-${index}`}
                            attachment={attachment}
                            index={index}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No usable file URL/data */}
                  {attachments.length === 0 && (
                    <div className="rounded-xl border border-dashed border-[#DCEAF8] bg-[#F8FBFF] p-4">
                      <div className="flex items-start gap-3">
                        <FileImage
                          size={20}
                          className="mt-0.5 shrink-0 text-[#1769E0]"
                        />

                        <div>
                          <p className="text-sm font-medium text-[#344054]">
                            No viewable attachment was found
                          </p>

                          <p className="mt-1 text-xs leading-5 text-[#667085]">
                            The submission exists, but no supported image or
                            file URL/data was detected. Check the file fields
                            saved by the worker's submission form. A filename
                            alone cannot display the original file.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Submission status */}
                  {submission.status && (
                    <div className="border-t border-[#E5EDF5] pt-3">
                      <p className="text-xs text-[#667085]">
                        Submission status:{" "}
                        <span className="font-medium capitalize">
                          {String(submission.status).replaceAll("_", " ")}
                        </span>
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {latestSubmissionDate && (
          <div className="border-t border-[#E5EDF5] bg-[#F8FBFF] px-5 py-3 text-xs text-[#667085]">
            Most recent submission: {formatDateTime(latestSubmissionDate)}
          </div>
        )}
      </section>

      {/* FOOTNOTE */}
      <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-xs leading-5 text-blue-900">
        <ShieldCheck size={17} className="mt-0.5 shrink-0" />

        <p>
          Project updates and submission reviews are saved in Firestore.
          Uploaded files must have a usable URL or saved file data to be
          viewable here. This page does not upload or reconstruct missing files.
        </p>
      </div>
    </div>
  );
}