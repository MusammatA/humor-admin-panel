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

function hasSuperadminUserIdMatch(rows: Array<{ id?: unknown; is_superadmin?: unknown }>, expectedId: string): boolean {
  return rows.some((row) => String(row?.id || "").trim() === expectedId && row?.is_superadmin === true);
}

async function querySuperadminByEmail(client: any, rawEmail: string, normalizedEmail: string): Promise<boolean> {
  const candidates = Array.from(new Set([rawEmail, normalizedEmail].filter(Boolean)));
  for (const candidate of candidates) {
    const { data: authData, error: authError } = await client.auth.admin.listUsers({
      page: 1,
      perPage: 1,
      email: candidate,
    });
    if (authError) continue;
    const userId = String(authData?.users?.[0]?.id || "").trim();
    if (!userId) continue;

    const { data, error } = await client
      .from("profiles")
      .select("id, is_superadmin")
      .eq("id", userId)
      .limit(1);
    if (!error && Array.isArray(data) && hasSuperadminUserIdMatch(data, userId)) {
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

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        allowed: false,
        indeterminate: true,
        error: "Server is missing SUPABASE_SERVICE_ROLE_KEY for admin email verification.",
      },
      { status: 200 },
    );
  }

  try {
    const serviceClient = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const allowed = await querySuperadminByEmail(serviceClient, rawEmail, normalizedEmail);
    const response = NextResponse.json({ allowed }, { status: 200 });
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        allowed: false,
        indeterminate: true,
        error: error instanceof Error ? error.message : "Admin check failed.",
      },
      { status: 200 },
    );
  }
}
