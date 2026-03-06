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
  const rawEmail = String(request.nextUrl.searchParams.get("email") || "").trim();
  const normalizedEmail = normalizeEmail(rawEmail);
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
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

  // Prefer exact lookups to avoid slow table scans.
  const candidates = Array.from(
    new Set(
      [rawEmail, normalizedEmail]
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );

  let hadTimeout = false;
  let hadQueryError = false;
  let queryErrorMessage = "";
  let allowed = false;

  for (const candidate of candidates) {
    try {
      const result = await withTimeout(
        (async () =>
          await supabase
            .from("profiles")
            .select("email, is_superadmin")
            .eq("email", candidate)
            .maybeSingle())(),
        2500,
        "admin email check",
      );

      if (result.error) {
        hadQueryError = true;
        queryErrorMessage = result.error.message || queryErrorMessage;
        continue;
      }

      if (result.data && result.data.is_superadmin === true) {
        allowed = true;
        break;
      }
    } catch (timeoutError) {
      hadTimeout = true;
      queryErrorMessage =
        timeoutError instanceof Error ? timeoutError.message : "Admin check timed out.";
    }
  }

  if (!allowed && hadTimeout) {
    return NextResponse.json(
      {
        allowed: false,
        indeterminate: true,
        error: queryErrorMessage || "Admin check timed out.",
      },
      { status: 200 },
    );
  }

  if (!allowed && hadQueryError) {
    return NextResponse.json(
      {
        allowed: false,
        indeterminate: true,
        error: queryErrorMessage || "Admin check unavailable.",
      },
      { status: 200 },
    );
  }

  const response = NextResponse.json({ allowed }, { status: 200 });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
