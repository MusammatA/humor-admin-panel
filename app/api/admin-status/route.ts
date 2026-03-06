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

  const userEmail = String(user.email || "").trim();
  const normalizedUserEmail = normalizeEmail(userEmail);
  if (!normalizedUserEmail) {
    return NextResponse.json(
      {
        authenticated: true,
        isSuperadmin: false,
        email: userEmail,
      },
      { status: 200 },
    );
  }

  // Final admin gate: signed-in Google email must match a profile with strict superadmin=true.
  // No role writes happen here.
  const lookupCandidates = Array.from(new Set([userEmail, normalizedUserEmail].filter(Boolean)));
  let isSuperadmin = false;
  let lastError = "";
  for (const candidateEmail of lookupCandidates) {
    try {
      const { data: rows, error: lookupError } = await withTimeout(
        (async () =>
          await supabase
            .from("profiles")
            .select("email, is_superadmin")
            .eq("email", candidateEmail)
            .limit(10))(),
        5000,
        "admin status check",
      );
      if (lookupError) {
        lastError = lookupError.message || lastError;
        continue;
      }
      const allowed = Array.isArray(rows)
        ? rows.some((row) => normalizeEmail(row?.email) === normalizedUserEmail && row?.is_superadmin === true)
        : false;
      if (allowed) {
        isSuperadmin = true;
        break;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Admin status check failed.";
    }
  }

  const response = NextResponse.json(
    {
      authenticated: true,
      isSuperadmin,
      email: userEmail,
      ...(lastError && !isSuperadmin ? { error: lastError } : {}),
    },
    { status: 200 },
  );
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
