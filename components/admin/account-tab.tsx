"use client";

import { useEffect, useMemo, useState } from "react";
import { Moon, Sun, UserRound } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";

type Row = Record<string, unknown>;

function str(row: Row, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function AccountTab() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Row | null>(null);
  const [counts, setCounts] = useState({ images: 0, captions: 0, upvotes: 0, downvotes: 0 });
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("admin_theme");
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
      document.documentElement.classList.toggle("dark", stored === "dark");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("admin_theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  async function load() {
    if (!supabase) return;
    const { data: auth } = await supabase.auth.getUser();
    const authUser = auth.user;
    if (!authUser) return;
    setUser({ id: authUser.id, email: authUser.email || "" });

    const [profileRes, imagesRes, captionsRes, votesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle(),
      supabase.from("images").select("*", { count: "exact", head: true }).eq("user_id", authUser.id),
      supabase.from("captions").select("*", { count: "exact", head: true }).eq("user_id", authUser.id),
      supabase.from("caption_votes").select("vote_value").eq("profile_id", authUser.id).limit(10000),
    ]);

    setProfile((profileRes.data ?? null) as Row | null);
    const votes = (votesRes.data ?? []) as Row[];
    const upvotes = votes.filter((row) => Number(row["vote_value"] ?? 0) > 0).length;
    const downvotes = votes.filter((row) => Number(row["vote_value"] ?? 0) < 0).length;
    setCounts({
      images: imagesRes.count ?? 0,
      captions: captionsRes.count ?? 0,
      upvotes,
      downvotes,
    });
  }

  useEffect(() => {
    load();
  }, []);

  const displayName =
    str(profile ?? {}, ["full_name"]) ||
    str(profile ?? {}, ["username"]) ||
    (user?.email ? user.email.split("@")[0] : "Unknown user");

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Account</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage your appearance preferences and inspect your own activity data.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <UserRound className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
          </div>
          <p className="text-sm text-slate-700">
            <span className="font-semibold">Name:</span> {displayName}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-semibold">Email:</span> {user?.email || "N/A"}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-semibold">User ID:</span> {user?.id || "N/A"}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Theme</h2>
          <p className="mt-1 text-sm text-slate-600">Choose your preferred dashboard mode.</p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                theme === "light"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              <Sun className="h-4 w-4" />
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                theme === "dark"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              <Moon className="h-4 w-4" />
              Dark
            </button>
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Images Created</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{counts.images}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Captions Created</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{counts.captions}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Upvotes Cast</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{counts.upvotes}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Downvotes Cast</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{counts.downvotes}</p>
        </article>
      </section>
    </section>
  );
}
