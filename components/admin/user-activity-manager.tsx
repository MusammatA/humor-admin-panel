"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  History,
  ImageIcon,
  LayoutDashboard,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";
import { deleteStorageObjectByPublicUrl } from "../../lib/supabase-storage";

type GenericRow = Record<string, unknown>;

type DirectoryUser = {
  key: string;
  id: string;
  email: string;
  name: string;
};

type UserActivityData = {
  createdImages: GenericRow[];
  allImages: GenericRow[];
  userCaptions: GenericRow[];
  allCaptions: GenericRow[];
  userVotes: GenericRow[];
  captionVotes: GenericRow[];
};

type DetailTab = "overview" | "uploaded-images" | "vote-history";

const USERS_PER_PAGE = 20;
const IMAGES_PER_PAGE = 4;
const VOTES_PER_PAGE = 20;
const IMAGE_CAPTIONS_PER_PAGE = 20;

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function rowString(row: GenericRow, keys: string[]) {
  for (const key of keys) {
    const value = asString(row[key]);
    if (value.trim()) return value.trim();
  }
  return "";
}

function rowNumber(row: GenericRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function getImageId(row: GenericRow) {
  return rowString(row, ["id", "image_id"]);
}

function getCaptionId(row: GenericRow) {
  return rowString(row, ["id", "caption_id"]);
}

function getCaptionImageId(row: GenericRow) {
  return rowString(row, ["image_id"]);
}

function getCaptionText(row: GenericRow) {
  return rowString(row, [
    "caption_text",
    "text",
    "content",
    "caption",
    "generated_caption",
    "meme_text",
  ]);
}

function getVoteCaptionId(row: GenericRow) {
  return rowString(row, ["caption_id"]);
}

function getVoteValue(row: GenericRow) {
  return rowNumber(row, ["vote_value", "value", "vote"]);
}

function getRowEmail(row: GenericRow) {
  return rowString(row, [
    "email",
    "user_email",
    "uploader_email",
    "uploaded_by_email",
    "created_by_email",
  ]).toLowerCase();
}

function getRowName(row: GenericRow) {
  const fullName = rowString(row, ["full_name", "name", "username", "uploader_name"]);
  if (fullName) return fullName;
  const firstName = rowString(row, ["first_name"]);
  const lastName = rowString(row, ["last_name"]);
  return `${firstName} ${lastName}`.trim();
}

function getImageUrl(row: GenericRow) {
  return rowString(row, ["cdn_url", "public_url", "image_url", "url"]);
}

function getTimestamp(row: GenericRow) {
  return rowString(row, [
    "created_at",
    "created_datetime_utc",
    "modified_datetime_utc",
  ]);
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

type UserActivityManagerProps = {
  canViewSensitive: boolean;
  canMutate: boolean;
  title?: string;
  description?: string;
};

export function UserActivityManager({
  canViewSensitive,
  canMutate,
  title = "User & Meme Activity Audit",
  description = "Search users, inspect created images and captions, analyze vote behavior, and moderate data.",
}: UserActivityManagerProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [profiles, setProfiles] = useState<GenericRow[]>([]);
  const [activity, setActivity] = useState<UserActivityData | null>(null);
  const [query, setQuery] = useState("");
  const [selectedUserKey, setSelectedUserKey] = useState("");
  const [userPage, setUserPage] = useState(0);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [imagesPage, setImagesPage] = useState(0);
  const [votesPage, setVotesPage] = useState(0);
  const [imageCaptionPages, setImageCaptionPages] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchAllRows(
    table: string,
    configure: (query: any) => any,
    pageSize = 1000,
  ) {
    if (!supabase) return [];

    const rows: GenericRow[] = [];
    for (let from = 0; ; from += pageSize) {
      const query = configure(supabase.from(table).select("*")).range(from, from + pageSize - 1);
      const { data, error } = await query;
      if (error) throw error;
      const page = (data ?? []) as GenericRow[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows;
  }

  async function fetchRowsByValues(
    table: string,
    column: string,
    values: string[],
    configure?: (query: any) => any,
  ) {
    if (!supabase) return [];

    const uniqueValues = uniqueStrings(values);
    if (!uniqueValues.length) return [];

    const rows: GenericRow[] = [];
    for (const chunk of chunkValues(uniqueValues, 100)) {
      let query = supabase.from(table).select("*").in(column, chunk);
      if (configure) query = configure(query);
      const { data, error } = await query;
      if (error) throw error;
      rows.push(...((data ?? []) as GenericRow[]));
    }
    return rows;
  }

  async function loadProfiles() {
    if (!supabase) {
      setError("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextProfiles = await fetchAllRows(
        "profiles",
        (query) => query.order("created_datetime_utc", { ascending: false }),
        1000,
      );
      setProfiles(nextProfiles);
    } catch (error) {
      setProfiles([]);
      setError(error instanceof Error ? error.message : "Failed to load profiles.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSelectedUserActivity(user: DirectoryUser | null) {
    if (!supabase || !user?.id) {
      setActivity(null);
      return;
    }

    setActivityLoading(true);
    setError(null);

    try {
      const [createdImages, userCaptions, userVotes] = await Promise.all([
        fetchAllRows(
          "images",
          (query) => query.eq("profile_id", user.id).order("created_datetime_utc", { ascending: false }),
          500,
        ),
        fetchAllRows(
          "captions",
          (query) => query.eq("profile_id", user.id).order("created_datetime_utc", { ascending: false }),
          1000,
        ),
        fetchAllRows(
          "caption_votes",
          (query) =>
            query
              .or(`profile_id.eq.${user.id},user_id.eq.${user.id}`)
              .order("created_datetime_utc", { ascending: false }),
          1000,
        ),
      ]);

      const createdImageIds = uniqueStrings(createdImages.map((row) => getImageId(row)));
      const voteCaptionIds = uniqueStrings(userVotes.map((row) => getVoteCaptionId(row)));

      const [captionsForCreatedImages, captionsFromVotes] = await Promise.all([
        fetchRowsByValues(
          "captions",
          "image_id",
          createdImageIds,
          (query) => query.order("created_datetime_utc", { ascending: false }),
        ),
        fetchRowsByValues(
          "captions",
          "id",
          voteCaptionIds,
          (query) => query.order("created_datetime_utc", { ascending: false }),
        ),
      ]);

      const allCaptions = dedupeRows(
        [...userCaptions, ...captionsForCreatedImages, ...captionsFromVotes],
        (row) => getCaptionId(row),
      );

      const relatedImageIds = uniqueStrings(
        allCaptions
          .map((row) => getCaptionImageId(row))
          .filter((id) => id && !createdImageIds.includes(id)),
      );

      const [relatedImages, captionVotes] = await Promise.all([
        fetchRowsByValues(
          "images",
          "id",
          relatedImageIds,
          (query) => query.order("created_datetime_utc", { ascending: false }),
        ),
        fetchRowsByValues(
          "caption_votes",
          "caption_id",
          allCaptions.map((row) => getCaptionId(row)),
          (query) => query.order("created_datetime_utc", { ascending: false }),
        ),
      ]);

      setActivity({
        createdImages: dedupeRows(createdImages, (row) => getImageId(row)),
        allImages: dedupeRows([...createdImages, ...relatedImages], (row) => getImageId(row)),
        userCaptions: dedupeRows(userCaptions, (row) => getCaptionId(row)),
        allCaptions,
        userVotes: dedupeRows(
          userVotes,
          (row) =>
            rowString(row, ["id"]) ||
            `${rowString(row, ["profile_id", "user_id"])}:${getVoteCaptionId(row)}:${getTimestamp(row)}`,
        ),
        captionVotes: dedupeRows(
          captionVotes,
          (row) =>
            rowString(row, ["id"]) ||
            `${rowString(row, ["profile_id", "user_id"])}:${getVoteCaptionId(row)}:${getTimestamp(row)}`,
        ),
      });
    } catch (error) {
      setActivity(null);
      setError(error instanceof Error ? error.message : "Failed to load user activity.");
    } finally {
      setActivityLoading(false);
    }
  }

  useEffect(() => {
    loadProfiles();
  }, []);

  const directory = useMemo(() => {
    const userMap = new Map<string, DirectoryUser>();

    for (const row of profiles) {
      const id = rowString(row, ["id"]);
      const email = getRowEmail(row);
      const key = (id || email).toLowerCase();
      if (!key) continue;

      const name = getRowName(row) || email || (id ? `User ${id.slice(0, 8)}` : "Unknown user");
      if (!userMap.has(key)) {
        userMap.set(key, { key, id, email, name });
        continue;
      }

      const existing = userMap.get(key)!;
      existing.id = existing.id || id;
      existing.email = existing.email || email;
      if (!existing.name || existing.name === "Unknown user") {
        existing.name = name;
      }
    }

    return Array.from(userMap.values()).sort((a, b) =>
      (a.name || a.email || a.id).localeCompare(b.name || b.email || b.id),
    );
  }, [profiles]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return directory;
    return directory.filter((user) =>
      `${user.name} ${user.email}`.toLowerCase().includes(q),
    );
  }, [directory, query]);

  const userPageCount = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const currentUserPage = Math.min(userPage, userPageCount - 1);
  const visibleUsers = filteredUsers.slice(
    currentUserPage * USERS_PER_PAGE,
    currentUserPage * USERS_PER_PAGE + USERS_PER_PAGE,
  );

  useEffect(() => {
    setUserPage(0);
  }, [query]);

  useEffect(() => {
    if (!selectedUserKey && filteredUsers.length) {
      setSelectedUserKey(filteredUsers[0].key);
    }
    if (selectedUserKey && !filteredUsers.some((user) => user.key === selectedUserKey)) {
      setSelectedUserKey(filteredUsers[0]?.key ?? "");
    }
  }, [filteredUsers, selectedUserKey]);

  const selectedUser = filteredUsers.find((user) => user.key === selectedUserKey) ?? null;

  useEffect(() => {
    loadSelectedUserActivity(selectedUser);
  }, [selectedUser?.key]);

  useEffect(() => {
    setDetailTab("overview");
    setImagesPage(0);
    setVotesPage(0);
    setImageCaptionPages({});
  }, [selectedUser?.key]);

  const details = useMemo(() => {
    if (!selectedUser || !activity) return null;

    const voteStatsByCaption = new Map<string, { up: number; down: number; total: number }>();
    for (const vote of activity.captionVotes) {
      const captionId = getVoteCaptionId(vote);
      if (!captionId) continue;
      if (!voteStatsByCaption.has(captionId)) {
        voteStatsByCaption.set(captionId, { up: 0, down: 0, total: 0 });
      }
      const stat = voteStatsByCaption.get(captionId)!;
      const value = getVoteValue(vote);
      if (value > 0) stat.up += 1;
      if (value < 0) stat.down += 1;
      stat.total += value;
    }

    const upVotes = activity.userVotes.filter((row) => getVoteValue(row) > 0);
    const downVotes = activity.userVotes.filter((row) => getVoteValue(row) < 0);

    const captionsByImage = new Map<string, GenericRow[]>();
    for (const caption of activity.allCaptions) {
      const imageId = getCaptionImageId(caption);
      if (!imageId) continue;
      if (!captionsByImage.has(imageId)) captionsByImage.set(imageId, []);
      captionsByImage.get(imageId)!.push(caption);
    }

    const captionById = new Map(activity.allCaptions.map((row) => [getCaptionId(row), row]));
    const imageById = new Map(activity.allImages.map((row) => [getImageId(row), row]));

    const upImageIds = new Set<string>();
    const downImageIds = new Set<string>();
    for (const vote of activity.userVotes) {
      const caption = captionById.get(getVoteCaptionId(vote));
      if (!caption) continue;
      const imageId = getCaptionImageId(caption);
      if (!imageId) continue;
      if (getVoteValue(vote) > 0) upImageIds.add(imageId);
      if (getVoteValue(vote) < 0) downImageIds.add(imageId);
    }

    return {
      voteStatsByCaption,
      userCaptions: activity.userCaptions,
      userVotes: activity.userVotes,
      upVotes,
      downVotes,
      createdImages: activity.createdImages,
      captionsByImage,
      imageById,
      upVotedImages: Array.from(upImageIds).map((id) => imageById.get(id) ?? ({ id } as GenericRow)),
      downVotedImages: Array.from(downImageIds).map((id) => imageById.get(id) ?? ({ id } as GenericRow)),
      captionById,
    };
  }, [activity, selectedUser]);

  async function handleRefresh() {
    await loadProfiles();
    await loadSelectedUserActivity(selectedUser);
  }

  async function handleDeleteVote(vote: GenericRow) {
    if (!canMutate) {
      setError("Only superadmins can delete votes.");
      return;
    }
    if (!supabase || !selectedUser) return;
    if (!window.confirm("Delete this vote?")) return;

    let request = supabase.from("caption_votes").delete();
    const voteId = rowString(vote, ["id"]);
    if (voteId) {
      request = request.eq("id", voteId);
    } else {
      const profileId = rowString(vote, ["profile_id", "user_id"]);
      const captionId = getVoteCaptionId(vote);
      request = request.eq("profile_id", profileId).eq("caption_id", captionId);
    }
    const { error: deleteError } = await request;
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await loadSelectedUserActivity(selectedUser);
  }

  async function handleDeleteImage(image: GenericRow) {
    if (!canMutate) {
      setError("Only superadmins can delete images.");
      return;
    }
    if (!supabase || !selectedUser) return;

    const imageId = getImageId(image);
    const imageUrl = getImageUrl(image);
    if (!imageId) return;
    if (!window.confirm(`Delete image ${imageId} and related captions/votes?`)) return;

    const relatedCaptions =
      activity?.allCaptions.filter((row) => getCaptionImageId(row) === imageId) ?? [];
    const captionIds = relatedCaptions.map((row) => getCaptionId(row)).filter(Boolean);

    if (captionIds.length) {
      const { error: votesDeleteError } = await supabase
        .from("caption_votes")
        .delete()
        .in("caption_id", captionIds);
      if (votesDeleteError) {
        setError(votesDeleteError.message);
        return;
      }
    }

    const { error: captionsDeleteError } = await supabase
      .from("captions")
      .delete()
      .eq("image_id", imageId);
    if (captionsDeleteError) {
      setError(captionsDeleteError.message);
      return;
    }

    const { error: imageDeleteError } = await supabase.from("images").delete().eq("id", imageId);
    if (imageDeleteError) {
      setError(imageDeleteError.message);
      return;
    }

    const { error: storageDeleteError, ref } = await deleteStorageObjectByPublicUrl(
      supabase,
      imageUrl,
      "images",
    );

    if (storageDeleteError) {
      setError(
        `Deleted image row ${imageId}, but failed to remove storage object ${ref?.path ?? imageUrl}: ${storageDeleteError.message}`,
      );
      return;
    }

    await loadSelectedUserActivity(selectedUser);
  }

  const detailTabs: Array<{
    id: DetailTab;
    label: string;
    icon: typeof LayoutDashboard;
    count?: number;
  }> = details
    ? [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        {
          id: "uploaded-images",
          label: "Uploaded Images",
          icon: ImageIcon,
          count: details.createdImages.length,
        },
        {
          id: "vote-history",
          label: "Vote History",
          icon: History,
          count: details.userVotes.length,
        },
      ]
    : [];

  const imagesPageCount = Math.max(
    1,
    Math.ceil((details?.createdImages.length ?? 0) / IMAGES_PER_PAGE),
  );
  const currentImagesPage = Math.min(imagesPage, imagesPageCount - 1);
  const visibleCreatedImages = details
    ? details.createdImages.slice(
        currentImagesPage * IMAGES_PER_PAGE,
        currentImagesPage * IMAGES_PER_PAGE + IMAGES_PER_PAGE,
      )
    : [];

  const votesPageCount = Math.max(
    1,
    Math.ceil((details?.userVotes.length ?? 0) / VOTES_PER_PAGE),
  );
  const currentVotesPage = Math.min(votesPage, votesPageCount - 1);
  const visibleVotes = details
    ? details.userVotes.slice(
        currentVotesPage * VOTES_PER_PAGE,
        currentVotesPage * VOTES_PER_PAGE + VOTES_PER_PAGE,
      )
    : [];

  function selectUserPage(nextPage: number) {
    const boundedPage = Math.max(0, Math.min(userPageCount - 1, nextPage));
    setUserPage(boundedPage);
    const nextUser = filteredUsers[boundedPage * USERS_PER_PAGE];
    if (nextUser) setSelectedUserKey(nextUser.key);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {!canViewSensitive ? (
        <>
          <div className="mb-2 flex items-center gap-2">
            <UserRound className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          </div>
          <p className="text-sm text-slate-600">Unavailable. View users by signing in as admin.</p>
        </>
      ) : null}
      {canViewSensitive ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              <p className="text-sm text-slate-600">{description}</p>
            </div>
            <button
              onClick={handleRefresh}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              type="button"
            >
              Refresh
            </button>
          </div>

          {error ? (
            <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users by name or email"
              className="w-full border-none bg-transparent text-sm outline-none"
            />
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading user directory...</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Users</p>
                    <p className="text-xs text-slate-500">
                      {filteredUsers.length
                        ? `Showing ${currentUserPage * USERS_PER_PAGE + 1}-${Math.min(
                            (currentUserPage + 1) * USERS_PER_PAGE,
                            filteredUsers.length,
                          )} of ${filteredUsers.length}`
                        : "No users found"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => selectUserPage(currentUserPage - 1)}
                      disabled={currentUserPage === 0}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Previous users"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => selectUserPage(currentUserPage + 1)}
                      disabled={currentUserPage >= userPageCount - 1}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Next users"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {visibleUsers.map((user) => (
                  <button
                    key={user.key}
                    onClick={() => setSelectedUserKey(user.key)}
                    className={`w-full border-b border-slate-100 p-3 text-left hover:bg-slate-50 ${
                      selectedUserKey === user.key ? "bg-slate-100" : ""
                    }`}
                    type="button"
                  >
                    <p className="text-sm font-semibold text-slate-900">{user.name || "Unknown user"}</p>
                    {user.email ? <p className="mt-1 text-xs text-slate-500">{user.email}</p> : null}
                  </button>
                ))}
                {!filteredUsers.length ? (
                  <p className="p-3 text-sm text-slate-500">No users found for this search.</p>
                ) : null}
              </aside>

              <div className="space-y-4">
                {!selectedUser ? (
                  <p className="text-sm text-slate-500">Pick a user to inspect activity details.</p>
                ) : activityLoading ? (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Loading live activity for {selectedUser.name || selectedUser.email || "selected user"}...
                  </p>
                ) : !details ? (
                  <p className="text-sm text-slate-500">No activity found for this user.</p>
                ) : (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <UserRound className="h-5 w-5 text-slate-700" />
                        <h3 className="text-base font-semibold text-slate-900">{selectedUser.name || "User"}</h3>
                      </div>
                      <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                        <p>
                          <span className="font-semibold">User ID:</span> {selectedUser.id || "N/A"}
                        </p>
                        <p>
                          <span className="font-semibold">Email:</span> {selectedUser.email || "N/A"}
                        </p>
                        {canViewSensitive ? (
                          <>
                            <p>
                              <span className="font-semibold">Created Images:</span> {details.createdImages.length}
                            </p>
                            <p>
                              <span className="font-semibold">Created Captions:</span> {details.userCaptions.length}
                            </p>
                            <p>
                              <span className="font-semibold">Upvotes Cast:</span> {details.upVotes.length}
                            </p>
                            <p>
                              <span className="font-semibold">Downvotes Cast:</span> {details.downVotes.length}
                            </p>
                            <p>
                              <span className="font-semibold">Images Upvoted:</span> {details.upVotedImages.length}
                            </p>
                            <p>
                              <span className="font-semibold">Images Downvoted:</span> {details.downVotedImages.length}
                            </p>
                          </>
                        ) : (
                          <p className="md:col-span-2 text-slate-500">
                            Detailed activity data is available to admins only.
                          </p>
                        )}
                      </div>
                    </div>

                    {canViewSensitive ? (
                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="mb-4 flex flex-wrap gap-2">
                          {detailTabs.map((tab) => {
                            const Icon = tab.icon;
                            const selected = detailTab === tab.id;
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setDetailTab(tab.id)}
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${
                                  selected
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <Icon className="h-4 w-4" />
                                <span>{tab.label}</span>
                                {typeof tab.count === "number" ? (
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs ${
                                      selected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {tab.count}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>

                        {detailTab === "overview" ? (
                          <div className="grid gap-4 xl:grid-cols-3">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Uploads</p>
                              <p className="mt-2 text-3xl font-semibold text-slate-900">{details.createdImages.length}</p>
                              <p className="mt-2 text-sm text-slate-600">Images uploaded by this user.</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Created Captions</p>
                              <p className="mt-2 text-3xl font-semibold text-slate-900">{details.userCaptions.length}</p>
                              <p className="mt-2 text-sm text-slate-600">Caption rows authored by this user.</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Vote Rows</p>
                              <p className="mt-2 text-3xl font-semibold text-slate-900">{details.userVotes.length}</p>
                              <p className="mt-2 text-sm text-slate-600">Current vote rows tied to this profile.</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-2">
                              <h4 className="text-sm font-semibold text-slate-900">Recent Uploaded Images</h4>
                              <p className="mb-3 text-xs text-slate-500">
                                Latest uploads with attached captions.
                              </p>
                              {!details.createdImages.length ? (
                                <p className="text-sm text-slate-500">No uploaded images found for this user.</p>
                              ) : (
                                <div className="space-y-3">
                                  {details.createdImages.slice(0, 3).map((image) => {
                                    const imageId = getImageId(image);
                                    const imageCaptions = details.captionsByImage.get(imageId) ?? [];
                                    return (
                                      <div key={imageId} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                        <p className="font-mono text-xs text-slate-700">Image ID: {imageId || "N/A"}</p>
                                        <p className="mt-2 text-xs text-slate-600">
                                          {imageCaptions.length} attached caption{imageCaptions.length === 1 ? "" : "s"}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                              <h4 className="text-sm font-semibold text-slate-900">Vote Mix</h4>
                              <div className="mt-3 space-y-2 text-sm text-slate-700">
                                <p>Upvotes: {details.upVotes.length}</p>
                                <p>Downvotes: {details.downVotes.length}</p>
                                <p>Neutral: {details.userVotes.length - details.upVotes.length - details.downVotes.length}</p>
                                <p>Images Upvoted: {details.upVotedImages.length}</p>
                                <p>Images Downvoted: {details.downVotedImages.length}</p>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {detailTab === "uploaded-images" ? (
                          <>
                            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-semibold text-slate-900">Uploaded Images + Attached Captions</h4>
                                <p className="text-xs text-slate-500">
                                  Large previews use contain mode so the whole image stays visible.
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-slate-500">
                                  {details.createdImages.length
                                    ? `Showing ${currentImagesPage * IMAGES_PER_PAGE + 1}-${Math.min(
                                        (currentImagesPage + 1) * IMAGES_PER_PAGE,
                                        details.createdImages.length,
                                      )} of ${details.createdImages.length}`
                                    : "No uploaded images"}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setImagesPage((page) => Math.max(0, page - 1))}
                                  disabled={currentImagesPage === 0}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  aria-label="Previous uploaded images"
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setImagesPage((page) => Math.min(imagesPageCount - 1, page + 1))}
                                  disabled={currentImagesPage >= imagesPageCount - 1}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  aria-label="Next uploaded images"
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            {!details.createdImages.length ? (
                              <p className="text-sm text-slate-500">No created images found for this user.</p>
                            ) : (
                              <div className="space-y-4">
                                {visibleCreatedImages.map((image) => {
                                  const imageId = getImageId(image);
                                  const imageUrl = getImageUrl(image);
                                  const imageCaptions = details.captionsByImage.get(imageId) ?? [];
                                  const imageCaptionsPageCount = Math.max(
                                    1,
                                    Math.ceil(imageCaptions.length / IMAGE_CAPTIONS_PER_PAGE),
                                  );
                                  const currentImageCaptionsPage = Math.min(
                                    imageCaptionPages[imageId] ?? 0,
                                    imageCaptionsPageCount - 1,
                                  );
                                  const visibleImageCaptions = imageCaptions.slice(
                                    currentImageCaptionsPage * IMAGE_CAPTIONS_PER_PAGE,
                                    currentImageCaptionsPage * IMAGE_CAPTIONS_PER_PAGE + IMAGE_CAPTIONS_PER_PAGE,
                                  );
                                  return (
                                    <article key={imageId} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                          <p className="font-mono text-xs text-slate-700">Image ID: {imageId || "N/A"}</p>
                                          <p className="mt-1 text-xs text-slate-500">
                                            {imageCaptions.length} attached caption{imageCaptions.length === 1 ? "" : "s"}
                                          </p>
                                        </div>
                                        {canMutate ? (
                                          <button
                                            onClick={() => handleDeleteImage(image)}
                                            className="inline-flex items-center gap-1 rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                                            type="button"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Delete Image
                                          </button>
                                        ) : null}
                                      </div>
                                      {imageUrl ? (
                                        <div className="mb-3 flex min-h-[24rem] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-[radial-gradient(circle_at_top,rgba(90,148,204,0.12),transparent_45%),linear-gradient(180deg,rgba(248,245,238,0.95),rgba(237,245,239,0.9))] p-4">
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={imageUrl}
                                            alt={imageId || "Meme image"}
                                            className="max-h-[34rem] w-full rounded-lg object-contain"
                                          />
                                        </div>
                                      ) : (
                                        <p className="mb-3 text-xs text-slate-500">No image URL available in row data.</p>
                                      )}
                                      <ul className="space-y-2">
                                        {imageCaptions.length ? (
                                          <>
                                            <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500">
                                              <span>
                                                Showing {currentImageCaptionsPage * IMAGE_CAPTIONS_PER_PAGE + 1}-
                                                {Math.min(
                                                  (currentImageCaptionsPage + 1) * IMAGE_CAPTIONS_PER_PAGE,
                                                  imageCaptions.length,
                                                )} of {imageCaptions.length} captions
                                              </span>
                                              <span className="flex items-center gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setImageCaptionPages((prev) => ({
                                                      ...prev,
                                                      [imageId]: Math.max(0, currentImageCaptionsPage - 1),
                                                    }))
                                                  }
                                                  disabled={currentImageCaptionsPage === 0}
                                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                  aria-label="Previous image captions"
                                                >
                                                  <ChevronLeft className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setImageCaptionPages((prev) => ({
                                                      ...prev,
                                                      [imageId]: Math.min(
                                                        imageCaptionsPageCount - 1,
                                                        currentImageCaptionsPage + 1,
                                                      ),
                                                    }))
                                                  }
                                                  disabled={currentImageCaptionsPage >= imageCaptionsPageCount - 1}
                                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                  aria-label="Next image captions"
                                                >
                                                  <ChevronRight className="h-3.5 w-3.5" />
                                                </button>
                                              </span>
                                            </li>
                                            {visibleImageCaptions.map((caption) => {
                                              const captionId = getCaptionId(caption);
                                              const captionStat = details.voteStatsByCaption.get(captionId);
                                              return (
                                              <li
                                                key={captionId}
                                                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                                              >
                                                <p>
                                                  <span className="font-semibold">Caption:</span> {getCaptionText(caption) || "(empty)"}
                                                </p>
                                                <p className="mt-1 text-slate-500">
                                                  Caption ID: {captionId || "N/A"} | Votes: +{captionStat?.up ?? 0} / -
                                                  {captionStat?.down ?? 0} (score {captionStat?.total ?? 0})
                                                </p>
                                              </li>
                                            );
                                          })}
                                          </>
                                        ) : (
                                          <li className="text-xs text-slate-500">No captions found for this image.</li>
                                        )}
                                      </ul>
                                    </article>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        ) : null}

                        {detailTab === "vote-history" ? (
                          <>
                            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-semibold text-slate-900">Vote History</h4>
                                <p className="text-xs text-slate-500">
                                  Every current vote row by this user with vote value, target caption, associated image, and delete action.
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-slate-500">
                                  {details.userVotes.length
                                    ? `Showing ${currentVotesPage * VOTES_PER_PAGE + 1}-${Math.min(
                                        (currentVotesPage + 1) * VOTES_PER_PAGE,
                                        details.userVotes.length,
                                      )} of ${details.userVotes.length}`
                                    : "No votes"}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setVotesPage((page) => Math.max(0, page - 1))}
                                  disabled={currentVotesPage === 0}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  aria-label="Previous votes"
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setVotesPage((page) => Math.min(votesPageCount - 1, page + 1))}
                                  disabled={currentVotesPage >= votesPageCount - 1}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  aria-label="Next votes"
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            {!details.userVotes.length ? (
                              <p className="text-sm text-slate-500">No votes found for this user.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200 text-slate-500">
                                      <th className="px-2 py-2">Vote</th>
                                      <th className="px-2 py-2">Caption</th>
                                      <th className="px-2 py-2">Image ID</th>
                                      <th className="px-2 py-2">Timestamp</th>
                                      <th className="px-2 py-2">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {visibleVotes.map((vote) => {
                                      const caption = details.captionById.get(getVoteCaptionId(vote));
                                      const voteValue = getVoteValue(vote);
                                      return (
                                        <tr
                                          key={
                                            rowString(vote, ["id"]) ||
                                            `${getVoteCaptionId(vote)}-${getTimestamp(vote)}`
                                          }
                                          className="border-b border-slate-100"
                                        >
                                          <td className="px-2 py-2 font-semibold text-slate-800">{voteValue}</td>
                                          <td className="max-w-xl px-2 py-2 text-slate-700">
                                            {getCaptionText(caption ?? {}) || "(caption unavailable)"}
                                          </td>
                                          <td className="px-2 py-2 font-mono text-slate-600">
                                            {getCaptionImageId(caption ?? {}) || "N/A"}
                                          </td>
                                          <td className="px-2 py-2 text-slate-500">{getTimestamp(vote) || "N/A"}</td>
                                          <td className="px-2 py-2">
                                            {canMutate ? (
                                              <button
                                                onClick={() => handleDeleteVote(vote)}
                                                className="rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                                                type="button"
                                              >
                                                Delete Vote
                                              </button>
                                            ) : null}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
