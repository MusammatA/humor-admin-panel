import { createClient } from "@supabase/supabase-js";
import { AdminTabsShell } from "../../components/admin/admin-tabs-shell";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../lib/supabase-config";

type CaptionRow = {
  user_id: string | null;
  topic?: string | null;
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
  const explicit = caption.topic?.trim().toLowerCase();
  if (explicit) return explicit;

  const body = (caption.caption_text ?? caption.text ?? "").toLowerCase();
  if (!body) return null;

  const found = TOPIC_KEYWORDS.find((keyword) => body.includes(keyword));
  return found ?? null;
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

  const [imagesRes, captionsRes] = await Promise.all([
    supabase.from("images").select("*", { count: "exact", head: true }),
    supabase.from("captions").select("user_id, topic, caption_text, text"),
  ]);

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

  const userCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();

  for (const caption of captions) {
    if (caption.user_id) {
      userCounts.set(caption.user_id, (userCounts.get(caption.user_id) ?? 0) + 1);
    }

    const topic = inferTopic(caption);
    if (topic) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
  }

  let topUserId: string | null = null;
  let mostActiveCount = 0;
  for (const [userId, count] of userCounts.entries()) {
    if (count > mostActiveCount) {
      topUserId = userId;
      mostActiveCount = count;
    }
  }

  let mostActiveUser = "No captions yet";
  if (topUserId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, full_name, email")
      .eq("id", topUserId)
      .maybeSingle();

    mostActiveUser =
      profile?.username ?? profile?.full_name ?? profile?.email ?? `${topUserId.slice(0, 8)}...`;
  }

  const topTopics = Array.from(topicCounts.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalImages,
    mostActiveUser,
    mostActiveCount,
    topTopics,
    error: null as string | null,
  };
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();
  return <AdminTabsShell stats={stats} />;
}
