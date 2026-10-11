"use client";

import { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";

import { auth } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || !user || !profile) return;

    if (profile.role === "admin") {
      router.replace("/admin");
    } else if (profile.role === "staff") {
      router.replace("/staff");
    }
  }, [user, profile, loading, router]);

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error(error);

      switch (error.code) {
        case "auth/invalid-credential":
          setError("Invalid email or password.");
          break;

        case "auth/user-not-found":
          setError("No account was found with this email.");
          break;

        case "auth/wrong-password":
          setError("Incorrect password.");
          break;

        case "auth/too-many-requests":
          setError("Too many attempts. Please try again later.");
          break;

        default:
          setError("Unable to sign in. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F8FBFF] via-white to-[#EAF4FF] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1769E0] text-white shadow-lg shadow-blue-200">
            <ShieldCheck size={32} />
          </div>

          <h1 className="text-2xl font-bold text-[#0F3D70]">
            Abes Power & Construction
          </h1>

          <p className="mt-2 text-sm text-[#667085]">
            Staff Management System
          </p>
        </div>

        <div className="rounded-3xl border border-[#E5EDF5] bg-white p-7 shadow-xl shadow-blue-100/40">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#172033]">
              Welcome back
            </h2>

            <p className="mt-1 text-sm text-[#667085]">
              Sign in to access your workspace.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#172033]">
                Email address
              </label>

              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
                />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-xl text-[#172033] border border-[#DCEAF8] bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#1769E0] focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#172033]">
                Password
              </label>

              <div className="relative">
                <LockKeyhole
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
                />

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full rounded-xl text-[#172033] border border-[#DCEAF8] bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#1769E0] focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#1769E0] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1259C4] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-[#98A2B3]">
          Authorized staff only
        </p>
      </div>
    </main>
  );
}