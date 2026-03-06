"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";
import { StatCard } from "../stat-card";
import { BarChart3, ImageIcon, Type, UserRound } from "lucide-react";

type Row = Record<string, unknown>;

type DataTabProps = {
  stats: {
    totalImages: number;
    mostActiveUser: string;
    mostActiveCount: number;
    topTopics: Array<{ topic: string; count: number }>;
    error: string | null;
  };
};

function str(row: Row, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function captionText(row: Row) {
  return str(row, ["caption_text", "text", "content", "caption"]);
}

function bubbleDataFromCounts(
  counts: Map<string, number>,
  category: "word" | "image" | "user",
  top = 14
) {
  return Array.from(counts.entries())
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([label, value]) => ({ label, value, category }));
}

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "is",
  "it",
  "this",
  "that",
  "with",
  "at",
  "be",
  "are",
  "was",
  "you",
  "we",
  "they",
  "i",
  "me",
  "my",
  "our",
]);

export function DataTab({ stats }: DataTabProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [captions, setCaptions] = useState<Row[]>([]);
  const [images, setImages] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!supabase) return;
    const [captionsRes, imagesRes, profilesRes] = await Promise.all([
      supabase.from("captions").select("*").limit(10000),
      supabase.from("images").select("*").limit(5000),
      supabase.from("profiles").select("id,full_name,username,email").limit(5000),
    ]);
    const firstError = captionsRes.error || imagesRes.error || profilesRes.error;
    if (firstError) {
      setError(firstError.message);
      return;
    }
    setCaptions((captionsRes.data ?? []) as Row[]);
    setImages((imagesRes.data ?? []) as Row[]);
    setProfiles((profilesRes.data ?? []) as Row[]);
  }

  useEffect(() => {
    load();
  }, []);

  const bubbleGroups = useMemo(() => {
    const wordCounts = new Map<string, number>();
    const imageCounts = new Map<string, number>();
    const userCounts = new Map<string, number>();

    const userLabelById = new Map<string, string>();
    for (const row of profiles) {
      const id = str(row, ["id"]);
      if (!id) continue;
      const label =
        str(row, ["full_name"]) ||
        str(row, ["username"]) ||
        str(row, ["email"]) ||
        `User ${id.slice(0, 8)}`;
      userLabelById.set(id, label);
    }

    for (const row of captions) {
      const text = captionText(row).toLowerCase();
      for (const token of text.split(/[^a-z0-9]+/)) {
        if (!token || token.length < 3 || STOPWORDS.has(token)) continue;
        wordCounts.set(token, (wordCounts.get(token) ?? 0) + 1);
      }

      const imageId = str(row, ["image_id"]);
      if (imageId) {
        imageCounts.set(imageId, (imageCounts.get(imageId) ?? 0) + 1);
      }

      const userId = str(row, ["user_id"]);
      if (userId) {
        const label = userLabelById.get(userId) ?? `User ${userId.slice(0, 8)}`;
        userCounts.set(label, (userCounts.get(label) ?? 0) + 1);
      }
    }

    const topWords = bubbleDataFromCounts(wordCounts, "word");
    const topImages = bubbleDataFromCounts(imageCounts, "image");
    const topUsers = bubbleDataFromCounts(userCounts, "user");
    return { topWords, topImages, topUsers };
  }, [captions, profiles]);

  function BubblePanel({
    title,
    colorClass,
    items,
  }: {
    title: string;
    colorClass: string;
    items: Array<{ label: string; value: number; category: string }>;
  }) {
    const max = Math.max(...items.map((x) => x.value), 1);
    return (
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">No data available yet.</p>
          ) : (
            items.map((item) => {
              const size = 54 + Math.round((item.value / max) * 90);
              return (
                <div
                  key={`${title}-${item.label}`}
                  className={`flex items-center justify-center rounded-full border border-slate-300 text-center ${colorClass}`}
                  style={{ width: size, height: size }}
                  title={`${item.label}: ${item.value}`}
                >
                  <div className="max-w-[88%] text-[11px] font-semibold leading-tight">
                    <div className="truncate">{item.label}</div>
                    <div className="text-[10px] opacity-80">{item.value}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </article>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Data</h1>
        <p className="mt-2 text-sm text-slate-600">
          Programmatic bubble visuals for popular words, image activity, and active users.
        </p>
        {error || stats.error ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {error || stats.error}
          </p>
        ) : null}
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Images"
          value={stats.totalImages.toLocaleString()}
          subtitle={`${images.length.toLocaleString()} loaded in visualizer`}
          icon={ImageIcon}
        />
        <StatCard
          title="Most Active User"
          value={stats.mostActiveUser}
          subtitle={`${stats.mostActiveCount.toLocaleString()} captions`}
          icon={UserRound}
        />
        <StatCard
          title="Top Topic"
          value={stats.topTopics[0]?.topic ?? "N/A"}
          subtitle={stats.topTopics[0] ? `${stats.topTopics[0].count} mentions` : "No topic data"}
          icon={Type}
        />
        <StatCard
          title="Loaded Captions"
          value={captions.length.toLocaleString()}
          subtitle="Used in bubble analysis"
          icon={BarChart3}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <BubblePanel title="Popular Words" colorClass="bg-blue-50" items={bubbleGroups.topWords} />
        <BubblePanel title="Popular Images" colorClass="bg-emerald-50" items={bubbleGroups.topImages} />
        <BubblePanel title="Active Users" colorClass="bg-amber-50" items={bubbleGroups.topUsers} />
      </section>
    </section>
  );
}
