import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../../lib/supabase-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function GET(request: NextRequest) {
  const email = normalizeEmail(request.nextUrl.searchParams.get("email"));
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ allowed: false, error: "Invalid email." }, { status: 200 });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { allowed: false, error: "Missing Supabase environment variables." },
      { status: 200 },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("profiles")
    .select("email, is_superadmin")
    .eq("is_superadmin", true)
    .limit(2000);

  if (error) {
    return NextResponse.json({ allowed: false, error: error.message }, { status: 200 });
  }

  const allowed = Array.isArray(data)
    ? data.some((row) => normalizeEmail(row?.email) === email && row?.is_superadmin === true)
    : false;

  const response = NextResponse.json({ allowed }, { status: 200 });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
