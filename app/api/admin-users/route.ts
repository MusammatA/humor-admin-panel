import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../../lib/supabase-config";
import { isAdminEmailAllowed } from "../../../lib/admin-allowlist";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type GenericRow = Record<string, unknown>;

function str(row: GenericRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function getImageId(row: GenericRow) {
  return str(row, ["id", "image_id"]);
}

function getCaptionId(row: GenericRow) {
  return str(row, ["id", "caption_id"]);
}

function getCaptionImageId(row: GenericRow) {
  return str(row, ["image_id"]);
}

function getVoteCaptionId(row: GenericRow) {
  return str(row, ["caption_id"]);
}

function getTimestamp(row: GenericRow) {
  return str(row, ["created_at", "created_datetime_utc", "modified_datetime_utc"]);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function dedupeRows(rows: GenericRow[], getKey: (row: GenericRow) => string) {
  const map = new Map<string, GenericRow>();
  for (const row of rows) {
    const key = getKey(row) || JSON.stringify(row);
    if (!map.has(key)) map.set(key, row);
  }
  return Array.from(map.values());
}

async function isSuperadminByUserId(client: any, userId: string): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await client.from("profiles").select("id, is_superadmin").eq("id", userId).maybeSingle();
  if (error) return false;
  return Boolean(data && data.is_superadmin === true && String(data.id || "").trim() === userId);
}

async function requireAdminQueryClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      response: NextResponse.json({ error: "Missing Supabase environment variables." }, { status: 500 }),
    };
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
    return {
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  const userEmail = String(user.email || "").trim();
  if (!(await isAdminEmailAllowed(userEmail))) {
    return {
      response: NextResponse.json({ error: "This account is not allowed." }, { status: 403 }),
    };
  }

  let isSuperadmin = await isSuperadminByUserId(supabase, String(user.id || "").trim());
  let queryClient: any = supabase;

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const serviceClient = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (!isSuperadmin) {
      isSuperadmin = await isSuperadminByUserId(serviceClient, String(user.id || "").trim());
    }

    queryClient = serviceClient;
  }

  if (!isSuperadmin) {
    return {
      response: NextResponse.json({ error: "Superadmin access required." }, { status: 403 }),
    };
  }

  return { queryClient, user };
}

async function fetchAllRows(client: any, table: string, configure: (query: any) => any, pageSize = 1000) {
  const rows: GenericRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const query = configure(client.from(table).select("*")).range(from, from + pageSize - 1);
    const { data, error } = await query;
    if (error) throw error;
    const page = (data ?? []) as GenericRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function fetchRowsByValues(
  client: any,
  table: string,
  column: string,
  values: string[],
  configure?: (query: any) => any,
) {
  const uniqueValues = uniqueStrings(values);
  if (!uniqueValues.length) return [];

  const rows: GenericRow[] = [];
  for (const chunk of chunkValues(uniqueValues, 100)) {
    let query = client.from(table).select("*").in(column, chunk);
    if (configure) query = configure(query);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...((data ?? []) as GenericRow[]));
  }
  return rows;
}

async function fetchRowsByUserColumns(
  client: any,
  table: string,
  userId: string,
  columns: string[],
  configure?: (query: any) => any,
) {
  const rows: GenericRow[] = [];

  for (const column of columns) {
    let query = client.from(table).select("*").eq(column, userId);
    if (configure) query = configure(query);
    const { data, error } = await query;
    if (error) continue;
    rows.push(...((data ?? []) as GenericRow[]));
  }

  return rows;
}

export async function GET(request: Request) {
  const adminContext = await requireAdminQueryClient();
  if ("response" in adminContext && adminContext.response) {
    adminContext.response.headers.set("Cache-Control", "no-store, max-age=0");
    return adminContext.response;
  }

  const { queryClient } = adminContext;
  const requestUrl = new URL(request.url);
  const userId = requestUrl.searchParams.get("userId")?.trim() || "";

  try {
    if (!userId) {
      const profiles = await fetchAllRows(
        queryClient,
        "profiles",
        (query) => query.order("created_datetime_utc", { ascending: false }),
        1000,
      );
      const response = NextResponse.json({ profiles }, { status: 200 });
      response.headers.set("Cache-Control", "no-store, max-age=0");
      return response;
    }

    const [createdImages, userCaptions, userVotes] = await Promise.all([
      fetchRowsByUserColumns(
        queryClient,
        "images",
        userId,
        ["profile_id", "user_id"],
        (query) => query.order("created_datetime_utc", { ascending: false }),
      ),
      fetchRowsByUserColumns(
        queryClient,
        "captions",
        userId,
        ["profile_id", "user_id"],
        (query) => query.order("created_datetime_utc", { ascending: false }),
      ),
      fetchRowsByUserColumns(
        queryClient,
        "caption_votes",
        userId,
        ["profile_id", "user_id"],
        (query) => query.order("created_datetime_utc", { ascending: false }),
      ),
    ]);

    const dedupedCreatedImages = dedupeRows(createdImages, (row) => getImageId(row));
    const dedupedUserCaptions = dedupeRows(userCaptions, (row) => getCaptionId(row));
    const dedupedUserVotes = dedupeRows(
      userVotes,
      (row) =>
        str(row, ["id"]) || `${str(row, ["profile_id", "user_id"])}:${getVoteCaptionId(row)}:${getTimestamp(row)}`,
    );

    const createdImageIds = uniqueStrings(dedupedCreatedImages.map((row) => getImageId(row)));
    const voteCaptionIds = uniqueStrings(dedupedUserVotes.map((row) => getVoteCaptionId(row)));

    const [captionsForCreatedImages, captionsFromVotes] = await Promise.all([
      fetchRowsByValues(
        queryClient,
        "captions",
        "image_id",
        createdImageIds,
        (query) => query.order("created_datetime_utc", { ascending: false }),
      ),
      fetchRowsByValues(
        queryClient,
        "captions",
        "id",
        voteCaptionIds,
        (query) => query.order("created_datetime_utc", { ascending: false }),
      ),
    ]);

    const allCaptions = dedupeRows(
      [...dedupedUserCaptions, ...captionsForCreatedImages, ...captionsFromVotes],
      (row) => getCaptionId(row),
    );

    const relatedImageIds = uniqueStrings(
      allCaptions.map((row) => getCaptionImageId(row)).filter((id) => id && !createdImageIds.includes(id)),
    );

    const [relatedImages, captionVotes] = await Promise.all([
      fetchRowsByValues(
        queryClient,
        "images",
        "id",
        relatedImageIds,
        (query) => query.order("created_datetime_utc", { ascending: false }),
      ),
      fetchRowsByValues(
        queryClient,
        "caption_votes",
        "caption_id",
        allCaptions.map((row) => getCaptionId(row)),
        (query) => query.order("created_datetime_utc", { ascending: false }),
      ),
    ]);

    const response = NextResponse.json(
      {
        activity: {
          createdImages: dedupedCreatedImages,
          allImages: dedupeRows([...dedupedCreatedImages, ...relatedImages], (row) => getImageId(row)),
          userCaptions: dedupedUserCaptions,
          allCaptions,
          userVotes: dedupedUserVotes,
          captionVotes: dedupeRows(
            captionVotes,
            (row) =>
              str(row, ["id"]) ||
              `${str(row, ["profile_id", "user_id"])}:${getVoteCaptionId(row)}:${getTimestamp(row)}`,
          ),
        },
      },
      { status: 200 },
    );
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load admin users." },
      { status: 500 },
    );
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  }
}
