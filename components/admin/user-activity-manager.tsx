"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, UserRound } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";

type GenericRow = Record<string, unknown>;

type DirectoryUser = {
  key: string;
  id: string;
  email: string;
  name: string;
  sources: string[];
};

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

function getRowUserId(row: GenericRow) {
  return rowString(row, [
    "id",
    "user_id",
    "profile_id",
    "uploader_user_id",
    "uploaded_by_user_id",
    "created_by_user_id",
  ]);
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
  return rowString(row, ["created_at", "created_datetime_utc", "modified_datetime_utc"]);
}

function userMatch(row: GenericRow, user: DirectoryUser) {
  const rowUserId = getRowUserId(row);
  const rowEmail = getRowEmail(row);
  return (user.id && rowUserId === user.id) || (user.email && rowEmail === user.email);
}

export function UserActivityManager() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [profiles, setProfiles] = useState<GenericRow[]>([]);
  const [images, setImages] = useState<GenericRow[]>([]);
  const [captions, setCaptions] = useState<GenericRow[]>([]);
  const [votes, setVotes] = useState<GenericRow[]>([]);
  const [query, setQuery] = useState("");
  const [selectedUserKey, setSelectedUserKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAllData() {
    if (!supabase) {
      setError("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const [profilesRes, imagesRes, captionsRes, votesRes] = await Promise.all([
      supabase.from("profiles").select("*").limit(5000),
      supabase.from("images").select("*").limit(5000),
      supabase.from("captions").select("*").limit(10000),
      supabase.from("caption_votes").select("*").limit(20000),
    ]);

    const firstError =
      profilesRes.error || imagesRes.error || captionsRes.error || votesRes.error || null;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setProfiles((profilesRes.data ?? []) as GenericRow[]);
    setImages((imagesRes.data ?? []) as GenericRow[]);
    setCaptions((captionsRes.data ?? []) as GenericRow[]);
    setVotes((votesRes.data ?? []) as GenericRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadAllData();
  }, []);

  const directory = useMemo(() => {
    const userMap = new Map<string, DirectoryUser>();

    function upsertUser(partial: Partial<DirectoryUser>, source: string) {
      const keyBase = partial.id || partial.email;
      if (!keyBase) return;
      const key = keyBase.toLowerCase();
      const existing = userMap.get(key);
      if (!existing) {
        userMap.set(key, {
          key,
          id: partial.id ?? "",
          email: partial.email ?? "",
          name: partial.name ?? partial.email ?? partial.id ?? "Unknown user",
          sources: [source],
        });
        return;
      }
      existing.id = existing.id || partial.id || "";
      existing.email = existing.email || partial.email || "";
      existing.name = existing.name === "Unknown user" ? partial.name || existing.name : existing.name;
      if (!existing.sources.includes(source)) existing.sources.push(source);
    }

    for (const row of profiles) {
      upsertUser(
        { id: rowString(row, ["id"]), email: getRowEmail(row), name: getRowName(row) || getRowEmail(row) },
        "profiles"
      );
    }
    for (const row of captions) {
      upsertUser({ id: rowString(row, ["user_id"]), email: getRowEmail(row), name: getRowName(row) }, "captions");
    }
    for (const row of votes) {
      upsertUser({ id: rowString(row, ["profile_id", "user_id"]), email: getRowEmail(row), name: getRowName(row) }, "votes");
    }
    for (const row of images) {
      upsertUser({ id: getRowUserId(row), email: getRowEmail(row), name: getRowName(row) }, "images");
    }

    return Array.from(userMap.values()).sort((a, b) =>
      (a.name || a.email || a.id).localeCompare(b.name || b.email || b.id)
    );
  }, [profiles, captions, votes, images]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const columbiaUsers = directory.filter((user) =>
      user.email.toLowerCase().endsWith("@columbia.edu")
    );
    if (!q) return columbiaUsers;
    return columbiaUsers.filter((user) => user.email.toLowerCase().includes(q));
  }, [directory, query]);

  useEffect(() => {
    if (!selectedUserKey && filteredUsers.length) {
      setSelectedUserKey(filteredUsers[0].key);
    }
    if (selectedUserKey && !filteredUsers.some((u) => u.key === selectedUserKey)) {
      setSelectedUserKey(filteredUsers[0]?.key ?? "");
    }
  }, [filteredUsers, selectedUserKey]);

  const selectedUser = filteredUsers.find((user) => user.key === selectedUserKey) ?? null;

  const voteStatsByCaption = useMemo(() => {
    const map = new Map<string, { up: number; down: number; total: number }>();
    for (const vote of votes) {
      const captionId = getVoteCaptionId(vote);
      if (!captionId) continue;
      if (!map.has(captionId)) map.set(captionId, { up: 0, down: 0, total: 0 });
      const stat = map.get(captionId)!;
      const value = getVoteValue(vote);
      if (value > 0) stat.up += 1;
      if (value < 0) stat.down += 1;
      stat.total += value;
    }
    return map;
  }, [votes]);

  const details = useMemo(() => {
    if (!selectedUser) return null;

    const userCaptions = captions.filter((row) => userMatch(row, selectedUser));
    const userVotes = votes.filter((row) => userMatch(row, selectedUser));
    const upVotes = userVotes.filter((row) => getVoteValue(row) > 0);
    const downVotes = userVotes.filter((row) => getVoteValue(row) < 0);

    const imageIdsFromCaptions = new Set(
      userCaptions.map((row) => getCaptionImageId(row)).filter(Boolean)
    );
    const directImages = images.filter((row) => userMatch(row, selectedUser));
    for (const row of directImages) {
      const imageId = getImageId(row);
      if (imageId) imageIdsFromCaptions.add(imageId);
    }

    const imageById = new Map(images.map((row) => [getImageId(row), row]));
    const createdImages = Array.from(imageIdsFromCaptions)
      .map((id) => imageById.get(id) ?? ({ id, image_url: "" } as GenericRow))
      .filter(Boolean);

    const captionsByImage = new Map<string, GenericRow[]>();
    for (const caption of captions) {
      const imageId = getCaptionImageId(caption);
      if (!imageId) continue;
      if (!captionsByImage.has(imageId)) captionsByImage.set(imageId, []);
      captionsByImage.get(imageId)!.push(caption);
    }

    const upImageIds = new Set<string>();
    const downImageIds = new Set<string>();
    const captionById = new Map(captions.map((row) => [getCaptionId(row), row]));
    for (const vote of userVotes) {
      const caption = captionById.get(getVoteCaptionId(vote));
      if (!caption) continue;
      const imageId = getCaptionImageId(caption);
      if (!imageId) continue;
      if (getVoteValue(vote) > 0) upImageIds.add(imageId);
      if (getVoteValue(vote) < 0) downImageIds.add(imageId);
    }

    const upVotedImages = Array.from(upImageIds).map((id) => imageById.get(id) ?? ({ id } as GenericRow));
    const downVotedImages = Array.from(downImageIds).map((id) => imageById.get(id) ?? ({ id } as GenericRow));

    return {
      userCaptions,
      userVotes,
      upVotes,
      downVotes,
      createdImages,
      captionsByImage,
      upVotedImages,
      downVotedImages,
      captionById,
    };
  }, [selectedUser, captions, votes, images]);

  async function handleDeleteVote(vote: GenericRow) {
    if (!supabase) return;
    if (!selectedUser) return;
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

    setVotes((prev) =>
      prev.filter((row) => {
        const sameId = rowString(row, ["id"]) && rowString(row, ["id"]) === rowString(vote, ["id"]);
        const samePair =
          rowString(row, ["profile_id", "user_id"]) === rowString(vote, ["profile_id", "user_id"]) &&
          getVoteCaptionId(row) === getVoteCaptionId(vote);
        return !(sameId || samePair);
      })
    );
  }

  async function handleDeleteImage(image: GenericRow) {
    if (!supabase) return;
    const imageId = getImageId(image);
    if (!imageId) return;
    if (!window.confirm(`Delete image ${imageId} and related captions/votes?`)) return;

    const relatedCaptions = captions.filter((row) => getCaptionImageId(row) === imageId);
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

    setVotes((prev) => prev.filter((row) => !captionIds.includes(getVoteCaptionId(row))));
    setCaptions((prev) => prev.filter((row) => getCaptionImageId(row) !== imageId));
    setImages((prev) => prev.filter((row) => getImageId(row) !== imageId));
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">User & Meme Activity Audit</h2>
          <p className="text-sm text-slate-600">
            Search users, inspect created images and captions, analyze vote behavior, and moderate data.
          </p>
        </div>
        <button
          onClick={loadAllData}
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
          placeholder="Search Columbia email (example: mea2222@columbia.edu)"
          className="w-full border-none bg-transparent text-sm outline-none"
        />
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading users, images, captions, and vote activity...</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <aside className="max-h-[900px] overflow-auto rounded-xl border border-slate-200">
            {filteredUsers.map((user) => (
              <button
                key={user.key}
                onClick={() => setSelectedUserKey(user.key)}
                className={`w-full border-b border-slate-100 p-3 text-left hover:bg-slate-50 ${
                  selectedUserKey === user.key ? "bg-slate-100" : ""
                }`}
                type="button"
              >
                <p className="text-sm font-semibold text-slate-900">{user.name || "Unknown user"}</p>
                <p className="truncate text-xs text-slate-600">{user.email || user.id || "No identifier"}</p>
                <p className="mt-1 text-[11px] text-slate-500">Sources: {user.sources.join(", ")}</p>
              </button>
            ))}
            {!filteredUsers.length ? (
              <p className="p-3 text-sm text-slate-500">No users found for this search.</p>
            ) : null}
          </aside>

          <div className="space-y-4">
            {!selectedUser || !details ? (
              <p className="text-sm text-slate-500">Pick a user to inspect activity details.</p>
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
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Created Images + Captions</h4>
                  <p className="mb-3 text-xs text-slate-500">
                    For each image: image preview, raw image ID, and all captions attached to that meme.
                  </p>
                  {!details.createdImages.length ? (
                    <p className="text-sm text-slate-500">No created images found for this user.</p>
                  ) : (
                    <div className="space-y-3">
                      {details.createdImages.map((image) => {
                        const imageId = getImageId(image);
                        const imageUrl = getImageUrl(image);
                        const imageCaptions = details.captionsByImage.get(imageId) ?? [];
                        return (
                          <article key={imageId} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <p className="font-mono text-xs text-slate-700">Image ID: {imageId || "N/A"}</p>
                              <button
                                onClick={() => handleDeleteImage(image)}
                                className="inline-flex items-center gap-1 rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                                type="button"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete Image
                              </button>
                            </div>
                            {imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imageUrl}
                                alt={imageId || "Meme image"}
                                className="mb-2 h-48 w-full rounded-md object-cover"
                              />
                            ) : (
                              <p className="mb-2 text-xs text-slate-500">No image URL available in row data.</p>
                            )}
                            <ul className="space-y-1">
                              {imageCaptions.length ? (
                                imageCaptions.map((caption) => {
                                  const captionId = getCaptionId(caption);
                                  const captionStat = voteStatsByCaption.get(captionId);
                                  return (
                                    <li key={captionId} className="rounded-md bg-white px-2 py-1 text-xs text-slate-700">
                                      <p>
                                        <span className="font-semibold">Caption:</span> {getCaptionText(caption) || "(empty)"}
                                      </p>
                                      <p className="mt-1 text-slate-500">
                                        Caption ID: {captionId || "N/A"} | Votes: +{captionStat?.up ?? 0} / -
                                        {captionStat?.down ?? 0} (score {captionStat?.total ?? 0})
                                      </p>
                                    </li>
                                  );
                                })
                              ) : (
                                <li className="text-xs text-slate-500">No captions found for this image.</li>
                              )}
                            </ul>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Vote History (Detailed)</h4>
                  <p className="mb-3 text-xs text-slate-500">
                    Every vote by this user with vote value, target caption, associated image, and delete action.
                  </p>
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
                          {details.userVotes.map((vote) => {
                            const caption = details.captionById.get(getVoteCaptionId(vote));
                            const voteValue = getVoteValue(vote);
                            return (
                              <tr key={rowString(vote, ["id"]) || `${getVoteCaptionId(vote)}-${getTimestamp(vote)}`} className="border-b border-slate-100">
                                <td className="px-2 py-2 font-semibold text-slate-800">{voteValue}</td>
                                <td className="max-w-xl px-2 py-2 text-slate-700">{getCaptionText(caption ?? {}) || "(caption unavailable)"}</td>
                                <td className="px-2 py-2 font-mono text-slate-600">{getCaptionImageId(caption ?? {}) || "N/A"}</td>
                                <td className="px-2 py-2 text-slate-500">{getTimestamp(vote) || "N/A"}</td>
                                <td className="px-2 py-2">
                                  <button
                                    onClick={() => handleDeleteVote(vote)}
                                    className="rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                                    type="button"
                                  >
                                    Delete Vote
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
