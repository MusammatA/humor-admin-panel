"use client";

import { BarChart3, Menu, PlusSquare, Search, UserRound, X } from "lucide-react";
import { type ComponentType, useState } from "react";
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
  adminEmail?: string;
};

type AdminTab = "create" | "data" | "users" | "account";

const TAB_ITEMS: Array<{ id: AdminTab; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: "create", label: "Create", icon: PlusSquare },
  { id: "data", label: "Data", icon: BarChart3 },
  { id: "users", label: "Search Users", icon: Search },
  { id: "account", label: "Account", icon: UserRound },
];

export function AdminTabsShell({ stats, adminEmail = "" }: AdminTabsShellProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("data");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const canEdit = true;

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
        <h2 className="text-lg font-semibold text-slate-900">Admin Dashboard</h2>
        <p className="mt-1 text-xs text-slate-500">Superadmin-only workspace.</p>

        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {`Role: Superadmin Editor (${adminEmail || "signed in"})`}
        </div>

        <nav className="mt-4 space-y-2">
          {TAB_ITEMS.map((item) => {
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
        {activeTab === "create" ? <CreateTab isAdmin={canEdit} /> : null}
        {activeTab === "data" ? <DataTab stats={stats} canViewUserData={canEdit} /> : null}
        {activeTab === "users" ? <UserActivityManager canViewSensitive={canEdit} canMutate={canEdit} /> : null}
        {activeTab === "account" ? <AccountTab /> : null}
      </div>
    </main>
  );
}
