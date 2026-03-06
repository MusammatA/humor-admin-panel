import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../../lib/supabase-config";

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const origin = reqUrl.origin;
  const code = reqUrl.searchParams.get("code");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.redirect(`${origin}/login?error=missing_env`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
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

  let isSuperadmin = false;
  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profileError && profileRow?.is_superadmin === true) {
    isSuperadmin = true;
  }

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
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_superadmin`);
  }

  return NextResponse.redirect(`${origin}/admin`);
}
