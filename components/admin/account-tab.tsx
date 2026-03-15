"use client";

import { Camera, Loader2, Moon, RefreshCw, Save, Sun, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getAdminAvatarUrlFromUser,
  getAdminThemeFromUser,
  getAdminUsernameFromUser,
  getProfileName,
  type AdminTheme,
} from "../../lib/admin-preferences";
import {
  fetchAccountSnapshot,
  updateAdminProfile,
  updateAdminTheme,
  uploadProfileAvatar,
} from "../../lib/services/account";
import { getErrorMessage } from "../../lib/services/client";

type AccountSnapshot = Awaited<ReturnType<typeof fetchAccountSnapshot>>;

type AccountTabProps = {
  adminEmail?: string;
  theme: AdminTheme;
  onPreferencesChange?: (prefs: {
    theme?: AdminTheme;
    username?: string;
    avatarUrl?: string;
  }) => void;
};

type FlashMessage =
  | {
      kind: "success" | "error" | "info";
      text: string;
    }
  | null;

function messageClasses(kind: NonNullable<FlashMessage>["kind"]) {
  if (kind === "error") {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200";
  }

  if (kind === "info") {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200";
}

function readCreatedAt(snapshot: AccountSnapshot | null) {
  return (
    String(snapshot?.profile?.created_datetime_utc || "").trim() ||
    String(snapshot?.profile?.created_at || "").trim() ||
    ""
  );
}

export function AccountTab({ adminEmail = "", theme, onPreferencesChange }: AccountTabProps) {
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [message, setMessage] = useState<FlashMessage>(null);

  async function loadAccount(options?: { refresh?: boolean }) {
    const isRefresh = Boolean(options?.refresh);
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const nextSnapshot = await fetchAccountSnapshot();
      setSnapshot(nextSnapshot);

      const user = {
        email: nextSnapshot.user.email,
        user_metadata: nextSnapshot.user.userMetadata,
      };

      setUsernameDraft(getAdminUsernameFromUser(user, nextSnapshot.user.email || adminEmail));
      setAvatarUrl(getAdminAvatarUrlFromUser(user));

      if (!isRefresh) {
        const nextTheme = getAdminThemeFromUser(user, theme);
        onPreferencesChange?.({
          theme: nextTheme,
          username: getAdminUsernameFromUser(user, nextSnapshot.user.email || adminEmail),
          avatarUrl: getAdminAvatarUrlFromUser(user),
        });
      }
    } catch (error) {
      setMessage({ kind: "error", text: getErrorMessage(error) });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadAccount();
  }, []);

  async function handleThemeSelect(nextTheme: AdminTheme) {
    setSavingTheme(true);
    setMessage({ kind: "info", text: `Switching to ${nextTheme} mode...` });
    onPreferencesChange?.({ theme: nextTheme });

    try {
      await updateAdminTheme(nextTheme);
      setMessage({ kind: "success", text: `${nextTheme === "dark" ? "Dark" : "Light"} mode saved.` });
    } catch (error) {
      setMessage({ kind: "error", text: getErrorMessage(error) });
    } finally {
      setSavingTheme(false);
    }
  }

  async function handleProfileSave() {
    const nextUsername = usernameDraft.trim();
    if (!nextUsername) {
      setMessage({ kind: "error", text: "Username cannot be empty." });
      return;
    }

    setSavingProfile(true);
    setMessage({ kind: "info", text: "Saving profile settings..." });

    try {
      await updateAdminProfile({
        username: nextUsername,
        avatarUrl,
      });

      onPreferencesChange?.({
        username: nextUsername,
        avatarUrl,
      });
      setMessage({ kind: "success", text: "Profile settings saved." });
    } catch (error) {
      setMessage({ kind: "error", text: getErrorMessage(error) });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarChange(file: File | null) {
    if (!file) return;

    const nextUsername = usernameDraft.trim() || snapshot?.user.email?.split("@")[0] || "Administrator";
    setUploadingAvatar(true);
    setMessage({ kind: "info", text: "Uploading photo..." });

    try {
      const result = await uploadProfileAvatar({
        file,
        previousAvatarUrl: avatarUrl,
      });

      await updateAdminProfile({
        username: nextUsername,
        avatarUrl: result.publicUrl,
      });

      setAvatarUrl(result.publicUrl);
      setUsernameDraft(nextUsername);
      onPreferencesChange?.({
        username: nextUsername,
        avatarUrl: result.publicUrl,
      });
      setMessage({
        kind: result.storageWarning ? "info" : "success",
        text: result.storageWarning || "Profile photo updated.",
      });
    } catch (error) {
      setMessage({ kind: "error", text: getErrorMessage(error) });
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (loading && !snapshot) {
    return (
      <section className="space-y-6">
        <header>
          <h1 className="text-3xl font-semibold text-slate-900">Account</h1>
          <p className="mt-2 text-sm text-slate-600">Customize your admin profile and dashboard look.</p>
        </header>
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-700">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading your settings...</span>
          </div>
        </article>
      </section>
    );
  }

  const profileName = getProfileName(snapshot?.profile || null);
  const email = snapshot?.user.email || adminEmail || "N/A";
  const displayName = usernameDraft.trim() || profileName || email.split("@")[0] || "Administrator";
  const createdAt = readCreatedAt(snapshot);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Account</h1>
          <p className="mt-2 text-sm text-slate-600">Customize your theme, name, and profile photo.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadAccount({ refresh: true })}
          disabled={refreshing}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </header>

      {message ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${messageClasses(message.kind)}`}>{message.text}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row">
            <div className="flex flex-col items-center gap-3">
              <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={`${displayName} avatar`} className="h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.32),transparent_42%),linear-gradient(135deg,rgba(90,148,204,0.95),rgba(78,169,106,0.92))]" />
                )}
                {!avatarUrl ? <UserRound className="relative h-12 w-12 text-white" /> : null}
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
                {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                Upload photo
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => void handleAvatarChange(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Profile settings</h2>
                <p className="mt-1 text-sm text-slate-600">Pick the name and photo shown in the admin sidebar.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Username</span>
                  <input
                    type="text"
                    value={usernameDraft}
                    onChange={(event) => setUsernameDraft(event.target.value)}
                    placeholder="Choose a username"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </label>

                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">Preview</p>
                  <p className="text-lg font-semibold text-slate-900">{displayName}</p>
                  <p className="text-sm text-slate-600">{profileName || "No full name in profile yet."}</p>
                </div>
              </div>

              <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                <p>
                  <span className="font-semibold text-slate-900">Email:</span> {email}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">User ID:</span> {snapshot?.user.id || "N/A"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Profile name:</span> {profileName || "Not set"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Created:</span> {createdAt || "Unknown"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleProfileSave()}
                disabled={savingProfile || uploadingAvatar}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save profile
              </button>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            {theme === "dark" ? (
              <Moon className="h-5 w-5 text-slate-700" />
            ) : (
              <Sun className="h-5 w-5 text-slate-700" />
            )}
            <h2 className="text-xl font-semibold text-slate-900">Theme</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">Switch the whole admin area between light and dark mode.</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void handleThemeSelect("light")}
              disabled={savingTheme}
              className={`rounded-2xl border px-4 py-4 text-left shadow-sm ${
                theme === "light"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4" />
                <span className="font-medium">Light mode</span>
              </div>
              <p className={`mt-2 text-sm ${theme === "light" ? "text-white/80" : "text-slate-500"}`}>Bright canvas and softer panels.</p>
            </button>

            <button
              type="button"
              onClick={() => void handleThemeSelect("dark")}
              disabled={savingTheme}
              className={`rounded-2xl border px-4 py-4 text-left shadow-sm ${
                theme === "dark"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4" />
                <span className="font-medium">Dark mode</span>
              </div>
              <p className={`mt-2 text-sm ${theme === "dark" ? "text-white/80" : "text-slate-500"}`}>Dim background with higher contrast.</p>
            </button>
          </div>
        </article>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Images Created</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{snapshot?.counts.images ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Captions Created</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{snapshot?.counts.captions ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Upvotes Cast</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{snapshot?.counts.upvotes ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Downvotes Cast</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{snapshot?.counts.downvotes ?? 0}</p>
        </article>
      </section>
    </section>
  );
}
