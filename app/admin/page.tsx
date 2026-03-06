import { createClient } from "@supabase/supabase-js";
import { AdminTabsShell } from "../../components/admin/admin-tabs-shell";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../lib/supabase-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CaptionRow = {
  caption_text?: string | null;
  text?: string | null;
};

const TOPIC_KEYWORDS = [
  "columbia",
  "furnald",
  "blaer",
  "butler",
  "hamilton",
  "low",
  "lerner",
  "dodge",
];

function inferTopic(caption: CaptionRow): string | null {
  const body = (caption.caption_text ?? caption.text ?? "").toLowerCase();
  if (!body) return null;

  const found = TOPIC_KEYWORDS.find((keyword) => body.includes(keyword));
  return found ?? null;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getDashboardStats() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      totalImages: 0,
      mostActiveUser: "Unavailable",
      mostActiveCount: 0,
      topTopics: [] as Array<{ topic: string; count: number }>,
      error: "Missing Supabase environment variables.",
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let imagesRes: { count: number | null; error: { message?: string } | null };
  let captionsRes: { data: CaptionRow[] | null; error: { message?: string } | null };

  try {
    const [imagesData, captionsData] = await withTimeout(
      Promise.all([
        supabase.from("images").select("*", { count: "exact", head: true }),
        supabase.from("captions").select("caption_text, text").limit(6000),
      ]),
      12000,
      "admin stats query",
    );
    imagesRes = imagesData;
    captionsRes = captionsData as { data: CaptionRow[] | null; error: { message?: string } | null };
  } catch (error) {
    return {
      totalImages: 0,
      mostActiveUser: "Unavailable",
      mostActiveCount: 0,
      topTopics: [] as Array<{ topic: string; count: number }>,
      error: error instanceof Error ? error.message : "Failed to load stats.",
    };
  }

  if (imagesRes.error || captionsRes.error) {
    return {
      totalImages: imagesRes.count ?? 0,
      mostActiveUser: "Unavailable",
      mostActiveCount: 0,
      topTopics: [] as Array<{ topic: string; count: number }>,
      error: imagesRes.error?.message ?? captionsRes.error?.message ?? "Failed to load stats.",
    };
  }

  const captions = (captionsRes.data ?? []) as CaptionRow[];
  const totalImages = imagesRes.count ?? 0;

  const topicCounts = new Map<string, number>();

  for (const caption of captions) {
    const topic = inferTopic(caption);
    if (topic) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
  }

  const topTopics = Array.from(topicCounts.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalImages,
    mostActiveUser: "Calculated in Data tab",
    mostActiveCount: 0,
    topTopics,
    error: null as string | null,
  };
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();
  return <AdminTabsShell stats={stats} />;
}
