import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
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

type ProfileRow = {
  id?: unknown;
  email?: unknown;
  is_superadmin?: unknown;
};

function dedupeProfileRows(rows: ProfileRow[]): ProfileRow[] {
  const seen = new Set<string>();
  const out: ProfileRow[] = [];
  for (const row of rows) {
    const idKey = String(row?.id || "").trim();
    const emailKey = normalizeEmail(row?.email);
    const key = `${idKey}|${emailKey}|${String(row?.is_superadmin)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function queryProfileCandidates(
  client: any,
  userId: string,
  userEmail: string,
  normalizedUserEmail: string,
  label: string,
) {
  const rows: ProfileRow[] = [];
  const errors: string[] = [];

  const emailCandidates = Array.from(new Set([userEmail, normalizedUserEmail].filter(Boolean)));

  if (userId) {
    try {
      const { data, error } = await withTimeout(
        (async () =>
          await client
            .from("profiles")
            .select("id, email, is_superadmin")
            .eq("id", userId)
            .maybeSingle())(),
        3000,
        `${label} id check`,
      );
      if (error) errors.push(error.message || `${label} id query failed`);
      if (data) rows.push(data as ProfileRow);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `${label} id check failed`);
    }
  }

  for (const emailCandidate of emailCandidates) {
    try {
      const { data, error } = await withTimeout(
        (async () =>
          await client
            .from("profiles")
            .select("id, email, is_superadmin")
            .eq("email", emailCandidate)
            .limit(10))(),
        3000,
        `${label} email check`,
      );
      if (error) errors.push(error.message || `${label} email query failed`);
      if (Array.isArray(data)) rows.push(...(data as ProfileRow[]));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `${label} email check failed`);
    }
  }

  if (normalizedUserEmail) {
    try {
      const { data, error } = await withTimeout(
        (async () =>
          await client
            .from("profiles")
            .select("id, email, is_superadmin")
            .ilike("email", normalizedUserEmail)
            .limit(10))(),
        3000,
        `${label} ilike email check`,
      );
      if (error) errors.push(error.message || `${label} ilike query failed`);
      if (Array.isArray(data)) rows.push(...(data as ProfileRow[]));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `${label} ilike check failed`);
    }
  }

  return {
    rows: dedupeProfileRows(rows),
    error: errors.filter(Boolean).join(" | "),
  };
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

  const sessionLookup = await queryProfileCandidates(supabase, userId, userEmail, normalizedUserEmail, "session");
  let candidateRows = [...sessionLookup.rows];
  let lookupErrors = sessionLookup.error ? [sessionLookup.error] : [];

  const matchedBySession = candidateRows.some((row) => {
    const rowEmail = normalizeEmail(row?.email);
    const rowId = String(row?.id || "").trim();
    const superadmin = row?.is_superadmin === true;
    return superadmin && (rowEmail === normalizedUserEmail || (Boolean(userId) && rowId === userId));
  });

  let isSuperadmin = matchedBySession;

  // Optional fallback for stricter environments where session client cannot read profiles.
  if (!isSuperadmin && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const serviceClient = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const serviceLookup = await queryProfileCandidates(
      serviceClient,
      userId,
      userEmail,
      normalizedUserEmail,
      "service",
    );
    candidateRows = dedupeProfileRows([...candidateRows, ...serviceLookup.rows]);
    if (serviceLookup.error) lookupErrors.push(serviceLookup.error);
    isSuperadmin = candidateRows.some((row) => {
      const rowEmail = normalizeEmail(row?.email);
      const rowId = String(row?.id || "").trim();
      const superadmin = row?.is_superadmin === true;
      return superadmin && (rowEmail === normalizedUserEmail || (Boolean(userId) && rowId === userId));
    });
  }

  const response = NextResponse.json(
    {
      authenticated: true,
      isSuperadmin,
      email: userEmail,
      ...(lookupErrors.length && !isSuperadmin ? { error: lookupErrors.join(" | ") } : {}),
    },
    { status: 200 },
  );
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
