"use client";

import { BarChart3, ImageIcon, Menu, Search, Sparkles, Type, UserRound, X } from "lucide-react";
import { type ComponentType, useMemo, useState } from "react";
import { CaptionsManager } from "./captions-manager";
import { StorageGrid } from "./storage-grid";
import { UserActivityManager } from "./user-activity-manager";
import { StatCard } from "../stat-card";

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

type AdminTab = "visuals" | "users" | "captions" | "images";

const TAB_ITEMS: Array<{ id: AdminTab; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: "visuals", label: "Data Visuals", icon: BarChart3 },
  { id: "users", label: "Search Users", icon: Search },
  { id: "captions", label: "Captions", icon: Type },
  { id: "images", label: "Images", icon: ImageIcon },
];

export function AdminTabsShell({ stats }: AdminTabsShellProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("visuals");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const maxTopicCount = useMemo(
    () => Math.max(...stats.topTopics.map((item) => item.count), 1),
    [stats.topTopics]
  );

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
        <h2 className="text-lg font-semibold text-slate-900">Admin Sections</h2>
        <p className="mt-1 text-xs text-slate-500">Open a tab to inspect and manage project data.</p>
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
                  selected
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
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
        {activeTab === "visuals" ? (
          <section className="space-y-6">
            <header>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Data Visuals</h1>
              <p className="mt-2 text-sm text-slate-600">
                Snapshot of uploads, user activity, and caption-topic distribution.
              </p>
              {stats.error ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {stats.error}
                </p>
              ) : null}
            </header>

            <section className="grid gap-4 md:grid-cols-3">
              <StatCard
                title="Total Images Uploaded"
                value={stats.totalImages.toLocaleString()}
                subtitle="All-time uploads"
                icon={ImageIcon}
              />
              <StatCard
                title="Most Active User"
                value={stats.mostActiveUser}
                subtitle={`${stats.mostActiveCount.toLocaleString()} captions`}
                icon={UserRound}
              />
              <StatCard
                title="Top Caption Topic"
                value={stats.topTopics[0]?.topic ?? "No topic data"}
                subtitle={
                  stats.topTopics[0]
                    ? `${stats.topTopics[0].count.toLocaleString()} mentions`
                    : "No captions matched known topics"
                }
                icon={Sparkles}
              />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Topic Distribution</h2>
              <p className="mt-1 text-sm text-slate-600">
                Bar visualization of top caption topics.
              </p>
              <ul className="mt-4 space-y-3">
                {stats.topTopics.length === 0 ? (
                  <li className="text-sm text-slate-500">No topic matches yet.</li>
                ) : (
                  stats.topTopics.map((item) => (
                    <li key={item.topic} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800">{item.topic}</span>
                        <span className="text-slate-600">{item.count.toLocaleString()}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded bg-slate-200">
                        <div
                          className="h-full rounded bg-slate-800"
                          style={{ width: `${(item.count / maxTopicCount) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </section>
        ) : null}

        {activeTab === "users" ? <UserActivityManager /> : null}
        {activeTab === "captions" ? <CaptionsManager /> : null}
        {activeTab === "images" ? <StorageGrid bucketName="images" /> : null}
      </div>
    </main>
  );
}
