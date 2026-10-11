"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Mail,
  Phone,
  UserCircle,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";
import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/config/Firebase";

export default function WorkerDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function loadWorker() {
      try {
        const workerRef = doc(
          db,
          "workers",
          params.id
        );

        const workerSnap = await getDoc(workerRef);

        if (!workerSnap.exists()) {
          router.replace("/admin/workers");
          return;
        }

        setWorker({
          id: workerSnap.id,
          ...workerSnap.data(),
        });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      loadWorker();
    }
  }, [params.id, router]);

  async function toggleStatus() {
    if (!worker) return;

    setUpdating(true);

    try {
      const newStatus =
        worker.status === "active"
          ? "inactive"
          : "active";

      await updateDoc(
        doc(db, "workers", worker.id),
        {
          status: newStatus,
          updatedAt: new Date(),
        }
      );

      setWorker((current) => ({
        ...current,
        status: newStatus,
      }));

      await updateDoc(
        doc(db, "users", worker.id),
        {
          status: newStatus,
          updatedAt: new Date(),
        }
      );
    } catch (error) {
      console.error(error);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-[#667085]">
        Loading worker...
      </div>
    );
  }

  if (!worker) {
    return null;
  }

  const active = worker.status === "active";

  const initials = `${worker.firstName?.[0] || ""}${
    worker.lastName?.[0] || ""
  }`.toUpperCase();

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <Link
        href="/admin/workers"
        className="inline-flex items-center gap-2 text-sm font-medium text-[#667085] hover:text-[#1769E0]"
      >
        <ArrowLeft size={17} />
        Back to workers
      </Link>

      {/* Profile */}
      <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
        <div className="h-28 bg-gradient-to-r from-[#0F3D70] to-[#1769E0]" />

        <div className="-mt-10 px-6 pb-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-[#EAF4FF] text-xl font-bold text-[#1769E0] shadow-sm">
                {initials || <UserCircle size={35} />}
              </div>

              <div className="pb-1">
                <h2 className="text-xl font-bold text-[#172033]">
                  {worker.firstName} {worker.lastName}
                </h2>

                <p className="text-sm text-[#667085]">
                  {worker.role || "Worker"}
                </p>
              </div>
            </div>

            <button
              onClick={toggleStatus}
              disabled={updating}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
                active
                  ? "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                  : "bg-[#1769E0] text-white hover:bg-[#1259C4]"
              }`}
            >
              {active ? (
                <UserRoundX size={17} />
              ) : (
                <UserRoundCheck size={17} />
              )}

              {updating
                ? "Updating..."
                : active
                ? "Deactivate"
                : "Activate"}
            </button>
          </div>
        </div>
      </section>

      {/* Information */}
      <section className="grid gap-6 md:grid-cols-2">
        <InfoCard title="Contact information">
          <InfoRow
            icon={Mail}
            label="Email"
            value={worker.email || "Not provided"}
          />

          <InfoRow
            icon={Phone}
            label="Phone"
            value={worker.phone || "Not provided"}
          />
        </InfoCard>

        <InfoCard title="Work information">
          <InfoRow
            icon={BriefcaseBusiness}
            label="Role"
            value={worker.role || "Worker"}
          />

          <InfoRow
            icon={UserCircle}
            label="Employee ID"
            value={worker.employeeId || "Not assigned"}
          />
        </InfoCard>
      </section>

      {/* Future sections */}
      <section className="rounded-2xl border border-[#E5EDF5] bg-white p-6 shadow-sm">
        <h3 className="font-bold text-[#172033]">
          Worker activity
        </h3>

        <p className="mt-1 text-xs text-[#98A2B3]">
          Jobs, requests, resources and payments associated with
          this worker will appear here.
        </p>

        <div className="mt-6 rounded-xl bg-[#F8FBFF] p-8 text-center">
          <p className="text-sm font-semibold text-[#172033]">
            No activity yet
          </p>

          <p className="mt-1 text-xs text-[#98A2B3]">
            Activity will appear after this worker is assigned
            to projects.
          </p>
        </div>
      </section>
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-[#E5EDF5] bg-white p-6 shadow-sm">
      <h3 className="font-bold text-[#172033]">
        {title}
      </h3>

      <div className="mt-5 space-y-4">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5FAFF] text-[#1769E0]">
        <Icon size={18} />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-[#98A2B3]">
          {label}
        </p>

        <p className="truncate text-sm font-medium text-[#172033]">
          {value}
        </p>
      </div>
    </div>
  );
}