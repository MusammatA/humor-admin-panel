import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../../lib/supabase-config";

function parseIsSuperadmin(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "t" || normalized === "yes";
  }
  return false;
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

  const isSuperadmin = parseIsSuperadmin(profileById?.is_superadmin);

  return NextResponse.json(
    {
      authenticated: true,
      isSuperadmin,
      email: userEmail,
    },
    { status: 200 },
  );
}
