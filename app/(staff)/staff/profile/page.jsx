
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  UserRound,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  BriefcaseBusiness,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Pencil,
} from "lucide-react";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  onSnapshot,
} from "firebase/firestore";

import {
  sendPasswordResetEmail,
} from "firebase/auth";

import { auth, db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

const inputClass =
  "w-full rounded-xl border border-[#DCEAF8] bg-white px-4 py-3 text-sm text-[#172033] outline-none transition placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:ring-2 focus:ring-[#1769E0]/10";

const labelClass =
  "mb-2 block text-sm font-medium text-[#344054]";

function DetailCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#E5EDF5] bg-white p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
        <Icon size={19} />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-[#667085]">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold text-[#172033]">
          {value || "Not provided"}
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const active =
    String(status || "").toLowerCase() === "active";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />
      {status || "Unknown"}
    </span>
  );
}

export default function StaffProfilePage() {
  const { user, profile, loading: authLoading } = useAuth();

  const [worker, setWorker] = useState(null);
  const [userDocument, setUserDocument] = useState(null);

  const [form, setForm] = useState({
    phone: "",
    address: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!user?.uid || profile?.role !== "staff") {
      setLoading(false);
      return;
    }

    let active = true;

    setLoading(true);
    setError("");

    let workerData = null;
    let userData = null;
    let workerLoaded = false;
    let userLoaded = false;

    const applyProfile = () => {
      if (!active || !workerLoaded || !userLoaded) return;

      const mergedWorker = {
        ...(userData || {}),
        ...(workerData || {}),
      };

      setWorker(mergedWorker);
      setUserDocument(userData || {});

      setForm({
        phone: mergedWorker.phone || "",
        address: mergedWorker.address || "",
        emergencyContactName:
          mergedWorker.emergencyContactName || "",
        emergencyContactPhone:
          mergedWorker.emergencyContactPhone || "",
      });

      setLoading(false);
    };

    const handleReadError = (readError) => {
      console.error("Staff profile load error:", readError);

      if (active) {
        setError(
          "Unable to load your profile. Check your connection and Firestore permissions."
        );
        setLoading(false);
      }
    };

    const unsubscribeWorker = onSnapshot(
      doc(db, "workers", user.uid),
      (snapshot) => {
        if (!active) return;

        workerData = snapshot.exists()
          ? { id: snapshot.id, ...snapshot.data() }
          : null;

        workerLoaded = true;
        applyProfile();
      },
      handleReadError
    );

    const unsubscribeUser = onSnapshot(
      doc(db, "users", user.uid),
      (snapshot) => {
        if (!active) return;

        userData = snapshot.exists()
          ? { id: snapshot.id, ...snapshot.data() }
          : null;

        userLoaded = true;
        applyProfile();
      },
      handleReadError
    );

    return () => {
      active = false;
      unsubscribeWorker();
      unsubscribeUser();
    };
  }, [user?.uid, profile?.role, authLoading]);

  const displayName =
    worker?.name ||
    [worker?.firstName, worker?.lastName]
      .filter(Boolean)
      .join(" ") ||
    profile?.name ||
    [profile?.firstName, profile?.lastName]
      .filter(Boolean)
      .join(" ") ||
    user?.displayName ||
    "Staff Member";

  const email = worker?.email || user?.email || "";

  const accountStatus =
    worker?.status ||
    userDocument?.status ||
    (worker?.active === false ? "inactive" : "active");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!user?.uid || profile?.role !== "staff") {
      setError("You are not authorized to update this profile.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const workerRef = doc(db, "workers", user.uid);
      const userRef = doc(db, "users", user.uid);

      const workerSnapshot = await getDoc(workerRef);
      const userSnapshot = await getDoc(userRef);

      if (!workerSnapshot.exists() || !userSnapshot.exists()) {
        throw new Error(
          "Your staff records could not be found. Please contact the administrator."
        );
      }

      const cleanForm = {
        phone: form.phone.trim(),
        address: form.address.trim(),
        emergencyContactName:
          form.emergencyContactName.trim(),
        emergencyContactPhone:
          form.emergencyContactPhone.trim(),
      };

      // Save only permitted contact fields.
      // Do not allow staff to change role, status, or salary.
      await Promise.all([
        setDoc(
          workerRef,
          {
            ...cleanForm,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ),
        setDoc(
          userRef,
          {
            phone: cleanForm.phone,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ),
      ]);

      setSuccess("Your contact details have been saved.");
      setEditing(false);
    } catch (saveError) {
      console.error("Profile update error:", saveError);

      setError(
        saveError.message ||
          "Unable to save your changes. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    const resetEmail = user?.email;

    if (!resetEmail) {
      setError(
        "No email address is associated with your account."
      );
      return;
    }

    setSendingReset(true);
    setError("");
    setSuccess("");

    try {
      await sendPasswordResetEmail(auth, resetEmail);

      setSuccess(
        `If the request was accepted, a password-reset email will be sent to ${resetEmail}. Check your inbox and spam folder.`
      );
    } catch (resetError) {
      console.error("Password reset error:", resetError);

      setError(
        resetError.code === "auth/too-many-requests"
          ? "Too many attempts. Please wait before trying again."
          : "Unable to send the password-reset email. Please try again later."
      );
    } finally {
      setSendingReset(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-[#667085]">
        <RefreshCw size={19} className="animate-spin" />
        Loading your profile...
      </div>
    );
  }

  if (!user || profile?.role !== "staff") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-[#E5EDF5] bg-white p-8 text-center shadow-sm">
        <ShieldCheck
          size={36}
          className="mx-auto text-amber-600"
        />
        <h1 className="mt-4 text-xl font-bold text-[#172033]">
          Staff access required
        </h1>
        <p className="mt-2 text-sm text-[#667085]">
          Sign in with an authorized staff account to view your profile.
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
    <div className="mx-auto max-w-5xl space-y-7">
      {/* Header */}
      <section>
        <Link
          href="/staff"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#667085] hover:text-[#1769E0]"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>

        <p className="text-sm font-medium text-[#1769E0]">
          Account settings
        </p>

        <h1 className="mt-1 text-2xl font-bold text-[#172033] sm:text-3xl">
          My Profile
        </h1>

        <p className="mt-2 text-sm leading-6 text-[#667085]">
          View your staff information and keep your contact details up to date.
        </p>
      </section>

      {/* Feedback */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle size={19} className="shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <CheckCircle2 size={19} className="shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {/* Profile banner */}
      <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
        <div className="h-28 bg-gradient-to-r from-[#0F3D70] to-[#1769E0]" />

        <div className="px-5 pb-6 sm:px-7">
          <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-[#EAF4FF] text-[#1769E0] shadow-sm">
                <UserRound size={36} />
              </div>

              <div className="pb-1">
                <h2 className="text-xl font-bold text-[#172033]">
                  {displayName}
                </h2>
                <p className="mt-1 text-sm text-[#667085]">
                  Staff member
                </p>
              </div>
            </div>

            <div className="pb-1">
              <StatusBadge status={accountStatus} />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <DetailCard
              icon={Mail}
              label="Email address"
              value={email}
            />

            <DetailCard
              icon={Phone}
              label="Phone number"
              value={worker?.phone || "Not provided"}
            />

            <DetailCard
              icon={BriefcaseBusiness}
              label="Account role"
              value="Staff"
            />

            <DetailCard
              icon={ShieldCheck}
              label="Account status"
              value={accountStatus}
            />
          </div>
        </div>
      </section>

      {/* Editable contact information */}
      <section className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#172033]">
              Contact information
            </h2>
            <p className="mt-1 text-sm text-[#667085]">
              Update your phone number, address and emergency contact.
            </p>
          </div>

          {!editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setError("");
                setSuccess("");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DCEAF8] bg-white px-4 py-2.5 text-sm font-semibold text-[#1769E0] transition hover:bg-[#F5FAFF]"
            >
              <Pencil size={16} />
              Edit details
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="mt-6 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="phone">
                  Phone number
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="e.g. +233 24 000 0000"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="address">
                  Residential address
                </label>
                <input
                  id="address"
                  name="address"
                  autoComplete="street-address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Your residential address"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  className={labelClass}
                  htmlFor="emergencyContactName"
                >
                  Emergency contact name
                </label>
                <input
                  id="emergencyContactName"
                  name="emergencyContactName"
                  value={form.emergencyContactName}
                  onChange={handleChange}
                  placeholder="Contact person's full name"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  className={labelClass}
                  htmlFor="emergencyContactPhone"
                >
                  Emergency contact phone
                </label>
                <input
                  id="emergencyContactPhone"
                  name="emergencyContactPhone"
                  type="tel"
                  value={form.emergencyContactPhone}
                  onChange={handleChange}
                  placeholder="Emergency contact number"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-[#E5EDF5] pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setForm({
                    phone: worker?.phone || "",
                    address: worker?.address || "",
                    emergencyContactName:
                      worker?.emergencyContactName || "",
                    emergencyContactPhone:
                      worker?.emergencyContactPhone || "",
                  });

                  setEditing(false);
                  setError("");
                }}
                disabled={saving}
                className="rounded-xl border border-[#DCEAF8] px-5 py-3 text-sm font-semibold text-[#667085] hover:bg-[#F8FBFF] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0F3D70] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <RefreshCw size={17} className="animate-spin" />
                ) : (
                  <Save size={17} />
                )}
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <DetailCard
              icon={Phone}
              label="Phone number"
              value={worker?.phone}
            />

            <DetailCard
              icon={MapPin}
              label="Residential address"
              value={worker?.address}
            />

            <DetailCard
              icon={UserRound}
              label="Emergency contact"
              value={worker?.emergencyContactName}
            />

            <DetailCard
              icon={Phone}
              label="Emergency contact phone"
              value={worker?.emergencyContactPhone}
            />
          </div>
        )}
      </section>

      {/* Security */}
      <section className="rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
            <KeyRound size={21} />
          </div>

          <div className="flex-1">
            <h2 className="font-bold text-[#172033]">
              Account security
            </h2>

            <p className="mt-1 text-sm leading-6 text-[#667085]">
              You can request a password-reset email to securely change your sign-in password.
            </p>

            <p className="mt-2 text-sm font-medium text-[#344054]">
              {email || "No email address available"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePasswordReset}
          disabled={sendingReset || !email}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-[#DCEAF8] bg-white px-4 py-3 text-sm font-semibold text-[#1769E0] transition hover:bg-[#F5FAFF] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sendingReset ? (
            <RefreshCw size={17} className="animate-spin" />
          ) : (
            <KeyRound size={17} />
          )}
          {sendingReset ? "Sending email..." : "Reset password"}
        </button>
      </section>

      <p className="text-center text-xs leading-5 text-[#98A2B3]">
        If your name, email address, role or account status is incorrect,
        contact your administrator.
      </p>
    </div>
  );
}