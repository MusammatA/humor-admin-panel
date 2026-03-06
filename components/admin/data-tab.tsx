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

export function DataTab({ stats }: DataTabProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [captions, setCaptions] = useState<Row[]>([]);
  const [images, setImages] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function fetchAllRows(table: string, pageSize: number, maxPages: number) {
    if (!supabase) return [] as Row[];
    const all: Row[] = [];
    for (let page = 0; page < maxPages; page += 1) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error: fetchError } = await supabase.from(table).select("*").range(from, to);
      if (fetchError) throw new Error(fetchError.message);
      const rows = (data ?? []) as Row[];
      if (!rows.length) break;
      all.push(...rows);
      if (rows.length < pageSize) break;
    }
    return all;
  }

  async function load() {
    if (!supabase) return;
    try {
      const [captionRows, imageRows] = await Promise.all([
        fetchAllRows("captions", 2000, 200),
        fetchAllRows("images", 1000, 120),
      ]);
      setCaptions(captionRows);
      setImages(imageRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const topWords = useMemo(() => {
    const wordCounts = new Map<string, number>();
    for (const row of captions) {
      const text = captionText(row).toLowerCase();
      if (!text) continue;
      for (const token of text.split(/[^a-z0-9]+/)) {
        if (!token || token.length < 3 || STOPWORDS.has(token)) continue;
        wordCounts.set(token, (wordCounts.get(token) ?? 0) + 1);
      }
    }
    return topCounts(wordCounts, 20);
  }, [captions]);

  const packedWords = useMemo(() => packBubbles(topWords), [topWords]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Data</h1>
        <p className="mt-2 text-sm text-slate-600">
          Top 20 caption words by frequency across all loaded caption rows.
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
    </section>
  );
}
