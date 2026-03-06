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

  let isSuperadmin = false;

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profileError && profileRow?.is_superadmin === true) {
    isSuperadmin = true;
  }

  // Fallback for deployments where profile reads are blocked by RLS in session context.
  if (!isSuperadmin && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const serviceClient = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: serviceProfileRow, error: serviceProfileError } = await serviceClient
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .maybeSingle();
    if (!serviceProfileError && serviceProfileRow?.is_superadmin === true) {
      isSuperadmin = true;
    }
  }

  if (!isSuperadmin) {
    redirect("/login?error=not_superadmin");
  }

  const userEmail = String(user.email || "").trim();
  return <AdminTabsShell stats={INITIAL_STATS} adminEmail={userEmail} />;
}
