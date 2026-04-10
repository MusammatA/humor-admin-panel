"use client";

import {
  BarChart3,
  BookOpen,
  Bot,
  Globe2,
  ImageIcon,
  Link2,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountTab } from "./account-tab";
import { AdminFeedbackProvider } from "./admin-feedback";
import { CaptionLibraryManager } from "./caption-library-manager";
import { ConfigTab } from "./config-tab";
import { CreateTab } from "./create-tab";
import { DataTab } from "./data-tab";
import { LLMPipelineManager } from "./llm-pipeline-manager";
import { LLMRegistryManager } from "./llm-registry-manager";
import { TermsManager } from "./terms-manager";
import { UserActivityManager } from "./user-activity-manager";
import { WhitelistManager } from "./whitelist-manager";
import {
  ADMIN_THEME_STORAGE_KEY,
  applyAdminTheme,
  getAdminAvatarUrlFromUser,
  getAdminThemeFromUser,
  getAdminUsernameFromUser,
  normalizeAdminTheme,
  type AdminTheme,
} from "../../lib/admin-preferences";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";

type TopicCount = { topic: string; count: number };

type AdminTabsShellProps = {
  stats: {
    totalImages: number;
    mostActiveUser: string;
    mostActiveCount: number;
    topTopics: TopicCount[];
    error: string | null;
  };
  adminEmail?: string;
};

type AdminTab =
  | "account"
  | "analytics"
  | "users"
  | "images"
  | "humor-flavors"
  | "terms"
  | "caption-library"
  | "llm-registry"
  | "llm-pipeline"
  | "allowed-domains"
  | "whitelisted-emails";

type NavItem = {
  id: AdminTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Personal",
    items: [{ id: "account", label: "Account", icon: UserRound }],
  },
  {
    label: "Content",
    items: [
      { id: "analytics", label: "Analytics", icon: BarChart3 },
      { id: "users", label: "Users", icon: Users },
      { id: "images", label: "Images + Captions", icon: ImageIcon },
    ],
  },
  {
    label: "Config",
    items: [
      { id: "humor-flavors", label: "Humor Flavors + Steps + Mix", icon: Sparkles },
      { id: "terms", label: "Terms", icon: BookOpen },
      { id: "caption-library", label: "Caption Requests + Examples", icon: ShieldCheck },
    ],
  },
  {
    label: "LLM",
    items: [
      { id: "llm-registry", label: "LLM Models + Providers", icon: Bot },
      { id: "llm-pipeline", label: "Prompt Chains + Responses", icon: Link2 },
    ],
  },
  {
    label: "Access",
    items: [
      { id: "allowed-domains", label: "Allowed Domains", icon: Globe2 },
      { id: "whitelisted-emails", label: "Whitelisted Emails", icon: Mail },
    ],
  },
];

function sidebarName(adminEmail: string) {
  const local = adminEmail.split("@")[0] || "Administrator";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AdminTabsShell({ stats, adminEmail = "" }: AdminTabsShellProps) {
  const [theme, setTheme] = useState<AdminTheme>("light");
  const [activeTab, setActiveTab] = useState<AdminTab>("analytics");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [sidebarDisplayName, setSidebarDisplayName] = useState(sidebarName(adminEmail) || "Administrator");
  const [sidebarAvatarUrl, setSidebarAvatarUrl] = useState("");
  const canEdit = true;
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    const fallbackTheme =
      typeof window === "undefined"
        ? "light"
        : normalizeAdminTheme(window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY));

    setTheme(fallbackTheme);
    applyAdminTheme(fallbackTheme);
    setSidebarDisplayName(sidebarName(adminEmail) || "Administrator");

    let cancelled = false;

    async function loadPreferences() {
      if (!supabase) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      const resolvedEmail = user?.email || adminEmail;
      const resolvedTheme = getAdminThemeFromUser(user ?? null, fallbackTheme);
      const resolvedUsername = getAdminUsernameFromUser(user ?? null, resolvedEmail);
      const resolvedAvatarUrl = getAdminAvatarUrlFromUser(user ?? null);

      setTheme(resolvedTheme);
      applyAdminTheme(resolvedTheme);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, resolvedTheme);
      }
      setSidebarDisplayName(resolvedUsername || sidebarName(resolvedEmail) || "Administrator");
      setSidebarAvatarUrl(resolvedAvatarUrl);
    }

    void loadPreferences();

    return () => {
      cancelled = true;
    };
  }, [adminEmail, supabase]);

  function handlePreferencesChange(update: { theme?: AdminTheme; username?: string; avatarUrl?: string }) {
    if (update.theme) {
      setTheme(update.theme);
      applyAdminTheme(update.theme);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, update.theme);
      }
    }

    if (typeof update.username === "string") {
      setSidebarDisplayName(update.username.trim() || sidebarName(adminEmail) || "Administrator");
    }

    if (typeof update.avatarUrl === "string") {
      setSidebarAvatarUrl(update.avatarUrl);
    }
  }

  async function handleSignOut() {
    if (!supabase || signingOut) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } finally {
      router.push("/login");
      router.refresh();
      setSigningOut(false);
    }
  }

  function renderActivePanel() {
    switch (activeTab) {
      case "account":
        return <AccountTab adminEmail={adminEmail} theme={theme} onPreferencesChange={handlePreferencesChange} />;
      case "analytics":
        return (
          <DataTab
            stats={stats}
            canViewUserData={canEdit}
            title="Analytics"
            description="See overall activity and trends."
          />
        );
      case "users":
        return (
          <UserActivityManager
            canViewSensitive={canEdit}
            canMutate={canEdit}
            title="Users"
            description="Browse users and review their activity."
          />
        );
      case "images":
        return (
          <CreateTab
            isAdmin={canEdit}
            title="Images + Captions"
            description="Manage images and the captions attached to them."
          />
        );
      case "humor-flavors":
        return <ConfigTab focusSection="humor-flavors" />;
      case "terms":
        return <TermsManager canManage={canEdit} />;
      case "caption-library":
        return <CaptionLibraryManager canManage={canEdit} />;
      case "llm-registry":
        return <LLMRegistryManager canManage={canEdit} />;
      case "llm-pipeline":
        return <LLMPipelineManager />;
      case "allowed-domains":
        return <ConfigTab focusSection="allowed-domains" />;
      case "whitelisted-emails":
        return <WhitelistManager canManage={canEdit} />;
      default:
        return null;
    }
  }

  const isDark = theme === "dark";
  const mainClassName = isDark ? "min-h-screen bg-[#050912] text-white" : "min-h-screen bg-transparent text-slate-900";
  const mainBackgroundStyle = isDark
    ? {
        backgroundImage: [
          "radial-gradient(900px 520px at 18% -10%, rgba(90, 148, 204, 0.18), transparent 60%)",
          "radial-gradient(760px 460px at 82% 8%, rgba(78, 169, 106, 0.15), transparent 58%)",
          "linear-gradient(to bottom, rgba(148, 163, 184, 0.08) 1px, transparent 1px)",
          "linear-gradient(to right, rgba(148, 163, 184, 0.08) 1px, transparent 1px)",
        ].join(", "),
        backgroundSize: "auto, auto, 30px 30px, 30px 30px",
      }
    : {
        backgroundImage: [
          "radial-gradient(920px 460px at 16% -8%, rgba(226, 95, 52, 0.12), transparent 58%)",
          "radial-gradient(780px 430px at 84% 8%, rgba(78, 169, 106, 0.11), transparent 58%)",
          "linear-gradient(to bottom, rgba(31, 45, 47, 0.05) 1px, transparent 1px)",
          "linear-gradient(to right, rgba(31, 45, 47, 0.05) 1px, transparent 1px)",
        ].join(", "),
        backgroundSize: "auto, auto, 30px 30px, 30px 30px",
      };
  const asideClassName = isDark
    ? "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10 bg-[#0a0a0f] transition-transform duration-200"
    : "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-[rgba(255,253,248,0.94)] backdrop-blur transition-transform duration-200";
  const menuButtonClassName = isDark
    ? "fixed left-4 top-4 z-50 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm font-medium text-white backdrop-blur lg:hidden"
    : "fixed left-4 top-4 z-50 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-[rgba(255,253,248,0.96)] px-3 py-2 text-sm font-medium text-slate-900 shadow-sm backdrop-blur lg:hidden";
  const mobileOverlayClassName = isDark ? "fixed inset-0 z-30 bg-black/60 lg:hidden" : "fixed inset-0 z-30 bg-slate-900/25 lg:hidden";
  const headerBorderClassName = isDark ? "border-b border-white/10 px-6 py-6" : "border-b border-slate-200 px-6 py-6";
  const footerClassName = isDark ? "border-t border-white/10 px-4 py-4" : "border-t border-slate-200 px-4 py-4";
  const groupLabelClassName = isDark
    ? "mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500"
    : "mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500";
  const inactiveItemClassName = isDark
    ? "text-slate-300 hover:bg-white/5 hover:text-white"
    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900";
  const activeItemClassName = isDark
    ? "bg-[linear-gradient(135deg,rgba(90,148,204,0.18),rgba(78,169,106,0.18))] text-[#e6f5ff] shadow-[inset_0_0_0_1px_rgba(120,211,191,0.32),0_12px_30px_rgba(4,18,31,0.22)]"
    : "bg-[linear-gradient(135deg,rgba(90,148,204,0.12),rgba(78,169,106,0.12))] text-slate-900 shadow-[inset_0_0_0_1px_rgba(90,148,204,0.24),0_10px_24px_rgba(90,148,204,0.12)]";
  const activeIconClassName = isDark ? "text-[#9ce9d6]" : "text-[#4f9d8a]";
  const inactiveIconClassName = isDark ? "text-slate-500" : "text-slate-500";

  return (
    <main className={mainClassName} style={mainBackgroundStyle}>
      <button
        type="button"
        onClick={() => setSidebarOpen((open) => !open)}
        className={menuButtonClassName}
      >
        {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        Menu
      </button>

      {sidebarOpen ? (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className={mobileOverlayClassName}
          aria-label="Close menu"
        />
      ) : null}

      <aside
        className={`${asideClassName} lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className={headerBorderClassName}>
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(145deg,rgba(255,255,255,0.18),rgba(255,255,255,0.04))] shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
              {sidebarAvatarUrl ? (
                <img src={sidebarAvatarUrl} alt={`${sidebarDisplayName} profile`} className="h-full w-full object-cover" />
              ) : (
                <>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,255,255,0.28),transparent_42%),linear-gradient(135deg,rgba(90,148,204,0.95),rgba(78,169,106,0.9))]" />
                  <ShieldCheck className="relative h-5 w-5 text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.35)]" />
                </>
              )}
            </div>
            <div>
              <p className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Admin</p>
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                {sidebarDisplayName || "Administrator"}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5">
          {NAV_GROUPS.map((group) => (
            <section key={group.label} className="mb-7">
              <p className={groupLabelClassName}>{group.label}</p>
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const selected = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                        selected ? activeItemClassName : inactiveItemClassName
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${selected ? activeIconClassName : inactiveIconClassName}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <div className={footerClassName}>
          <p className={`mb-4 px-2 text-xs ${isDark ? "text-slate-500" : "text-slate-500"}`}>Humor Admin Panel</p>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition disabled:opacity-50 ${
              isDark ? "text-slate-300 hover:bg-white/5 hover:text-white" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <LogOut className={`h-4 w-4 ${isDark ? "text-slate-500" : "text-slate-500"}`} />
            <span>{signingOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-72">
        <div className="w-full px-4 pb-10 pt-20 sm:px-8 lg:px-10 lg:pt-10 2xl:px-14">
          <AdminFeedbackProvider>{renderActivePanel()}</AdminFeedbackProvider>
        </div>
      </div>
    </main>
  );
}
