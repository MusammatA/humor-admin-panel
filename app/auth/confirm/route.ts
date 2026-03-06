import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../../lib/supabase-config";

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

  const userEmail = String(user.email || "").trim();
  if (!isEmailInAllowlist(userEmail)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_superadmin`);
  }

  let isSuperadmin = await isSuperadminByEmail(supabase, userEmail);

  if (!isSuperadmin && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const serviceClient = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    isSuperadmin = await isSuperadminByEmail(serviceClient, userEmail);
  }

  if (!isSuperadmin) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_superadmin`);
  }

  return NextResponse.redirect(`${origin}/admin`);
}
