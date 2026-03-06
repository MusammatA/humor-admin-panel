import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../../lib/supabase-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
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

  const userId = String(user.id || "").trim();
  const userEmail = String(user.email || "").trim();
  const normalizedUserEmail = normalizeEmail(userEmail);

  // Superadmin status is read-only from profiles.
  // This endpoint never writes roles and only trusts the authenticated user's profile row.
  const { data: profileById, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, is_superadmin")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      {
        authenticated: true,
        isSuperadmin: false,
        email: userEmail,
        error: profileError.message,
      },
      { status: 200 },
    );
  }

  const profileId = String(profileById?.id || "").trim();
  const normalizedProfileEmail = normalizeEmail(profileById?.email);
  const profileEmailMatches = Boolean(normalizedUserEmail) && normalizedProfileEmail === normalizedUserEmail;
  const profileIdMatches = Boolean(userId) && profileId === userId;
  const strictSuperadmin = profileById?.is_superadmin === true;
  const isSuperadmin = profileIdMatches && profileEmailMatches && strictSuperadmin;

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
