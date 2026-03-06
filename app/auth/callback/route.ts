import { createServerClient } from "@supabase/ssr";
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../../lib/supabase-config";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  const response = NextResponse.redirect(new URL("/admin", request.url));
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (!sessionError && sessionData.session) {
    return response;
  }

  return NextResponse.redirect(new URL("/login?error=signin_failed", request.url));
}
