"use client";

import { BarChart3, LogIn, Menu, PlusSquare, Search, ShieldCheck, UserRound, X } from "lucide-react";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";
import { CreateTab } from "./create-tab";
import { DataTab } from "./data-tab";
import { UserActivityManager } from "./user-activity-manager";
import { AccountTab } from "./account-tab";

type TopicCount = { topic: string; count: number };

type AdminTabsShellProps = {
  stats: {
    totalImages: number;
    mostActiveUser: string;
    mostActiveCount: number;
    topTopics: TopicCount[];
    error: string | null;
  };
};

type AdminTab = "create" | "data" | "users" | "account" | "admin-login";

const TAB_ITEMS: Array<{ id: AdminTab; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: "admin-login", label: "Admin Login", icon: ShieldCheck },
  { id: "create", label: "Create", icon: PlusSquare },
  { id: "data", label: "Data", icon: BarChart3 },
  { id: "users", label: "Search Users", icon: Search },
  { id: "account", label: "Account", icon: UserRound },
];

export function AdminTabsShell({ stats }: AdminTabsShellProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [activeTab, setActiveTab] = useState<AdminTab>("data");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminModeEnabled, setAdminModeEnabled] = useState(false);
  const [currentEmail, setCurrentEmail] = useState("");
  const [roleLoading, setRoleLoading] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);
  const ADMIN_MODE_INTENT_KEY = "admin_mode_intent_v1";

  async function loadRole() {
    if (!supabase) {
      setRoleError("Supabase client not available.");
      setRoleLoading(false);
      return;
    }

    setRoleLoading(true);
    setRoleError(null);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      setRoleError(authError.message ?? "Could not resolve logged-in user.");
      setCurrentEmail("");
      setIsAdmin(false);
      setAdminModeEnabled(false);
      setRoleLoading(false);
      return;
    }
    if (!authData.user) {
      setCurrentEmail("");
      setIsAdmin(false);
      setAdminModeEnabled(false);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(ADMIN_MODE_INTENT_KEY);
      }
      setRoleLoading(false);
      return;
    }
    setCurrentEmail(authData.user.email || "");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_superadmin")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) {
      setRoleError(profileError.message);
      setIsAdmin(false);
      setAdminModeEnabled(false);
      setRoleLoading(false);
      return;
    }

    const superadmin = Boolean(profile?.is_superadmin);
    setIsAdmin(superadmin);
    const hasAdminIntent = typeof window !== "undefined" && sessionStorage.getItem(ADMIN_MODE_INTENT_KEY) === "1";
    if (!superadmin) {
      setAdminModeEnabled(false);
      // If user explicitly used Admin Login but lacks superadmin, reject that sign-in.
      if (hasAdminIntent) {
        await supabase.auth.signOut();
        setCurrentEmail("");
        setRoleError("Admin login denied: this Google account is not a superadmin in Supabase.");
      }
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(ADMIN_MODE_INTENT_KEY);
      }
    } else if (typeof window !== "undefined") {
      setAdminModeEnabled(hasAdminIntent);
    }
    setRoleLoading(false);
  }

  useEffect(() => {
    loadRole();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadRole();
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleAdminLogin() {
    if (!supabase) return;
    setRoleError(null);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(ADMIN_MODE_INTENT_KEY, "1");
    }
    // Force Google account chooser so a viewer can switch into an admin account.
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    if (error) {
      setRoleError(error.message);
    }
  }

  const canEdit = isAdmin && adminModeEnabled;

  return (
    <main className="min-h-screen bg-slate-50">
      <button
        type="button"
        onClick={() => setSidebarOpen((open) => !open)}
        className="fixed left-4 top-4 z-50 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
      >
        {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        Menu
      </button>

      {sidebarOpen ? (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/30"
          aria-label="Close menu"
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-40 h-full w-72 border-r border-slate-200 bg-white p-5 pt-16 shadow-lg transition-transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <h2 className="text-lg font-semibold text-slate-900">Dashboard Tabs</h2>
        <p className="mt-1 text-xs text-slate-500">Read-only for everyone. Editing is superadmin-only.</p>

        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {roleLoading
            ? "Checking permissions..."
            : canEdit
            ? `Role: Superadmin Editor (${currentEmail || "signed in"})`
            : isAdmin
            ? `Role: Superadmin (read-only until Admin Login is enabled)`
            : currentEmail
            ? `Role: Viewer (${currentEmail})`
            : "Role: Guest Viewer"}
        </div>
        {roleError ? <p className="mt-2 text-xs text-rose-600">{roleError}</p> : null}

        <nav className="mt-4 space-y-2">
          {TAB_ITEMS.map((item) => {
            const Icon = item.icon;
            const selected = activeTab === item.id;
            const usersTabLocked = item.id === "users" && !canEdit;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (usersTabLocked) {
                    setActiveTab("admin-login");
                    setRoleError("View users by signing in as admin.");
                    setSidebarOpen(false);
                    return;
                  }
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                title={usersTabLocked ? "View users by signing in as admin" : undefined}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  selected ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="mx-auto max-w-7xl p-6 pt-20 md:p-10 md:pt-20">
        {activeTab === "admin-login" ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Admin Access</h1>
            <p className="mt-2 text-sm text-slate-600">
              Anyone can view this dashboard. Editing actions require a Google sign-in account that is marked
              <code> is_superadmin = true </code> in Supabase profiles.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAdminLogin}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                <LogIn className="h-4 w-4" />
                Admin Login (Google)
              </button>
            </div>
          </section>
        ) : null}
        {activeTab === "create" ? <CreateTab isAdmin={canEdit} /> : null}
        {activeTab === "data" ? <DataTab stats={stats} canViewUserData={canEdit} /> : null}
        {activeTab === "users" ? (
          <UserActivityManager canViewSensitive={canEdit} canMutate={canEdit} />
        ) : null}
        {activeTab === "account" ? <AccountTab /> : null}
      </div>
    </main>
  );
}
