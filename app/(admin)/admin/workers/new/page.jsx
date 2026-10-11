
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Save,
  User,
  Users,
} from "lucide-react";

import { useAuth } from "@/providers/AuthProvider";

const initialForm = {
  firstName: "",
  lastName: "",
  phone: "",
  employeeId: "",
  role: "",
  email: "",
  password: "",
};

const roles = [
  "Electrician",
  "Electronics Technician",
  "Security Technician",
  "Network Technician",
  "Construction Worker",
  "Plumber",
  "Carpenter",
  "Welder",
  "General Worker",
  "Driver",
  "Other",
];

export default function NewWorkerPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (error) {
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    // Basic frontend validation
    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.phone.trim() ||
      !form.employeeId.trim() ||
      !form.role.trim() ||
      !form.email.trim() ||
      !form.password
    ) {
      setError("Please complete all required fields.");
      return;
    }

    if (form.password.length < 6) {
      setError("The temporary password must be at least 6 characters.");
      return;
    }

    if (!user) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    setLoading(true);

    try {
      // Get the currently logged-in admin's Firebase ID token.
      const idToken = await user.getIdToken();

      const response = await fetch("/api/admin/workers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          employeeId: form.employeeId.trim(),
          role: form.role.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create worker.");
      }

      setSuccess("Worker account created successfully.");

      // Give the success message a moment before redirecting.
      setTimeout(() => {
        router.push(`/admin/workers/${data.workerId}`);
      }, 700);
    } catch (error) {
      console.error("Create worker error:", error);

      setError(
        error.message ||
          "Something went wrong while creating the worker account."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FBFF]">
      {/* Page Header */}
      <div className="mb-6">
        <Link
          href="/admin/workers"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#667085] transition hover:text-[#1769E0]"
        >
          <ArrowLeft size={17} />
          Back to Workers
        </Link>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#172033]">
            Add New Worker
          </h1>

          <p className="mt-1 text-sm text-[#667085]">
            Create a staff account and add the worker to your team.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto max-w-4xl">
        <form onSubmit={handleSubmit}>
          {/* Personal Information */}
          <div className="rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
            <div className="border-b border-[#E5EDF5] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
                  <User size={20} />
                </div>

                <div>
                  <h2 className="font-semibold text-[#172033]">
                    Personal Information
                  </h2>

                  <p className="text-sm text-[#667085]">
                    Basic information about the worker.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-2">
              {/* First Name */}
              <div>
                <label
                  htmlFor="firstName"
                  className="mb-2 block text-sm font-medium text-[#172033]"
                >
                  First Name <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <User
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
                  />

                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="Enter first name"
                    disabled={loading}
                    className="w-full rounded-xl border border-[#DCEAF8] bg-white py-3 pl-10 pr-4 text-sm text-[#172033] outline-none transition placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:ring-4 focus:ring-[#1769E0]/10 disabled:cursor-not-allowed disabled:bg-gray-50"
                  />
                </div>
              </div>

              {/* Last Name */}
              <div>
                <label
                  htmlFor="lastName"
                  className="mb-2 block text-sm font-medium text-[#172033]"
                >
                  Last Name <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <User
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
                  />

                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Enter last name"
                    disabled={loading}
                    className="w-full rounded-xl border border-[#DCEAF8] bg-white py-3 pl-10 pr-4 text-sm text-[#172033] outline-none transition placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:ring-4 focus:ring-[#1769E0]/10 disabled:cursor-not-allowed disabled:bg-gray-50"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-medium text-[#172033]"
                >
                  Phone Number <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <Phone
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
                  />

                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="e.g. 024 123 4567"
                    disabled={loading}
                    className="w-full rounded-xl border border-[#DCEAF8] bg-white py-3 pl-10 pr-4 text-sm text-[#172033] outline-none transition placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:ring-4 focus:ring-[#1769E0]/10 disabled:cursor-not-allowed disabled:bg-gray-50"
                  />
                </div>
              </div>

              {/* Employee ID */}
              <div>
                <label
                  htmlFor="employeeId"
                  className="mb-2 block text-sm font-medium text-[#172033]"
                >
                  Employee ID <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <Users
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
                  />

                  <input
                    id="employeeId"
                    name="employeeId"
                    type="text"
                    value={form.employeeId}
                    onChange={handleChange}
                    placeholder="e.g. APC-001"
                    disabled={loading}
                    className="w-full rounded-xl border border-[#DCEAF8] bg-white py-3 pl-10 pr-4 text-sm text-[#172033] outline-none transition placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:ring-4 focus:ring-[#1769E0]/10 disabled:cursor-not-allowed disabled:bg-gray-50"
                  />
                </div>
              </div>

              {/* Role */}
              <div className="md:col-span-2">
                <label
                  htmlFor="role"
                  className="mb-2 block text-sm font-medium text-[#172033]"
                >
                  Job Role <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <BriefcaseBusiness
                    size={18}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
                  />

                  <select
                    id="role"
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-full appearance-none rounded-xl border border-[#DCEAF8] bg-white py-3 pl-10 pr-4 text-sm text-[#172033] outline-none transition focus:border-[#1769E0] focus:ring-4 focus:ring-[#1769E0]/10 disabled:cursor-not-allowed disabled:bg-gray-50"
                  >
                    <option value="">Select worker role</option>

                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div className="mt-6 rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
            <div className="border-b border-[#E5EDF5] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
                  <Mail size={20} />
                </div>

                <div>
                  <h2 className="font-semibold text-[#172033]">
                    Login Information
                  </h2>

                  <p className="text-sm text-[#667085]">
                    These details will be used by the worker to sign in.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-2">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-[#172033]"
                >
                  Email Address <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
                  />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="worker@example.com"
                    disabled={loading}
                    autoComplete="email"
                    className="w-full rounded-xl border border-[#DCEAF8] bg-white py-3 pl-10 pr-4 text-sm text-[#172033] outline-none transition placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:ring-4 focus:ring-[#1769E0]/10 disabled:cursor-not-allowed disabled:bg-gray-50"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-[#172033]"
                >
                  Temporary Password <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Minimum 6 characters"
                    disabled={loading}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-[#DCEAF8] bg-white py-3 pl-4 pr-12 text-sm text-[#172033] outline-none transition placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:ring-4 focus:ring-[#1769E0]/10 disabled:cursor-not-allowed disabled:bg-gray-50"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085] transition hover:text-[#1769E0] disabled:cursor-not-allowed"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>

                <p className="mt-2 text-xs text-[#667085]">
                  Give this temporary password to the worker securely.
                </p>
              </div>
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircle2 size={18} />
              {success}
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/admin/workers"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[#DCEAF8] bg-white px-5 text-sm font-semibold text-[#172033] transition hover:bg-[#F5FAFF]"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1258BD] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating Worker...
                </>
              ) : (
                <>
                  <Save size={17} />
                  Create Worker
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
