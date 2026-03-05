import { ImageIcon, Sparkles, UserRound } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { StatCard } from "../../components/stat-card";
import { CaptionsManager } from "../../components/admin/captions-manager";
import { StorageGrid } from "../../components/admin/storage-grid";
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

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Interesting Statistics
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Admin snapshot of uploads, creator activity, and caption trends.
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
          <h2 className="text-lg font-semibold text-slate-900">Popular Caption Topics</h2>
          <p className="mt-1 text-sm text-slate-600">
            Ranked by mention count (examples: Columbia, Furnald, Blaer).
          </p>
          <ul className="mt-4 space-y-3">
            {stats.topTopics.length === 0 ? (
              <li className="text-sm text-slate-500">No topic matches yet.</li>
            ) : (
              stats.topTopics.map((item, index) => (
                <li
                  key={item.topic}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                >
                  <span className="font-medium text-slate-800">
                    {index + 1}. {item.topic}
                  </span>
                  <span className="rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                    {item.count.toLocaleString()} captions
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>

        <CaptionsManager />
        <StorageGrid bucketName="images" />
      </div>
    </main>
  );
}
