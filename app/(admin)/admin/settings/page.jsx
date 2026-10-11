"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";

import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "@/config/Firebase";
import { useAuth } from "@/providers/AuthProvider";

const TABS = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "account", label: "My Account", icon: UserRound },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "security", label: "Security", icon: LockKeyhole },
];

const DEFAULT_COMPANY = {
  companyName: "Abes Power and Construction",
  phone: "",
  email: "",
  address: "",
  website: "",
  currency: "GHS",
};

const DEFAULT_PREFERENCES = {
  emailNotifications: true,
  requestNotifications: true,
  workSubmissionNotifications: true,
  lowStockNotifications: true,
  compactTables: false,
};

const inputClass =
  "w-full rounded-xl border border-[#DCEAF8] bg-white px-3.5 py-2.5 text-sm text-[#172033] outline-none transition placeholder:text-[#98A2B3] focus:border-[#1769E0] focus:ring-2 focus:ring-[#EAF4FF]";

function SettingsCard({ icon: Icon, title, description, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E5EDF5] bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-[#E5EDF5] p-5 sm:p-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1769E0]">
          <Icon size={20} />
        </div>

        <div>
          <h2 className="font-semibold text-[#172033]">{title}</h2>
          <p className="mt-1 text-sm text-[#667085]">{description}</p>
        </div>
      </div>

      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-semibold text-[#344054]">
        {label}
      </span>

      {children}

      {hint && (
        <span className="mt-1.5 block text-xs leading-5 text-[#667085]">
          {hint}
        </span>
      )}
    </label>
  );
}

function ToggleRow({ title, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#172033]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#667085]">
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          checked ? "bg-[#1769E0]" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function SaveButton({ saving, children = "Save changes" }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1259C1] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {saving ? (
        <LoaderCircle className="animate-spin" size={17} />
      ) : (
        <Save size={17} />
      )}

      {saving ? "Saving..." : children}
    </button>
  );
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState("company");

  const [company, setCompany] = useState(DEFAULT_COMPANY);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [accountName, setAccountName] = useState("");

  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const isAdmin = profile?.role === "admin";

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
  // LOAD COMPANY SETTINGS AND ADMIN PREFERENCES
  // --------------------------------------------------

  useEffect(() => {
    if (authLoading) return;

    if (!user || !isAdmin) {
      setSettingsLoading(false);
      return;
    }

    setSettingsLoading(true);

    const loaded = new Set();
    let active = true;

    function markLoaded(key) {
      loaded.add(key);

      if (active && loaded.size === 2) {
        setSettingsLoading(false);
      }
    }

    const unsubscribeCompany = onSnapshot(
      doc(db, "settings", "company"),
      (snapshot) => {
        if (!active) return;

        if (snapshot.exists()) {
          setCompany({
            ...DEFAULT_COMPANY,
            ...snapshot.data(),
          });
        } else {
          setCompany(DEFAULT_COMPANY);
        }

        markLoaded("company");
      },
      (listenerError) => {
        console.error("Company settings error:", listenerError);

        if (active) {
          setError(
            "Unable to load company settings. Check your Firestore permissions."
          );
          setSettingsLoading(false);
        }
      }
    );

    const unsubscribePreferences = onSnapshot(
      doc(db, "adminSettings", user.uid),
      (snapshot) => {
        if (!active) return;

        if (snapshot.exists()) {
          setPreferences({
            ...DEFAULT_PREFERENCES,
            ...(snapshot.data().preferences || {}),
          });
        } else {
          setPreferences(DEFAULT_PREFERENCES);
        }

        markLoaded("preferences");
      },
      (listenerError) => {
        console.error("Admin preferences error:", listenerError);

        if (active) {
          setError(
            "Unable to load admin preferences. Check your Firestore permissions."
          );
          setSettingsLoading(false);
        }
      }
    );

    return () => {
      active = false;
      unsubscribeCompany();
      unsubscribePreferences();
    };
  }, [authLoading, user, isAdmin]);

  // Keep the account name in sync with the current profile.
  useEffect(() => {
    if (!user) return;

    setAccountName(
      profile?.name ||
        profile?.fullName ||
        profile?.displayName ||
        user.displayName ||
        ""
    );
  }, [
    user?.uid,
    user?.displayName,
    profile?.name,
    profile?.fullName,
    profile?.displayName,
  ]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function notifyError(message) {
    setError(message);
    setSuccess("");
  }

  function notifySuccess(message) {
    setSuccess(message);
    setError("");
  }

  // --------------------------------------------------
  // SAVE COMPANY SETTINGS
  // --------------------------------------------------

  async function saveCompanySettings(event) {
    event.preventDefault();

    if (!user || !isAdmin) {
      notifyError("Administrator access is required.");
      return;
    }

    if (!company.companyName.trim()) {
      notifyError("Enter the company name.");
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      await setDoc(
        doc(db, "settings", "company"),
        {
          companyName: company.companyName.trim(),
          phone: company.phone.trim(),
          email: company.email.trim(),
          address: company.address.trim(),
          website: company.website.trim(),
          currency: "GHS",
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      notifySuccess("Company settings saved successfully.");
    } catch (saveError) {
      console.error("Save company settings error:", saveError);

      notifyError(
        saveError?.code === "permission-denied"
          ? "You do not have permission to save company settings. Check your Firestore rules."
          : saveError.message || "Unable to save company settings."
      );
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // SAVE ADMIN ACCOUNT DETAILS
  // --------------------------------------------------

  async function saveAccountSettings(event) {
    event.preventDefault();

    if (!user || !isAdmin) {
      notifyError("Administrator access is required.");
      return;
    }

    const name = accountName.trim();

    if (!name) {
      notifyError("Enter your display name.");
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      // Update the Firebase Authentication display name.
      await updateProfile(user, {
        displayName: name,
      });

      // Merge account fields without replacing the user's role.
      await setDoc(
        doc(db, "users", user.uid),
        {
          name,
          fullName: name,
          displayName: name,
          email: user.email || "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      notifySuccess("Your account details have been updated.");
    } catch (saveError) {
      console.error("Save admin account error:", saveError);

      notifyError(
        saveError?.code === "permission-denied"
          ? "Your name could not be saved to the user profile. Check your Firestore rules for users."
          : saveError.message ||
              "Unable to update your account details."
      );
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // SAVE PREFERENCES
  // --------------------------------------------------

  async function savePreferences(event) {
    event.preventDefault();

    if (!user || !isAdmin) {
      notifyError("Administrator access is required.");
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      await setDoc(
        doc(db, "adminSettings", user.uid),
        {
          preferences,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      notifySuccess("Your preferences have been saved.");
    } catch (saveError) {
      console.error("Save admin preferences error:", saveError);

      notifyError(
        saveError?.code === "permission-denied"
          ? "You do not have permission to save preferences."
          : saveError.message || "Unable to save preferences."
      );
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // CHANGE PASSWORD
  // --------------------------------------------------

  async function changePassword(event) {
    event.preventDefault();

    if (!user || !isAdmin) {
      notifyError("Administrator access is required.");
      return;
    }

    if (!user.email) {
      notifyError(
        "A password cannot be changed because this account has no email address."
      );
      return;
    }

    const hasPasswordProvider = user.providerData?.some(
      (provider) => provider.providerId === "password"
    );

    if (!hasPasswordProvider) {
      notifyError(
        "This account does not use email and password sign-in. Change the password through the identity provider used to sign in."
      );
      return;
    }

    if (!passwordForm.currentPassword) {
      notifyError("Enter your current password.");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      notifyError("Your new password must contain at least 8 characters.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      notifyError("The new passwords do not match.");
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      notifyError("Your new password must be different from the current password.");
      return;
    }

    setChangingPassword(true);
    clearMessages();

    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        passwordForm.currentPassword
      );

      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, passwordForm.newPassword);

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      notifySuccess("Your password has been changed successfully.");
    } catch (passwordError) {
      console.error("Change password error:", passwordError);

      if (
        passwordError?.code === "auth/wrong-password" ||
        passwordError?.code === "auth/invalid-credential" ||
        passwordError?.code === "auth/invalid-login-credentials"
      ) {
        notifyError("The current password is incorrect.");
      } else if (passwordError?.code === "auth/weak-password") {
        notifyError("Choose a stronger password.");
      } else if (passwordError?.code === "auth/requires-recent-login") {
        notifyError(
          "For security, sign out and sign back in before changing your password."
        );
      } else {
        notifyError(
          passwordError.message || "Unable to change your password."
        );
      }
    } finally {
      setChangingPassword(false);
    }
  }

  // --------------------------------------------------
  // LOADING / ACCESS STATES
  // --------------------------------------------------

  if (
    authLoading ||
    settingsLoading ||
    (!profile?.role && Boolean(user))
  ) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoaderCircle
          className="animate-spin text-[#1769E0]"
          size={28}
        />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-[#E5EDF5] bg-white p-8 text-center shadow-sm">
          <ShieldCheck
            className="mx-auto text-[#1769E0]"
            size={34}
          />

          <h1 className="mt-4 text-xl font-bold text-[#172033]">
            Admin access required
          </h1>

          <p className="mt-2 text-sm leading-6 text-[#667085]">
            Sign in with an administrator account to manage these settings.
          </p>
        </div>
      </div>
    );
  }

  const initials =
    (accountName || user.email || "A")
      .trim()
      .charAt(0)
      .toUpperCase() || "A";

  // --------------------------------------------------
  // SETTINGS PAGE
  // --------------------------------------------------

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* HEADER */}
      <header>
        <p className="text-sm font-semibold text-[#1769E0]">
          ADMINISTRATION
        </p>

        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
          Settings
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
          Manage company information, your administrator account, and dashboard
          preferences.
        </p>
      </header>

      {/* FEEDBACK */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <X className="mt-0.5 shrink-0" size={18} />
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

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
          <p className="flex-1">{success}</p>
          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label="Dismiss success"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* ACCOUNT SUMMARY */}
      <section className="flex flex-col gap-4 rounded-2xl border border-[#E5EDF5] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EAF4FF] text-xl font-bold text-[#1769E0]">
            {initials}
          </div>

          <div className="min-w-0">
            <h2 className="break-words font-semibold text-[#172033]">
              {accountName || "Administrator"}
            </h2>

            <p className="mt-1 break-all text-sm text-[#667085]">
              {user.email || "No email address"}
            </p>

            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <ShieldCheck size={13} />
              Administrator
            </span>
          </div>
        </div>

        <p className="text-xs text-[#98A2B3]">
          Settings are saved to your Firebase project.
        </p>
      </section>

      {/* NAVIGATION + CONTENT */}
      <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* TAB NAVIGATION */}
        <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-[#E5EDF5] bg-white p-2 lg:flex-col">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
                clearMessages();
              }}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium transition ${
                activeTab === id
                  ? "bg-[#EAF4FF] text-[#1769E0]"
                  : "text-[#667085] hover:bg-[#F8FBFF] hover:text-[#172033]"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-6">
          {/* ------------------------------------------ */}
          {/* COMPANY SETTINGS                           */}
          {/* ------------------------------------------ */}

          {activeTab === "company" && (
            <SettingsCard
              icon={Building2}
              title="Company information"
              description="The company's identity and contact details."
            >
              <form onSubmit={saveCompanySettings} className="space-y-5">
                <Field label="Company name *">
                  <input
                    required
                    value={company.companyName}
                    onChange={(event) =>
                      setCompany((current) => ({
                        ...current,
                        companyName: event.target.value,
                      }))
                    }
                    placeholder="Company name"
                    className={inputClass}
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Company phone">
                    <div className="relative">
                      <Phone
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
                      />

                      <input
                        value={company.phone}
                        onChange={(event) =>
                          setCompany((current) => ({
                            ...current,
                            phone: event.target.value,
                          }))
                        }
                        placeholder="+233..."
                        className={`${inputClass} pl-9`}
                      />
                    </div>
                  </Field>

                  <Field label="Company email">
                    <div className="relative">
                      <Mail
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
                      />

                      <input
                        type="email"
                        value={company.email}
                        onChange={(event) =>
                          setCompany((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                        placeholder="company@example.com"
                        className={`${inputClass} pl-9`}
                      />
                    </div>
                  </Field>
                </div>

                <Field label="Company address">
                  <div className="relative">
                    <MapPin
                      size={16}
                      className="absolute left-3 top-3 text-[#98A2B3]"
                    />

                    <textarea
                      rows={3}
                      value={company.address}
                      onChange={(event) =>
                        setCompany((current) => ({
                          ...current,
                          address: event.target.value,
                        }))
                      }
                      placeholder="Enter the company's office address"
                      className={`${inputClass} resize-y pl-9`}
                    />
                  </div>
                </Field>

                <Field label="Company website">
                  <input
                    type="url"
                    value={company.website}
                    onChange={(event) =>
                      setCompany((current) => ({
                        ...current,
                        website: event.target.value,
                      }))
                    }
                    placeholder="https://example.com"
                    className={inputClass}
                  />
                </Field>

                <Field
                  label="Currency"
                  hint="Your finance pages currently use Ghana cedis (GHS). This setting is stored for company reference and does not automatically change currency formatting throughout the application."
                >
                  <input
                    value="Ghana cedi (GHS)"
                    readOnly
                    className={`${inputClass} cursor-not-allowed bg-[#F8FBFF] text-[#667085]`}
                  />
                </Field>

                <div className="flex justify-end border-t border-[#E5EDF5] pt-5">
                  <SaveButton saving={saving}>
                    Save Company Settings
                  </SaveButton>
                </div>
              </form>
            </SettingsCard>
          )}

          {/* ------------------------------------------ */}
          {/* ACCOUNT SETTINGS                           */}
          {/* ------------------------------------------ */}

          {activeTab === "account" && (
            <SettingsCard
              icon={UserRound}
              title="Administrator account"
              description="Manage the name shown for your account."
            >
              <form onSubmit={saveAccountSettings} className="space-y-5">
                <Field label="Display name *">
                  <input
                    required
                    value={accountName}
                    onChange={(event) =>
                      setAccountName(event.target.value)
                    }
                    placeholder="Your name"
                    className={inputClass}
                  />
                </Field>

                <Field
                  label="Email address"
                  hint="The authentication email is displayed here. Email changes should be handled through Firebase Authentication and email verification."
                >
                  <input
                    type="email"
                    value={user.email || ""}
                    readOnly
                    className={`${inputClass} cursor-not-allowed bg-[#F8FBFF] text-[#667085]`}
                  />
                </Field>

                <div className="rounded-xl border border-[#E5EDF5] bg-[#F8FBFF] p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck
                      size={19}
                      className="mt-0.5 shrink-0 text-[#1769E0]"
                    />

                    <div>
                      <p className="text-sm font-semibold text-[#172033]">
                        Administrator permissions
                      </p>

                      <p className="mt-1 text-xs leading-5 text-[#667085]">
                        Your account role is managed by the application's user
                        profile and security rules. This page does not change
                        your administrator privileges.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end border-t border-[#E5EDF5] pt-5">
                  <SaveButton saving={saving}>
                    Save Account
                  </SaveButton>
                </div>
              </form>
            </SettingsCard>
          )}

          {/* ------------------------------------------ */}
          {/* PREFERENCES                                */}
          {/* ------------------------------------------ */}

          {activeTab === "preferences" && (
            <SettingsCard
              icon={Settings2}
              title="Preferences"
              description="Choose the administrator preferences you want to save."
            >
              <form onSubmit={savePreferences}>
                <div className="divide-y divide-[#E5EDF5]">
                  <ToggleRow
                    title="Email notifications"
                    description="Save your preference for receiving email notifications."
                    checked={preferences.emailNotifications}
                    onChange={(checked) =>
                      setPreferences((current) => ({
                        ...current,
                        emailNotifications: checked,
                      }))
                    }
                  />

                  <ToggleRow
                    title="Worker money requests"
                    description="Preference for alerts when workers submit money requests."
                    checked={preferences.requestNotifications}
                    onChange={(checked) =>
                      setPreferences((current) => ({
                        ...current,
                        requestNotifications: checked,
                      }))
                    }
                  />

                  <ToggleRow
                    title="Work submissions"
                    description="Preference for alerts when workers submit work."
                    checked={preferences.workSubmissionNotifications}
                    onChange={(checked) =>
                      setPreferences((current) => ({
                        ...current,
                        workSubmissionNotifications: checked,
                      }))
                    }
                  />

                  <ToggleRow
                    title="Low stock alerts"
                    description="Preference for highlighting resources at or below their minimum stock."
                    checked={preferences.lowStockNotifications}
                    onChange={(checked) =>
                      setPreferences((current) => ({
                        ...current,
                        lowStockNotifications: checked,
                      }))
                    }
                  />

                  <ToggleRow
                    title="Compact tables"
                    description="Save a preference for denser table layouts in the admin portal."
                    checked={preferences.compactTables}
                    onChange={(checked) =>
                      setPreferences((current) => ({
                        ...current,
                        compactTables: checked,
                      }))
                    }
                  />
                </div>

                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs leading-5 text-amber-900">
                    These switches save your preferences to Firestore. Email
                    delivery, push notifications, and automatic table-density
                    changes must also be connected to these preferences in the
                    relevant application features before they take effect.
                  </p>
                </div>

                <div className="flex justify-end border-t border-[#E5EDF5] pt-5 mt-5">
                  <SaveButton saving={saving}>
                    Save Preferences
                  </SaveButton>
                </div>
              </form>
            </SettingsCard>
          )}

          {/* ------------------------------------------ */}
          {/* SECURITY                                   */}
          {/* ------------------------------------------ */}

          {activeTab === "security" && (
            <SettingsCard
              icon={LockKeyhole}
              title="Security"
              description="Change the password for an email-and-password account."
            >
              {user.providerData?.some(
                (provider) => provider.providerId === "password"
              ) ? (
                <form onSubmit={changePassword} className="space-y-5">
                  <Field label="Current password *">
                    <div className="relative">
                      <input
                        required
                        type={
                          showCurrentPassword ? "text" : "password"
                        }
                        autoComplete="current-password"
                        value={passwordForm.currentPassword}
                        onChange={(event) =>
                          setPasswordForm((current) => ({
                            ...current,
                            currentPassword: event.target.value,
                          }))
                        }
                        placeholder="Enter your current password"
                        className={`${inputClass} pr-11`}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowCurrentPassword((value) => !value)
                        }
                        aria-label={
                          showCurrentPassword
                            ? "Hide current password"
                            : "Show current password"
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#1769E0]"
                      >
                        {showCurrentPassword ? (
                          <EyeOff size={17} />
                        ) : (
                          <Eye size={17} />
                        )}
                      </button>
                    </div>
                  </Field>

                  <Field
                    label="New password *"
                    hint="Use at least 8 characters."
                  >
                    <div className="relative">
                      <input
                        required
                        minLength={8}
                        type={showNewPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={passwordForm.newPassword}
                        onChange={(event) =>
                          setPasswordForm((current) => ({
                            ...current,
                            newPassword: event.target.value,
                          }))
                        }
                        placeholder="Enter a new password"
                        className={`${inputClass} pr-11`}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowNewPassword((value) => !value)
                        }
                        aria-label={
                          showNewPassword
                            ? "Hide new password"
                            : "Show new password"
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#1769E0]"
                      >
                        {showNewPassword ? (
                          <EyeOff size={17} />
                        ) : (
                          <Eye size={17} />
                        )}
                      </button>
                    </div>
                  </Field>

                  <Field label="Confirm new password *">
                    <input
                      required
                      minLength={8}
                      type={showNewPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={passwordForm.confirmPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({
                          ...current,
                          confirmPassword: event.target.value,
                        }))
                      }
                      placeholder="Re-enter your new password"
                      className={inputClass}
                    />
                  </Field>

                  <div className="rounded-xl border border-[#E5EDF5] bg-[#F8FBFF] p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck
                        size={19}
                        className="mt-0.5 shrink-0 text-[#1769E0]"
                      />

                      <p className="text-xs leading-5 text-[#667085]">
                        Your current password is verified before the new
                        password is saved. Firebase may require you to sign in
                        again if your session is no longer recent.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-[#E5EDF5] pt-5">
                    <button
                      type="submit"
                      disabled={changingPassword}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1259C1] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {changingPassword ? (
                        <LoaderCircle
                          className="animate-spin"
                          size={17}
                        />
                      ) : (
                        <LockKeyhole size={17} />
                      )}

                      {changingPassword
                        ? "Updating password..."
                        : "Change Password"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="rounded-xl border border-[#E5EDF5] bg-[#F8FBFF] p-5">
                  <ShieldCheck className="text-[#1769E0]" size={24} />

                  <h3 className="mt-3 font-semibold text-[#172033]">
                    Password managed by your sign-in provider
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-[#667085]">
                    This account does not currently expose email-and-password
                    authentication. Manage your password through the provider
                    you use to sign in.
                  </p>
                </div>
              )}
            </SettingsCard>
          )}
        </div>
      </div>

      {/* FOOTNOTE */}
      <div className="flex items-start gap-3 rounded-xl border border-[#DCEAF8] bg-[#F5FAFF] p-4">
        <ShieldCheck
          size={18}
          className="mt-0.5 shrink-0 text-[#1769E0]"
        />

        <p className="text-xs leading-5 text-[#667085]">
          Company settings are stored in{" "}
          <code className="rounded bg-white px-1.5 py-0.5">
            settings/company
          </code>
          , while administrator preferences are stored separately for each
          account. The public website and other admin screens will only reflect
          company changes automatically if those pages read these settings.
        </p>
      </div>
    </div>
  );
}