"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, UploadCloud } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";

type Row = Record<string, unknown>;

type CreateTabProps = {
  isAdmin: boolean;
  bucketName?: string;
};

function str(row: Row, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function getImageId(row: Row) {
  return str(row, ["id", "image_id"]);
}

function getImageUrl(row: Row) {
  return str(row, ["cdn_url", "public_url", "image_url", "url"]);
}

function getCaptionText(row: Row) {
  return str(row, ["caption_text", "text", "content", "caption"]);
}

function getCaptionId(row: Row) {
  return str(row, ["id", "caption_id"]);
}

function toImageInsertPayload(publicUrl: string, userId: string) {
  return [
    { image_url: publicUrl, user_id: userId },
    { public_url: publicUrl, user_id: userId },
    { cdn_url: publicUrl, user_id: userId },
    { image_url: publicUrl },
    { public_url: publicUrl },
  ];
}

function toCaptionInsertPayload(imageId: string, text: string, userId: string) {
  return [
    { image_id: imageId, user_id: userId, caption_text: text },
    { image_id: imageId, user_id: userId, text },
    { image_id: imageId, caption_text: text },
    { image_id: imageId, text },
  ];
}

export function CreateTab({ isAdmin, bucketName = "images" }: CreateTabProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [images, setImages] = useState<Row[]>([]);
  const [captions, setCaptions] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [newCaption, setNewCaption] = useState("");
  const [targetImageId, setTargetImageId] = useState("");

  async function loadData() {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [imagesRes, captionsRes] = await Promise.all([
      supabase.from("images").select("*").limit(5000),
      supabase.from("captions").select("*").limit(10000),
    ]);
    const firstError = imagesRes.error || captionsRes.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    const imageRows = (imagesRes.data ?? []) as Row[];
    setImages(imageRows);
    setCaptions((captionsRes.data ?? []) as Row[]);
    if (!targetImageId && imageRows[0]) {
      setTargetImageId(getImageId(imageRows[0]));
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const captionsByImage = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const caption of captions) {
      const imageId = str(caption, ["image_id"]);
      if (!imageId) continue;
      if (!map.has(imageId)) map.set(imageId, []);
      map.get(imageId)!.push(caption);
    }
    return map;
  }, [captions]);

  async function uploadImage() {
    if (!isAdmin || !supabase || !file) return;
    setError(null);
    setMessage(null);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) {
      setError("Login session missing. Refresh and sign in again.");
      return;
    }

    const filePath = `${userId}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file, {
      upsert: true,
    });
    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;
    let inserted = false;
    for (const payload of toImageInsertPayload(publicUrl, userId)) {
      const { error: insertError } = await supabase.from("images").insert(payload);
      if (!insertError) {
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      setError("Image uploaded to storage, but failed to write images table row.");
      return;
    }

    setMessage("Image uploaded successfully.");
    setFile(null);
    await loadData();
  }

  async function createCaption() {
    if (!isAdmin || !supabase || !targetImageId || !newCaption.trim()) return;
    setError(null);
    setMessage(null);
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id || "";
    let inserted = false;
    for (const payload of toCaptionInsertPayload(targetImageId, newCaption.trim(), userId)) {
      const { error: insertError } = await supabase.from("captions").insert(payload);
      if (!insertError) {
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      setError("Failed to create caption row with available columns.");
      return;
    }
    setNewCaption("");
    setMessage("Caption created.");
    await loadData();
  }

  async function deleteMeme(imageId: string) {
    if (!isAdmin || !supabase) return;
    if (!window.confirm("Delete this meme image and related captions/votes?")) return;
    const captionIds = captions
      .filter((row) => str(row, ["image_id"]) === imageId)
      .map((row) => getCaptionId(row))
      .filter(Boolean);

    if (captionIds.length) {
      const { error: voteDeleteError } = await supabase
        .from("caption_votes")
        .delete()
        .in("caption_id", captionIds);
      if (voteDeleteError) {
        setError(voteDeleteError.message);
        return;
      }
    }
    const { error: captionDeleteError } = await supabase.from("captions").delete().eq("image_id", imageId);
    if (captionDeleteError) {
      setError(captionDeleteError.message);
      return;
    }
    const { error: imageDeleteError } = await supabase.from("images").delete().eq("id", imageId);
    if (imageDeleteError) {
      setError(imageDeleteError.message);
      return;
    }
    setMessage("Meme deleted.");
    await loadData();
  }

  async function editCaption(caption: Row) {
    if (!isAdmin || !supabase) return;
    const current = getCaptionText(caption);
    const next = window.prompt("Edit caption text", current);
    if (next == null || next.trim() === current) return;
    const captionId = getCaptionId(caption);
    if (!captionId) return;
    const payloads = [{ caption_text: next.trim() }, { text: next.trim() }];
    for (const payload of payloads) {
      const { error: updateError } = await supabase.from("captions").update(payload).eq("id", captionId);
      if (!updateError) {
        setMessage("Caption updated.");
        await loadData();
        return;
      }
    }
    setError("Failed to update caption.");
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Create</h1>
        <p className="mt-2 text-sm text-slate-600">
          {isAdmin
            ? "Upload pictures, add captions, and manage existing memes."
            : "View meme catalog. Admin privileges are required for edits and deletes."}
        </p>
      </header>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
      ) : null}

      {isAdmin ? (
        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Upload Picture</h2>
            <input
              type="file"
              className="mt-3 w-full text-sm"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={uploadImage}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <UploadCloud className="h-4 w-4" />
              Upload
            </button>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Create Caption</h2>
            <select
              value={targetImageId}
              onChange={(event) => setTargetImageId(event.target.value)}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {images.map((img) => {
                const id = getImageId(img);
                return (
                  <option key={id} value={id}>
                    {id || "Unknown image id"}
                  </option>
                );
              })}
            </select>
            <textarea
              value={newCaption}
              onChange={(event) => setNewCaption(event.target.value)}
              placeholder="Write caption text"
              className="mt-3 min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm"
            />
            <button
              type="button"
              onClick={createCaption}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Pencil className="h-4 w-4" />
              Create Caption
            </button>
          </article>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Meme Catalog</h2>
          <button
            type="button"
            onClick={loadData}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Loading memes...</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {images.map((image) => {
              const imageId = getImageId(image);
              const imageUrl = getImageUrl(image);
              const imageCaptions = captionsByImage.get(imageId) ?? [];
              return (
                <article key={imageId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt={imageId} className="h-48 w-full rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-48 w-full items-center justify-center rounded-lg bg-slate-200 text-xs text-slate-600">
                      No image preview
                    </div>
                  )}
                  <p className="mt-2 truncate font-mono text-xs text-slate-600">{imageId}</p>
                  <ul className="mt-2 space-y-1">
                    {imageCaptions.slice(0, 4).map((caption) => (
                      <li key={getCaptionId(caption)} className="rounded bg-white px-2 py-1 text-xs text-slate-700">
                        {getCaptionText(caption)}
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => editCaption(caption)}
                            className="ml-2 text-slate-500 underline"
                          >
                            edit
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => deleteMeme(imageId)}
                      className="mt-3 inline-flex items-center gap-1 rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Meme
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
