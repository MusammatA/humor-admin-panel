"use client";

import {
  BarChart3,
  BookOpen,
  Bot,
  Cpu,
  Globe2,
  ImageIcon,
  Link2,
  ListOrdered,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  PanelLeftClose,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  FileText,
} from "lucide-react";
import { type ComponentType, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CaptionExamplesManager } from "./caption-examples-manager";
import { CaptionRequestsManager } from "./caption-requests-manager";
import { CaptionsManager } from "./captions-manager";
import { ConfigTab } from "./config-tab";
import { CreateTab } from "./create-tab";
import { DataTab } from "./data-tab";
import { LLMModelsManager } from "./llm-models-manager";
import { LLMPromptChainsManager } from "./llm-prompt-chains-manager";
import { LLMResponsesManager } from "./llm-responses-manager";
import { TermsManager } from "./terms-manager";
import { UserActivityManager } from "./user-activity-manager";
import { WhitelistManager } from "./whitelist-manager";
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
  | "analytics"
  | "users"
  | "images"
  | "captions"
  | "humor-flavors"
  | "flavor-steps"
  | "humor-mix"
  | "terms"
  | "caption-requests"
  | "caption-examples"
  | "llm-models"
  | "llm-providers"
  | "prompt-chains"
  | "llm-responses"
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
    label: "Content",
    items: [
      { id: "analytics", label: "Analytics", icon: BarChart3 },
      { id: "users", label: "Users", icon: Users },
      { id: "images", label: "Images", icon: ImageIcon },
      { id: "captions", label: "Captions", icon: MessageSquare },
    ],
  },
  {
    label: "Config",
    items: [
      { id: "humor-flavors", label: "Humor Flavors", icon: Sparkles },
      { id: "flavor-steps", label: "Flavor Steps", icon: ListOrdered },
      { id: "humor-mix", label: "Humor Mix", icon: SlidersHorizontal },
      { id: "terms", label: "Terms", icon: BookOpen },
      { id: "caption-requests", label: "Caption Requests", icon: ShieldCheck },
      { id: "caption-examples", label: "Caption Examples", icon: FileText },
    ],
  },
  {
    label: "LLM",
    items: [
      { id: "llm-models", label: "LLM Models", icon: Bot },
      { id: "llm-providers", label: "LLM Providers", icon: Cpu },
      { id: "prompt-chains", label: "Prompt Chains", icon: Link2 },
      { id: "llm-responses", label: "LLM Responses", icon: FileText },
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
  const [activeTab, setActiveTab] = useState<AdminTab>("analytics");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const canEdit = true;
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

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
      case "analytics":
        return (
          <DataTab
            stats={stats}
            canViewUserData={canEdit}
            title="Analytics"
            description="Track aggregate caption, image, topic, and user trends across the dataset."
          />
        );
      case "users":
        return (
          <UserActivityManager
            canViewSensitive={canEdit}
            canMutate={canEdit}
            title="Users"
            description="Search people, inspect created images and captions, analyze vote behavior, and moderate activity."
          />
        );
      case "images":
        return (
          <CreateTab
            isAdmin={canEdit}
            title="Images"
            description="Upload new images, replace media, delete memes, and moderate image-linked caption content."
          />
        );
      case "captions":
        return (
          <CaptionsManager
            canManage={canEdit}
            title="Captions"
            description="Review, edit, and delete caption rows."
            includeRequests={false}
            includeExamples={false}
          />
        );
      case "humor-flavors":
        return <ConfigTab focusSection="humor-flavors" />;
      case "flavor-steps":
        return <ConfigTab focusSection="flavor-steps" />;
      case "humor-mix":
        return <ConfigTab focusSection="humor-mix" />;
      case "terms":
        return <TermsManager canManage={canEdit} />;
      case "caption-requests":
        return <CaptionRequestsManager />;
      case "caption-examples":
        return <CaptionExamplesManager canManage={canEdit} />;
      case "llm-models":
        return <LLMModelsManager canManage={canEdit} />;
      case "llm-providers":
        return <ConfigTab focusSection="llm-providers" />;
      case "prompt-chains":
        return <LLMPromptChainsManager />;
      case "llm-responses":
        return <LLMResponsesManager />;
      case "allowed-domains":
        return <ConfigTab focusSection="allowed-domains" />;
      case "whitelisted-emails":
        return <WhitelistManager canManage={canEdit} />;
      default:
        return null;
    }
  }

  return (
    <main
      className="min-h-screen bg-[#050912] text-white"
      style={{
        backgroundImage: [
          "radial-gradient(900px 520px at 18% -10%, rgba(90, 148, 204, 0.18), transparent 60%)",
          "radial-gradient(760px 460px at 82% 8%, rgba(78, 169, 106, 0.15), transparent 58%)",
          "linear-gradient(to bottom, rgba(148, 163, 184, 0.08) 1px, transparent 1px)",
          "linear-gradient(to right, rgba(148, 163, 184, 0.08) 1px, transparent 1px)",
        ].join(", "),
        backgroundSize: "auto, auto, 30px 30px, 30px 30px",
      }}
    >
      <button
        type="button"
        onClick={() => setSidebarOpen((open) => !open)}
        className="fixed left-4 top-4 z-50 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm font-medium text-white backdrop-blur lg:hidden"
      >
        {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        Menu
      </button>

      {sidebarOpen ? (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          aria-label="Close menu"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10 bg-[#0a0a0f] transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(145deg,rgba(255,255,255,0.18),rgba(255,255,255,0.04))] shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,255,255,0.28),transparent_42%),linear-gradient(135deg,rgba(90,148,204,0.95),rgba(78,169,106,0.9))]" />
              <ShieldCheck className="relative h-5 w-5 text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.35)]" />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">Admin</p>
              <p className="text-sm text-slate-400">{sidebarName(adminEmail) || "Administrator"}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5">
          {NAV_GROUPS.map((group) => (
            <section key={group.label} className="mb-7">
              <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                {group.label}
              </p>
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
                        selected
                          ? "bg-[linear-gradient(135deg,rgba(90,148,204,0.18),rgba(78,169,106,0.18))] text-[#e6f5ff] shadow-[inset_0_0_0_1px_rgba(120,211,191,0.32),0_12px_30px_rgba(4,18,31,0.22)]"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${selected ? "text-[#9ce9d6]" : "text-slate-500"}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <p className="mb-4 px-2 text-xs text-slate-500">Humor Admin Panel</p>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            <LogOut className="h-4 w-4 text-slate-500" />
            <span>{signingOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-72">
        <div className="w-full px-4 pb-10 pt-20 sm:px-8 lg:px-10 lg:pt-10 2xl:px-14">
          {renderActivePanel()}
        </div>
      </div>
    </main>
  );
}
