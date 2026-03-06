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
  canViewUserData?: boolean;
};

type BubbleItem = {
  label: string;
  value: number;
};

type PackedBubble = BubbleItem & {
  r: number;
  x: number;
  y: number;
  color: string;
};

const WORD_COLORS = ["#1f77b4", "#ff7f0e", "#e84a5f", "#2a9d8f", "#6c5ce7", "#43aa8b"];

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
  "were",
  "you",
  "we",
  "they",
  "i",
  "me",
  "my",
  "our",
  "your",
  "their",
  "as",
  "from",
  "by",
  "about",
  "if",
  "but",
  "so",
  "just",
  "its",
]);

const COMMON_NON_SUBJECT_WORDS = new Set([
  "like",
  "look",
  "when",
  "what",
  "how",
  "why",
  "where",
  "there",
  "here",
  "then",
  "than",
  "into",
  "about",
  "really",
  "very",
  "also",
  "just",
  "dont",
  "cant",
  "wont",
  "got",
  "get",
  "gotta",
  "make",
  "made",
  "much",
  "many",
  "some",
  "more",
  "most",
  "good",
  "bad",
]);

const SUBJECT_ALIASES: Record<string, string> = {
  columbia: "columbia",
  barnard: "barnard",
  butler: "butler",
  lerner: "lerner",
  furnald: "furnald",
  hamilton: "hamilton",
  dodge: "dodge",
  low: "low",
  campus: "campus",
  dorm: "dorm",
  dorms: "dorm",
  final: "finals",
  finals: "finals",
  midterm: "midterms",
  midterms: "midterms",
  class: "class",
  classes: "class",
  lecture: "lecture",
  lectures: "lecture",
  homework: "homework",
  professor: "professor",
  professors: "professor",
  ta: "ta",
  exam: "exam",
  exams: "exam",
  war: "war",
  politics: "politics",
  political: "politics",
  election: "election",
  elections: "election",
  government: "government",
  economy: "economy",
  economics: "economics",
  finance: "finance",
  business: "business",
  ai: "ai",
  ml: "ai",
  cs: "computer-science",
  computerscience: "computer-science",
  engineering: "engineering",
  math: "math",
  physics: "physics",
  chemistry: "chemistry",
  biology: "biology",
  history: "history",
  english: "english",
  literature: "literature",
  art: "art",
  music: "music",
};

function str(row: Row, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function captionText(row: Row) {
  return str(row, ["caption_text", "text", "content", "caption", "generated_caption", "meme_text", "output"]);
}

function getImageUploaderId(row: Row) {
  return str(row, ["user_id", "uploader_user_id", "uploaded_by_user_id", "created_by_user_id", "profile_id"]);
}

function getVoteUserId(row: Row) {
  return str(row, ["profile_id", "user_id", "voter_user_id"]);
}

function getProfileId(row: Row) {
  return str(row, ["id"]);
}

function getProfileLabel(row: Row) {
  return (
    str(row, ["full_name"]) ||
    str(row, ["username"]) ||
    str(row, ["email"]) ||
    `User ${getProfileId(row).slice(0, 8)}`
  );
}

function parseUserIdFromImageUrl(url: string) {
  if (!url) return "";
  try {
    const u = new URL(url);
    const first = u.pathname.split("/").filter(Boolean)[0] ?? "";
    return first;
  } catch {
    const match = String(url).match(/almostcrackd\.ai\/([^/]+)\//i);
    return match?.[1] ?? "";
  }
}

function getCaptionUploaderId(row: Row) {
  return str(row, [
    "uploader_user_id",
    "uploaded_by_user_id",
    "created_by_user_id",
    "user_id",
    "profile_id",
  ]);
}

function getCaptionImageId(row: Row) {
  return str(row, ["image_id", "imageId", "img_id", "image_uuid"]);
}

function getAnyImageUrl(row: Row) {
  return str(row, ["image_url", "public_url", "cdn_url", "url"]);
}

function topCounts(counts: Map<string, number>, top = 20): BubbleItem[] {
  return Array.from(counts.entries())
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([label, value]) => ({ label, value }));
}

function truncateLabel(label: string, max = 14) {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}...`;
}

function packBubbles(items: BubbleItem[], width = 860, height = 620): PackedBubble[] {
  if (!items.length) return [];
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  const minR = 28;
  const maxR = 110;

  const nodes: PackedBubble[] = items.map((item, idx) => {
    const scale = item.value / maxValue;
    const r = minR + scale * (maxR - minR);
    const angle = idx * 0.9;
    const distance = 28 * idx;
    return {
      ...item,
      r,
      x: width / 2 + Math.cos(angle) * distance,
      y: height / 2 + Math.sin(angle) * distance,
      color: WORD_COLORS[idx % WORD_COLORS.length],
    };
  });

  for (let step = 0; step < 240; step += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const minDist = a.r + b.r + 2;
        if (dist < minDist) {
          const overlap = (minDist - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          a.x -= ux * overlap;
          a.y -= uy * overlap;
          b.x += ux * overlap;
          b.y += uy * overlap;
        }
      }
    }

    for (const node of nodes) {
      node.x += (width / 2 - node.x) * 0.02;
      node.y += (height / 2 - node.y) * 0.02;
      node.x = Math.max(node.r, Math.min(width - node.r, node.x));
      node.y = Math.max(node.r, Math.min(height - node.r, node.y));
    }
  }

  return nodes;
}

export function DataTab({ stats, canViewUserData = false }: DataTabProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [captions, setCaptions] = useState<Row[]>([]);
  const [images, setImages] = useState<Row[]>([]);
  const [votes, setVotes] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingLabel, setLoadingLabel] = useState("Idle");

  async function fetchAllRows(table: string, pageSize: number, maxPages: number, maxRows: number) {
    if (!supabase) return [] as Row[];
    const all: Row[] = [];
    for (let page = 0; page < maxPages; page += 1) {
      if (all.length >= maxRows) break;
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error: fetchError } = await supabase.from(table).select("*").range(from, to);
      if (fetchError) throw new Error(fetchError.message);
      const rows = (data ?? []) as Row[];
      if (!rows.length) break;
      all.push(...rows);
      if (rows.length < pageSize) break;
    }
    return all.slice(0, maxRows);
  }

  async function load() {
    if (!supabase) return;
    setLoading(true);
    setLoadingProgress(0);
    setLoadingLabel("Starting data load...");
    try {
      let completed = 0;
      const total = 4;
      const markDone = (nextLabel: string) => {
        completed += 1;
        setLoadingProgress(Math.round((completed / total) * 100));
        setLoadingLabel(nextLabel);
      };

      setLoadingLabel("Loading captions...");
      const captionsPromise = fetchAllRows("captions", 1000, 25, 25000).then((rows) => {
        markDone("Captions loaded. Loading images...");
        return rows;
      });

      const imagesPromise = fetchAllRows("images", 1000, 10, 10000).then((rows) => {
        markDone("Images loaded. Loading votes...");
        return rows;
      });

      const votesPromise = fetchAllRows("caption_votes", 1000, 20, 20000).then((rows) => {
        markDone("Votes loaded. Loading profiles...");
        return rows;
      });

      const profilesPromise = fetchAllRows("profiles", 1000, 5, 5000).then((rows) => {
        markDone("Profiles loaded.");
        return rows;
      });

      const [captionRows, imageRows, voteRows, profileRows] = await Promise.all([
        captionsPromise,
        imagesPromise,
        votesPromise,
        profilesPromise,
      ]);
      setCaptions(captionRows);
      setImages(imageRows);
      setVotes(voteRows);
      setProfiles(profileRows);
      setError(null);
      setLoadingProgress(100);
      setLoadingLabel("Data ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
      setLoadingLabel("Load failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const topWords = useMemo(() => {
    const subjectCounts = new Map<string, number>();
    const fallbackCounts = new Map<string, number>();
    for (const row of captions) {
      const text = captionText(row).toLowerCase();
      if (!text) continue;
      for (const token of text.split(/[^a-z0-9]+/)) {
        if (!token || STOPWORDS.has(token) || COMMON_NON_SUBJECT_WORDS.has(token)) continue;
        const subjectWord = SUBJECT_ALIASES[token];
        if (subjectWord) {
          subjectCounts.set(subjectWord, (subjectCounts.get(subjectWord) ?? 0) + 1);
          continue;
        }
        if (token.length < 5) continue;
        fallbackCounts.set(token, (fallbackCounts.get(token) ?? 0) + 1);
      }
    }
    const topSubjects = topCounts(subjectCounts, 20);
    if (topSubjects.length >= 8) return topSubjects;
    const filteredFallback = new Map(
      Array.from(fallbackCounts.entries()).filter(([, count]) => count >= 3),
    );
    return topCounts(filteredFallback, 20);
  }, [captions]);

  const packedWords = useMemo(() => packBubbles(topWords), [topWords]);
  const topThreeTopics = topWords.slice(0, 3);
  const topTopicLabel = topThreeTopics[0]?.label ?? "N/A";
  const topTopicCount = topThreeTopics[0]?.value ?? 0;

  const topActiveUsers = useMemo(() => {
    const imageIdsByUser = new Map<string, Set<string>>();
    const votesByUser = new Map<string, number>();
    const labelByUser = new Map<string, string>();
    const imageUserById = new Map<string, string>();

    for (const profile of profiles) {
      const id = getProfileId(profile);
      if (!id) continue;
      labelByUser.set(id, getProfileLabel(profile));
    }

    for (const image of images) {
      const userId = getImageUploaderId(image) || parseUserIdFromImageUrl(getAnyImageUrl(image));
      const imageId = str(image, ["id", "image_id"]);
      if (!userId) continue;
      if (imageId) imageUserById.set(imageId, userId);
      if (!imageIdsByUser.has(userId)) imageIdsByUser.set(userId, new Set());
      if (imageId) imageIdsByUser.get(userId)!.add(imageId);
      if (!labelByUser.has(userId)) {
        labelByUser.set(userId, `User ${userId.slice(0, 8)}`);
      }
    }

    for (const caption of captions) {
      const imageId = getCaptionImageId(caption);
      const captionUserId = getCaptionUploaderId(caption) || parseUserIdFromImageUrl(getAnyImageUrl(caption));
      const userId = captionUserId || (imageId ? imageUserById.get(imageId) ?? "" : "");
      if (!userId) continue;
      if (!imageIdsByUser.has(userId)) imageIdsByUser.set(userId, new Set());
      if (imageId) imageIdsByUser.get(userId)!.add(imageId);
      if (!labelByUser.has(userId)) {
        labelByUser.set(userId, `User ${userId.slice(0, 8)}`);
      }
      if (imageId && !imageUserById.has(imageId)) {
        imageUserById.set(imageId, userId);
      }
    }

    for (const vote of votes) {
      const userId = getVoteUserId(vote);
      if (!userId) continue;
      votesByUser.set(userId, (votesByUser.get(userId) ?? 0) + 1);
      if (!labelByUser.has(userId)) {
        labelByUser.set(userId, `User ${userId.slice(0, 8)}`);
      }
    }

    const userIds = new Set([...imageIdsByUser.keys(), ...votesByUser.keys()]);
    const ranked = Array.from(userIds)
      .map((userId) => {
        const uploads = imageIdsByUser.get(userId)?.size ?? 0;
        const voteCount = votesByUser.get(userId) ?? 0;
        return {
          userId,
          label: labelByUser.get(userId) ?? `User ${userId.slice(0, 8)}`,
          uploads,
          votes: voteCount,
          total: uploads + voteCount,
        };
      })
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.total - a.total || b.uploads - a.uploads || b.votes - a.votes)
      .slice(0, 10);

    return ranked;
  }, [images, votes, profiles]);

  const activeLeader = topActiveUsers[0];
  const maskedLeaderLabel = canViewUserData ? (activeLeader?.label ?? stats.mostActiveUser) : "Unavailable";
  const maskedLeaderSubtitle = canViewUserData
    ? activeLeader
      ? `${activeLeader.uploads} uploads + ${activeLeader.votes} votes`
      : `${stats.mostActiveCount.toLocaleString()} captions`
    : "View users by signing in as admin";

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Data</h1>
        <p className="mt-2 text-sm text-slate-600">
          Top 20 caption words by frequency across all loaded caption rows.
        </p>
        {loading ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
              <span>{loadingLabel}</span>
              <span>{loadingProgress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-900 transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          </div>
        ) : null}
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
          value={maskedLeaderLabel}
          subtitle={maskedLeaderSubtitle}
          icon={UserRound}
        />
        <StatCard
          title="Top Topic"
          value={topTopicLabel}
          subtitle={topTopicCount > 0 ? `${topTopicCount} mentions` : "No topic data"}
          icon={Type}
        />
        <StatCard
          title="Loaded Captions"
          value={captions.length.toLocaleString()}
          subtitle="Used in word frequency analysis"
          icon={BarChart3}
        />
      </section>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Most Popular Caption Words (Top 20)</h3>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        {packedWords.length === 0 ? (
          <p className="text-sm text-slate-500">No caption words available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <svg viewBox="0 0 860 620" className="h-[620px] w-full rounded-lg bg-slate-50">
              {packedWords.map((node, idx) => (
                <g key={`${node.label}-${idx}`}>
                  <circle cx={node.x} cy={node.y} r={node.r} fill={node.color} opacity={0.9} />
                  <text
                    x={node.x}
                    y={node.y - 4}
                    textAnchor="middle"
                    fontSize={node.r > 70 ? 16 : node.r > 48 ? 13 : 11}
                    fill="white"
                    fontWeight="700"
                  >
                    {truncateLabel(node.label, node.r > 60 ? 14 : 10)}
                  </text>
                  <text
                    x={node.x}
                    y={node.y + 14}
                    textAnchor="middle"
                    fontSize={node.r > 70 ? 13 : 11}
                    fill="white"
                    opacity={0.95}
                  >
                    {node.value.toLocaleString()}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Top 3 Topics From Bubble Graph</h3>
        {topThreeTopics.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No topic words available yet.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {topThreeTopics.map((topic, index) => (
              <div
                key={`${topic.label}-${index}`}
                className={`rounded-full border px-3 py-1 text-sm ${
                  index === 0
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-slate-300 bg-slate-50 text-slate-700"
                }`}
              >
                #{index + 1} {topic.label} ({topic.value})
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Top 10 Most Active Users (Uploads + Votes)</h3>
        <p className="mt-1 text-sm text-slate-600">
          Ranked by combined count of images uploaded and votes submitted.
        </p>

        {!canViewUserData ? (
          <p className="mt-3 text-sm text-slate-500">Unavailable. View users by signing in as admin.</p>
        ) : topActiveUsers.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No user activity found yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {topActiveUsers.map((user, index) => (
              <div
                key={user.userId}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  index === 0
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                <span className="font-semibold">#{index + 1} {user.label}</span>
                <span className="ml-2">Total: {user.total}</span>
                <span className="ml-2">Uploads: {user.uploads}</span>
                <span className="ml-2">Votes: {user.votes}</span>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
