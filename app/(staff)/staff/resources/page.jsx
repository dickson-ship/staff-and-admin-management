"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  Filter,
  GraduationCap,
  HardHat,
  LoaderCircle,
  Search,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";

import { db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

const categories = [
  "All resources",
  "Safety",
  "Technical Guides",
  "Work Procedures",
  "Company Policies",
  "Training",
  "Other",
];

function formatDate(timestamp) {
  if (!timestamp) return "Date unavailable";

  try {
    const date =
      typeof timestamp.toDate === "function"
        ? timestamp.toDate()
        : new Date(timestamp);

    if (Number.isNaN(date.getTime())) return "Date unavailable";

    return date.toLocaleDateString("en-GH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Date unavailable";
  }
}

function getResourceLink(resource) {
  return resource.url || resource.fileUrl || resource.link || "";
}

function getResourceType(resource) {
  const type = String(resource.type || "").toLowerCase();

  if (type.includes("video")) return "Video";
  if (type.includes("pdf")) return "PDF";
  if (type.includes("document")) return "Document";
  if (type.includes("link")) return "Website";

  const url = getResourceLink(resource).toLowerCase();

  if (url.includes(".pdf")) return "PDF";
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return "Video";
  }

  return "Resource";
}

function getCategoryIcon(category = "") {
  const value = category.toLowerCase();

  if (value.includes("safety")) return ShieldCheck;
  if (value.includes("technical") || value.includes("electrical")) {
    return Wrench;
  }
  if (value.includes("procedure") || value.includes("policy")) {
    return ClipboardList;
  }
  if (value.includes("training")) return GraduationCap;

  return FileText;
}

function ResourceIcon({ category }) {
  const Icon = getCategoryIcon(category);

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF4FF] text-[#1769E0]">
      <Icon size={23} />
    </div>
  );
}

function ResourceCard({ resource, onOpen }) {
  const category = resource.category || "Other";
  const type = getResourceType(resource);
  const link = getResourceLink(resource);

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-[#E5EDF5] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#B9D7FF] hover:shadow-lg hover:shadow-blue-950/5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <ResourceIcon category={category} />

        <span className="rounded-full bg-[#F5FAFF] px-3 py-1 text-xs font-semibold text-[#1769E0]">
          {type}
        </span>
      </div>

      <div className="mt-5 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">
          {category}
        </p>

        <h3 className="mt-2 line-clamp-2 text-lg font-bold text-[#172033]">
          {resource.title || "Untitled resource"}
        </h3>

        <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#667085]">
          {resource.description ||
            resource.summary ||
            "Open this resource to view the available information."}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-[#EEF2F6] pt-4">
        <div className="flex items-center gap-2 text-xs text-[#667085]">
          <CalendarDays size={14} />
          <span>{formatDate(resource.updatedAt || resource.createdAt)}</span>
        </div>

        <button
          type="button"
          onClick={() => onOpen(resource)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#1769E0] px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0F3D70]"
        >
          View
          <ArrowUpRight size={16} />
        </button>
      </div>

      {link && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[#667085]">
          <ExternalLink size={13} />
          External link available
        </p>
      )}
    </article>
  );
}

function ResourceDetails({ resource, onClose }) {
  if (!resource) return null;

  const link = getResourceLink(resource);
  const category = resource.category || "Other";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="resource-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-[#E5EDF5] bg-white px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <ResourceIcon category={category} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1769E0]">
                {category}
              </p>
              <p className="text-sm text-[#667085]">
                {getResourceType(resource)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close resource"
            className="rounded-xl p-2 text-[#667085] hover:bg-[#F5FAFF] hover:text-[#172033]"
          >
            <X size={21} />
          </button>
        </div>

        <div className="p-5 sm:p-7">
          <h2
            id="resource-title"
            className="text-2xl font-bold leading-tight text-[#172033]"
          >
            {resource.title || "Untitled resource"}
          </h2>

          <p className="mt-3 text-sm text-[#667085]">
            Last updated{" "}
            {formatDate(resource.updatedAt || resource.createdAt)}
          </p>

          {resource.description && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-[#172033]">
                About this resource
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#667085]">
                {resource.description}
              </p>
            </div>
          )}

          {(resource.content || resource.instructions || resource.body) && (
            <div className="mt-6 rounded-2xl border border-[#E5EDF5] bg-[#F8FBFF] p-4 sm:p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#172033]">
                <BookOpen size={17} className="text-[#1769E0]" />
                Resource content
              </h3>

              <div className="whitespace-pre-wrap break-words text-sm leading-7 text-[#475467]">
                {resource.content || resource.instructions || resource.body}
              </div>
            </div>
          )}

          {resource.notes && (
            <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <strong>Note:</strong> {resource.notes}
            </div>
          )}

          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#0F3D70] sm:w-auto"
            >
              {getResourceType(resource) === "PDF" ? (
                <Download size={17} />
              ) : (
                <ExternalLink size={17} />
              )}
              Open resource
            </a>
          ) : (
            <p className="mt-6 rounded-xl bg-[#F5FAFF] p-4 text-sm text-[#667085]">
              This resource has no external link. Read the information above
              or contact your administrator if you need an additional file.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

export default function StaffResourcesPage() {
  const { user, profile, loading: authLoading, role } = useAuth();

  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All resources");
  const [selectedResource, setSelectedResource] = useState(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user || role !== "staff") {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const resourcesQuery = query(
      collection(db, "resources"),
      where("status", "==", "published")
    );

    const unsubscribe = onSnapshot(
      resourcesQuery,
      (snapshot) => {
        const items = snapshot.docs.map((resourceDoc) => ({
          id: resourceDoc.id,
          ...resourceDoc.data(),
        }));

        items.sort((a, b) => {
          const dateA =
            a.updatedAt?.toMillis?.() ||
            a.createdAt?.toMillis?.() ||
            0;
          const dateB =
            b.updatedAt?.toMillis?.() ||
            b.createdAt?.toMillis?.() ||
            0;

          return dateB - dateA;
        });

        setResources(items);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load resources:", err);
        setError(
          "We couldn't load the resources. Please check your connection or contact the administrator."
        );
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, role, authLoading]);

  const filteredResources = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return resources.filter((resource) => {
      const matchesCategory =
        category === "All resources" ||
        String(resource.category || "Other").toLowerCase() ===
          category.toLowerCase();

      const searchableText = [
        resource.title,
        resource.description,
        resource.summary,
        resource.category,
        resource.type,
        resource.content,
        resource.instructions,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesCategory &&
        (!searchTerm || searchableText.includes(searchTerm))
      );
    });
  }, [resources, search, category]);

  const categoryCounts = useMemo(() => {
    const counts = { "All resources": resources.length };

    resources.forEach((resource) => {
      const key = categories.some(
        (item) =>
          item !== "All resources" &&
          item.toLowerCase() ===
            String(resource.category || "Other").toLowerCase()
      )
        ? categories.find(
            (item) =>
              item !== "All resources" &&
              item.toLowerCase() ===
                String(resource.category || "Other").toLowerCase()
          )
        : "Other";

      counts[key] = (counts[key] || 0) + 1;
    });

    return counts;
  }, [resources]);

  if (authLoading || (loading && !resources.length)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <LoaderCircle
            size={34}
            className="mx-auto animate-spin text-[#1769E0]"
          />
          <p className="mt-3 text-sm text-[#667085]">
            Loading your resources...
          </p>
        </div>
      </div>
    );
  }

  if (!user || role !== "staff") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-[#E5EDF5] bg-white p-8 text-center">
        <ShieldCheck size={38} className="mx-auto text-[#1769E0]" />
        <h1 className="mt-4 text-xl font-bold text-[#172033]">
          Staff access required
        </h1>
        <p className="mt-2 text-sm text-[#667085]">
          Sign in with your staff account to view company resources.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex rounded-xl bg-[#1769E0] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0F3D70]"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FBFF]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
        {/* Breadcrumb */}
        <Link
          href="/staff"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#667085] transition hover:text-[#1769E0]"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>

        {/* Page header */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F3D70] to-[#1769E0] p-6 text-white sm:p-9">
          <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full border-[35px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-24 right-32 h-52 w-52 rounded-full bg-white/5" />

          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
              <BookOpen size={14} />
              Staff knowledge centre
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Resources & Guides
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-7 text-blue-50 sm:text-base">
              Find company documents, safety guidelines, technical instructions,
              and training materials to help you work safely and confidently.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-blue-50">
              <span className="inline-flex items-center gap-2">
                <FileText size={17} />
                {resources.length} published{" "}
                {resources.length === 1 ? "resource" : "resources"}
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={17} />
                Admin-approved content
              </span>
            </div>
          </div>
        </section>

        {/* Search */}
        <section className="mt-7 rounded-2xl border border-[#E5EDF5] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search
                size={19}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#98A2B3]"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search titles, descriptions, or instructions..."
                className="w-full rounded-xl border border-[#DCEAF8] bg-[#F8FBFF] py-3.5 pl-11 pr-4 text-sm text-[#172033] outline-none transition placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="flex items-center gap-3">
              <Filter size={18} className="shrink-0 text-[#667085]" />
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-[#DCEAF8] bg-white px-4 py-3.5 text-sm text-[#172033] outline-none focus:border-[#1769E0] sm:min-w-52"
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                    {categoryCounts[item] !== undefined
                      ? ` (${categoryCounts[item]})`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Category shortcuts */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#172033]">
              Browse categories
            </h2>
            <span className="text-xs text-[#667085]">
              {filteredResources.length}{" "}
              {filteredResources.length === 1 ? "result" : "results"}
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                  category === item
                    ? "border-[#1769E0] bg-[#1769E0] text-white"
                    : "border-[#E5EDF5] bg-white text-[#667085] hover:border-[#B9D7FF] hover:text-[#1769E0]"
                }`}
              >
                {item}
                {categoryCounts[item] !== undefined && (
                  <span className="ml-2 opacity-75">
                    {categoryCounts[item]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Error state */}
        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Unable to load resources</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Resource grid */}
        <section className="mt-5">
          {loading && resources.length > 0 && (
            <p className="mb-4 text-sm text-[#667085]">
              Refreshing resources...
            </p>
          )}

          {filteredResources.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredResources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onOpen={setSelectedResource}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[#DCEAF8] bg-white px-5 py-14 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF4FF] text-[#1769E0]">
                {search || category !== "All resources" ? (
                  <Search size={28} />
                ) : (
                  <HardHat size={28} />
                )}
              </div>

              <h3 className="mt-5 text-lg font-bold text-[#172033]">
                {search || category !== "All resources"
                  ? "No matching resources"
                  : "No resources published yet"}
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#667085]">
                {search || category !== "All resources"
                  ? "Try a different search term or category to find what you need."
                  : "Your administrator has not published any resources yet. Check back later for guides, safety documents, and training materials."}
              </p>

              {(search || category !== "All resources") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCategory("All resources");
                  }}
                  className="mt-5 rounded-xl border border-[#DCEAF8] px-4 py-2.5 text-sm font-semibold text-[#1769E0] hover:bg-[#F5FAFF]"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </section>

        {/* Safety reminder */}
        <section className="mt-8 flex items-start gap-3 rounded-2xl border border-blue-100 bg-[#EAF4FF] p-4 sm:p-5">
          <ShieldCheck
            size={22}
            className="mt-0.5 shrink-0 text-[#1769E0]"
          />
          <div>
            <h3 className="text-sm font-bold text-[#0F3D70]">
              Work safely
            </h3>
            <p className="mt-1 text-sm leading-6 text-[#475467]">
              Always follow approved safety procedures and use the appropriate
              protective equipment. Contact your administrator if a guide is
              missing, outdated, or unclear.
            </p>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-[#98A2B3]">
          Signed in as {profile?.name || profile?.fullName || user.email}
        </p>
      </div>

      <ResourceDetails
        resource={selectedResource}
        onClose={() => setSelectedResource(null)}
      />
    </div>
  );
}