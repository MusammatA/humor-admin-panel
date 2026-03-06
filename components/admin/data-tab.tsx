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
  const [votes, setVotes] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!supabase) return;
    const [captionsRes, imagesRes, profilesRes, votesRes] = await Promise.all([
      supabase.from("captions").select("*").limit(10000),
      supabase.from("images").select("*").limit(5000),
      supabase.from("profiles").select("id,full_name,username,email").limit(5000),
      supabase.from("caption_votes").select("*").limit(30000),
    ]);
    const firstError = captionsRes.error || imagesRes.error || profilesRes.error || votesRes.error;
    if (firstError) {
      setError(firstError.message);
      return;
    }
    setCaptions((captionsRes.data ?? []) as Row[]);
    setImages((imagesRes.data ?? []) as Row[]);
    setProfiles((profilesRes.data ?? []) as Row[]);
    setVotes((votesRes.data ?? []) as Row[]);
  }

  useEffect(() => {
    load();
  }, []);

  const bubbleGroups = useMemo(() => {
    const wordCounts = new Map<string, number>();
    const imageCaptionCounts = new Map<string, number>();
    const imageVoteScore = new Map<string, number>();
    const imageVoteCount = new Map<string, number>();
    const userCaptionCounts = new Map<string, number>();
    const userVoteCounts = new Map<string, number>();

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
        imageCaptionCounts.set(imageId, (imageCaptionCounts.get(imageId) ?? 0) + 1);
      }

      const userId = str(row, ["user_id"]);
      if (userId) {
        userCaptionCounts.set(userId, (userCaptionCounts.get(userId) ?? 0) + 1);
      }
    }

    const captionToImage = new Map<string, string>();
    for (const row of captions) {
      const captionId = str(row, ["id", "caption_id"]);
      const imageId = str(row, ["image_id"]);
      if (captionId && imageId) {
        captionToImage.set(captionId, imageId);
      }
    }

    for (const vote of votes) {
      const captionId = str(vote, ["caption_id"]);
      const imageId = captionToImage.get(captionId);
      const value = Number(vote["vote_value"] ?? vote["value"] ?? 0);
      const profileId = str(vote, ["profile_id", "user_id"]);
      if (profileId) {
        userVoteCounts.set(profileId, (userVoteCounts.get(profileId) ?? 0) + 1);
      }
      if (imageId) {
        imageVoteCount.set(imageId, (imageVoteCount.get(imageId) ?? 0) + 1);
        imageVoteScore.set(imageId, (imageVoteScore.get(imageId) ?? 0) + value);
      }
    }

    const topWords = bubbleDataFromCounts(wordCounts, "word");
    const imagePopularity = new Map<string, number>();
    for (const row of images) {
      const imageId = str(row, ["id"]);
      if (!imageId) continue;
      const captionCount = imageCaptionCounts.get(imageId) ?? 0;
      const votesCount = imageVoteCount.get(imageId) ?? 0;
      const voteScore = imageVoteScore.get(imageId) ?? 0;
      const popularity = captionCount * 2 + votesCount + Math.max(voteScore, 0);
      if (popularity > 0) imagePopularity.set(imageId, popularity);
    }
    const topImages = bubbleDataFromCounts(imagePopularity, "image");

    const userActivity = new Map<string, number>();
    for (const [userId, count] of userCaptionCounts.entries()) {
      userActivity.set(userId, (userActivity.get(userId) ?? 0) + count * 2);
    }
    for (const [userId, count] of userVoteCounts.entries()) {
      userActivity.set(userId, (userActivity.get(userId) ?? 0) + count);
    }
    const userActivityLabeled = new Map<string, number>();
    for (const [userId, score] of userActivity.entries()) {
      const label = userLabelById.get(userId) ?? `User ${userId.slice(0, 8)}`;
      userActivityLabeled.set(label, (userActivityLabeled.get(label) ?? 0) + score);
    }
    const topUsers = bubbleDataFromCounts(userActivityLabeled, "user");
    return { topWords, topImages, topUsers };
  }, [captions, profiles, images, votes]);

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
