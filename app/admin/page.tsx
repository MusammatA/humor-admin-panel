import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { AdminTabsShell } from "../../components/admin/admin-tabs-shell";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../lib/supabase-config";
import { isAllowlistedAdminEmail } from "../../lib/admin-auth";

const INITIAL_STATS = {
  totalImages: 0,
  mostActiveUser: "Unavailable",
  mostActiveCount: 0,
  topTopics: [] as Array<{ topic: string; count: number }>,
  error: null as string | null,
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function isSuperadminByUserId(client: any, userId: string): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await client
    .from("profiles")
    .select("id, is_superadmin")
    .eq("id", userId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data && data.is_superadmin === true && String(data.id || "").trim() === userId);
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
  if (!isAllowlistedAdminEmail(userEmail)) {
    redirect("/login?error=not_superadmin");
  }

  let isSuperadmin = await isSuperadminByUserId(supabase, String(user.id || "").trim());

  // Fallback for deployments where profile reads are blocked by RLS in session context.
  if (!isSuperadmin && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const serviceClient = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    isSuperadmin = await isSuperadminByUserId(serviceClient, String(user.id || "").trim());
  }

  if (!isSuperadmin) {
    redirect("/login?error=not_superadmin");
  }

  return <AdminTabsShell stats={INITIAL_STATS} adminEmail={userEmail} />;
}
