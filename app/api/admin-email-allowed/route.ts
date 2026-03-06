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

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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

  let data: Array<{ is_superadmin?: unknown; email?: unknown }> | null = null;
  let error: { message?: string } | null = null;

  try {
    // Constant-time lookup by email (instead of scanning many superadmin rows).
    const result = await withTimeout(
      (async () =>
        await supabase
          .from("profiles")
          .select("email, is_superadmin")
          .ilike("email", email)
          .limit(1))(),
      6000,
      "admin email check",
    );
    data = (result.data ?? null) as Array<{ is_superadmin?: unknown; email?: unknown }> | null;
    error = (result.error ?? null) as { message?: string } | null;
  } catch (timeoutError) {
    return NextResponse.json(
      {
        allowed: false,
        error: timeoutError instanceof Error ? timeoutError.message : "Admin check timed out.",
      },
      { status: 200 },
    );
  }

  if (error) {
    return NextResponse.json({ allowed: false, error: error.message }, { status: 200 });
  }

  const row = Array.isArray(data) && data.length ? data[0] : null;
  const allowed = Boolean(row && normalizeEmail(row.email) === email && row.is_superadmin === true);

  const response = NextResponse.json({ allowed }, { status: 200 });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
