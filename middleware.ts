import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./lib/supabase-config";

function hasSuperadminById(row: { id?: unknown; is_superadmin?: unknown } | null, expectedId: string): boolean {
  if (!row) return false;
  return String(row.id || "").trim() === expectedId && row.is_superadmin === true;
}

export async function middleware(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.redirect(new URL("/login?error=missing_env", req.url));
  }

  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options as any);
        });
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const userId = String(user.id || "").trim();
  let isSuperadmin = false;

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("id, is_superadmin")
    .eq("id", userId)
    .maybeSingle();
  if (!profileError && hasSuperadminById(profileRow as { id?: unknown; is_superadmin?: unknown } | null, userId)) {
    isSuperadmin = true;
  }

  if (!isSuperadmin && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const serviceClient = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: serviceProfileRow, error: serviceProfileError } = await serviceClient
      .from("profiles")
      .select("id, is_superadmin")
      .eq("id", userId)
      .maybeSingle();
    if (
      !serviceProfileError &&
      hasSuperadminById(serviceProfileRow as { id?: unknown; is_superadmin?: unknown } | null, userId)
    ) {
      isSuperadmin = true;
    }
  }

  if (!isSuperadmin) {
    const denied = NextResponse.redirect(new URL("/login?error=not_superadmin", req.url));
    req.cookies.getAll().forEach(({ name }) => {
      if (name.startsWith("sb-")) {
        denied.cookies.set(name, "", { path: "/", expires: new Date(0) });
      }
    });
    return denied;
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
