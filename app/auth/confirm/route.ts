import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
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

  return NextResponse.redirect(`${origin}/admin`);
}
