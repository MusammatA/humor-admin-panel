import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { AdminTabsShell } from "../../components/admin/admin-tabs-shell";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../lib/supabase-config";

const INITIAL_STATS = {
  totalImages: 0,
  mostActiveUser: "Unavailable",
  mostActiveCount: 0,
  topTopics: [] as Array<{ topic: string; count: number }>,
  error: null as string | null,
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function readAdminAllowlist(): Set<string> {
  const raw = String(process.env.ADMIN_ALLOWED_EMAILS || "");
  return new Set(
    raw
      .split(",")
      .map((item) => normalizeEmail(item))
      .filter(Boolean),
  );
}

function isEmailInAllowlist(email: string): boolean {
  const allowlist = readAdminAllowlist();
  if (!allowlist.size) return true;
  return allowlist.has(normalizeEmail(email));
}

async function isSuperadminByEmail(client: any, userEmail: string): Promise<boolean> {
  const normalized = normalizeEmail(userEmail);
  if (!normalized) return false;
  const candidates = Array.from(new Set([userEmail, normalized].filter(Boolean)));
  for (const candidate of candidates) {
    const { data, error } = await client
      .from("profiles")
      .select("email, is_superadmin")
      .eq("email", candidate)
      .limit(10);
    if (error || !Array.isArray(data)) continue;
    const match = data.some((row: { email?: unknown; is_superadmin?: unknown }) => {
      return normalizeEmail(row?.email) === normalized && row?.is_superadmin === true;
    });
    if (match) return true;
  }
  return false;
}

export default async function AdminDashboardPage() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    redirect("/login?error=missing_env");
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options as any);
        });
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const userEmail = String(user.email || "").trim();
  if (!isEmailInAllowlist(userEmail)) {
    redirect("/login?error=not_superadmin");
  }

  let isSuperadmin = await isSuperadminByEmail(supabase, userEmail);

  // Fallback for deployments where profile reads are blocked by RLS in session context.
  if (!isSuperadmin && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const serviceClient = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    isSuperadmin = await isSuperadminByEmail(serviceClient, userEmail);
  }

  if (!isSuperadmin) {
    redirect("/login?error=not_superadmin");
  }

  return <AdminTabsShell stats={INITIAL_STATS} adminEmail={userEmail} />;
}
