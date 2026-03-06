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

function readAdminAllowlist(): Set<string> {
  const raw = String(process.env.ADMIN_ALLOWED_EMAILS || "");
  const normalized = raw
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
  return new Set(normalized);
}

function isEmailInAllowlist(email: string): boolean {
  const allowlist = readAdminAllowlist();
  if (!allowlist.size) return true;
  return allowlist.has(normalizeEmail(email));
}

function hasSuperadminEmailMatch(
  rows: Array<{ email?: unknown; is_superadmin?: unknown }>,
  normalizedEmail: string,
): boolean {
  return rows.some((row) => normalizeEmail(row?.email) === normalizedEmail && row?.is_superadmin === true);
}

async function querySuperadminByEmail(client: any, rawEmail: string, normalizedEmail: string): Promise<boolean> {
  const candidates = Array.from(new Set([rawEmail, normalizedEmail].filter(Boolean)));
  for (const candidate of candidates) {
    const { data, error } = await client
      .from("profiles")
      .select("email, is_superadmin")
      .eq("email", candidate)
      .limit(10);
    if (!error && Array.isArray(data) && hasSuperadminEmailMatch(data, normalizedEmail)) {
      return true;
    }
  }
  return false;
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

  if (!isEmailInAllowlist(normalizedEmail)) {
    return NextResponse.json({ allowed: false }, { status: 200 });
  }

  let allowed = false;
  let queryErrorMessage = "";

  try {
    const sessionlessClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    allowed = await querySuperadminByEmail(sessionlessClient, rawEmail, normalizedEmail);
  } catch (error) {
    queryErrorMessage = error instanceof Error ? error.message : "Admin check failed.";
  }

  if (!allowed && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const serviceClient = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      allowed = await querySuperadminByEmail(serviceClient, rawEmail, normalizedEmail);
    } catch (error) {
      queryErrorMessage = error instanceof Error ? error.message : "Admin check failed.";
    }
  }

  if (!allowed && queryErrorMessage) {
    return NextResponse.json({ allowed: false, indeterminate: true, error: queryErrorMessage }, { status: 200 });
  }

  const response = NextResponse.json({ allowed }, { status: 200 });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
