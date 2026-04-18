import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config";
import { isAdminEmailAllowed } from "./admin-allowlist";
import {
  ADMIN_REMEMBER_SESSION_COOKIE,
  makeSessionScopedCookieOptions,
  shouldRememberAdminSession,
} from "./auth-session-preferences";

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

export async function handleAdminAuthCallback(request: Request) {
  const reqUrl = new URL(request.url);
  const origin = reqUrl.origin;
  const code = reqUrl.searchParams.get("code");
  const cookieStore = await cookies();
  const rememberSession = shouldRememberAdminSession(
    reqUrl.searchParams.get("remember") ?? cookieStore.get(ADMIN_REMEMBER_SESSION_COOKIE)?.value,
  );

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.redirect(`${origin}/login?error=missing_env`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  cookieStore.set(
    ADMIN_REMEMBER_SESSION_COOKIE,
    rememberSession ? "1" : "0",
    {
      path: "/",
      sameSite: "lax",
      ...(rememberSession ? { maxAge: 400 * 24 * 60 * 60 } : {}),
    } as any,
  );
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, (rememberSession ? options : makeSessionScopedCookieOptions(options)) as any);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=signin_failed`);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=signin_failed`);
  }

  const userEmail = String(user.email || "").trim();
  if (!(await isAdminEmailAllowed(userEmail))) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain_not_allowed`);
  }

  let isSuperadmin = await isSuperadminByUserId(supabase, String(user.id || "").trim());

  if (!isSuperadmin && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const serviceClient = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    isSuperadmin = await isSuperadminByUserId(serviceClient, String(user.id || "").trim());
  }

  if (!isSuperadmin) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_superadmin`);
  }

  return NextResponse.redirect(`${origin}/admin`);
}
