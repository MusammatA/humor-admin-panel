import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../../lib/supabase-config";
import { isAdminEmailAllowed } from "../../../lib/admin-allowlist";

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

export async function GET() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { authenticated: false, isSuperadmin: false, email: "", error: "Missing Supabase environment variables." },
      { status: 200 },
    );
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
    return NextResponse.json({ authenticated: false, isSuperadmin: false, email: "" }, { status: 200 });
  }

  const userEmail = String(user.email || "").trim();
  if (!(await isAdminEmailAllowed(userEmail))) {
    return NextResponse.json({ authenticated: true, isSuperadmin: false, email: userEmail }, { status: 200 });
  }

  let isSuperadmin = await isSuperadminByUserId(supabase, String(user.id || "").trim());

  // Fallback where session profile reads are blocked by strict RLS.
  if (!isSuperadmin && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const serviceClient = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    isSuperadmin = await isSuperadminByUserId(serviceClient, String(user.id || "").trim());
  }

  const response = NextResponse.json(
    {
      authenticated: true,
      isSuperadmin,
      email: userEmail,
    },
    { status: 200 },
  );
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
