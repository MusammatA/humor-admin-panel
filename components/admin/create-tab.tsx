"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil, RotateCcw, Trash2, Undo2, UploadCloud } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";

type Row = Record<string, unknown>;

type CreateTabProps = {
  isAdmin: boolean;
  bucketName?: string;
};

type CatalogMeme = {
  key: string;
  imageId: string;
  imageUrl: string;
  captions: Row[];
};

type UndoAction =
  | {
      type: "delete-meme";
      image: Row;
      captions: Row[];
      votes: Row[];
    }
  | {
      type: "caption-update";
      captionId: string;
      previousText: string;
    }
  | {
      type: "caption-create";
      captionId: string;
    }
  | {
      type: "image-replace";
      imageId: string;
      previousUrl: string;
    };

function str(row: Row, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function normalizeId(value: string) {
  return value.trim().toLowerCase();
}

function normalizeUrl(value: string) {
  const raw = value.trim().toLowerCase();
  if (!raw) return "";
  const withoutQuery = raw.split("?")[0]?.split("#")[0] ?? raw;
  return withoutQuery.replace(/^https?:\/\//, "").replace(/^www\./, "");
}

function getImageId(row: Row) {
  return str(row, ["id", "image_id"]);
}

function getImageUrl(row: Row) {
  return str(row, ["cdn_url", "public_url", "image_url", "url"]);
}

function getCaptionText(row: Row) {
  return str(row, ["caption_text", "text", "content", "caption", "generated_caption", "meme_text", "output"]);
}

function getCaptionId(row: Row) {
  return str(row, ["id", "caption_id"]);
}

function getCaptionImageId(row: Row) {
  return str(row, ["image_id", "imageId", "img_id", "image_uuid"]);
}

function getCaptionImageUrl(row: Row) {
  return str(row, ["image_url", "public_url", "cdn_url", "url"]);
}

function getTextColumn(row: Row): "caption_text" | "text" {
  return Object.prototype.hasOwnProperty.call(row, "caption_text") ? "caption_text" : "text";
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

function toImageUrlUpdatePayloads(url: string) {
  return [{ image_url: url }, { public_url: url }, { cdn_url: url }, { url }];
}

export function CreateTab({ isAdmin, bucketName = "images" }: CreateTabProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [images, setImages] = useState<Row[]>([]);
  const [captions, setCaptions] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"catalog" | "detail">("catalog");
  const [selectedMemeKey, setSelectedMemeKey] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [uploadCaption, setUploadCaption] = useState("");
  const [newCaption, setNewCaption] = useState("");
  const [draftByCaptionId, setDraftByCaptionId] = useState<Record<string, string>>({});
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [originalByImageId, setOriginalByImageId] = useState<Record<string, { image: Row; captions: Row[] }>>({});

  async function fetchAllRows(table: "images" | "captions", pageSize: number, maxPages: number) {
    if (!supabase) return [] as Row[];
    const all: Row[] = [];
    for (let page = 0; page < maxPages; page += 1) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error: fetchError } = await supabase.from(table).select("*").range(from, to);
      if (fetchError) throw new Error(fetchError.message);
      const rows = (data ?? []) as Row[];
      if (!rows.length) break;
      all.push(...rows);
      if (rows.length < pageSize) break;
    }
    return all;
  }

  async function loadData() {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const [imageRows, captionRows] = await Promise.all([
        fetchAllRows("images", 1000, 200),
        fetchAllRows("captions", 2000, 200),
      ]);
      setImages(imageRows);
      setCaptions(captionRows);

      setOriginalByImageId((prev) => {
        const next = { ...prev };
        for (const image of imageRows) {
          const imageId = getImageId(image);
          if (!imageId || next[imageId]) continue;
          const imageKey = normalizeId(imageId);
          next[imageId] = {
            image: { ...image },
            captions: captionRows
              .filter((row) => normalizeId(getCaptionImageId(row)) === imageKey)
              .map((row) => ({ ...row })),
          };
        }
        return next;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const catalogMemes = useMemo(() => {
    const imageById = new Map<string, Row>();
    const imageByUrl = new Map<string, Row>();
    for (const image of images) {
      const id = getImageId(image);
      const url = getImageUrl(image);
      if (id) imageById.set(normalizeId(id), image);
      if (url) imageByUrl.set(normalizeUrl(url), image);
    }

    const grouped = new Map<string, CatalogMeme>();
    for (const caption of captions) {
      const text = getCaptionText(caption);
      if (!text) continue;

      const captionImageId = getCaptionImageId(caption);
      const captionImageUrl = getCaptionImageUrl(caption);
      const byIdImage = captionImageId ? imageById.get(normalizeId(captionImageId)) : undefined;
      const byUrlImage = captionImageUrl ? imageByUrl.get(normalizeUrl(captionImageUrl)) : undefined;
      const linkedImage = byIdImage ?? byUrlImage;

      const imageId = captionImageId || getImageId(linkedImage ?? {}) || "";
      const imageUrl = getImageUrl(linkedImage ?? {}) || captionImageUrl || "";
      const key = imageId ? `id:${normalizeId(imageId)}` : `url:${normalizeUrl(imageUrl)}`;
      if (!key || key.endsWith(":")) continue;

      if (!grouped.has(key)) {
        grouped.set(key, { key, imageId, imageUrl, captions: [] });
      }
      const item = grouped.get(key)!;
      if (!item.imageId && imageId) item.imageId = imageId;
      if (!item.imageUrl && imageUrl) item.imageUrl = imageUrl;
      item.captions.push(caption);
    }

    return Array.from(grouped.values()).sort((a, b) => b.captions.length - a.captions.length);
  }, [captions, images]);

  useEffect(() => {
    if (!catalogMemes.length) {
      setSelectedMemeKey("");
      return;
    }
    if (!selectedMemeKey || !catalogMemes.some((meme) => meme.key === selectedMemeKey)) {
      setSelectedMemeKey(catalogMemes[0].key);
    }
  }, [catalogMemes, selectedMemeKey]);

  const selectedMeme = useMemo(
    () => catalogMemes.find((meme) => meme.key === selectedMemeKey) ?? null,
    [catalogMemes, selectedMemeKey],
  );

  const selectedImageId = selectedMeme?.imageId ?? "";
  const selectedImage = useMemo(() => {
    if (!selectedMeme) return null;
    if (selectedMeme.imageId) {
      const byId = images.find((row) => normalizeId(getImageId(row)) === normalizeId(selectedMeme.imageId));
      if (byId) return byId;
    }
    if (selectedMeme.imageUrl) {
      const byUrl = images.find((row) => normalizeUrl(getImageUrl(row)) === normalizeUrl(selectedMeme.imageUrl));
      if (byUrl) return byUrl;
    }
    return null;
  }, [images, selectedMeme]);

  async function resolveImageIdByUrl(url: string) {
    if (!supabase || !url) return "";
    for (const column of ["image_url", "public_url", "cdn_url", "url"]) {
      const { data, error } = await supabase
        .from("images")
        .select("id")
        .eq(column, url)
        .limit(1)
        .maybeSingle();
      if (!error && data && typeof data.id !== "undefined") {
        return String(data.id);
      }
    }
    return "";
  }

  async function createCaptionForImageId(imageId: string, captionText: string, userId: string) {
    if (!supabase || !imageId || !captionText) return false;
    for (const payload of toCaptionInsertPayload(imageId, captionText, userId)) {
      const { data, error: insertError } = await supabase.from("captions").insert(payload).select("*").maybeSingle();
      if (!insertError) {
        const createdCaptionId = data ? getCaptionId(data as Row) : "";
        if (createdCaptionId) {
          setUndoStack((prev) => [...prev, { type: "caption-create", captionId: createdCaptionId }]);
        }
        return true;
      }
    }
    return false;
  }

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
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file, { upsert: true });
    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;
    let inserted = false;
    let insertedImageId = "";
    for (const payload of toImageInsertPayload(publicUrl, userId)) {
      const { data, error: insertError } = await supabase.from("images").insert(payload).select("*").maybeSingle();
      if (!insertError) {
        inserted = true;
        insertedImageId = data ? getImageId(data as Row) : "";
        break;
      }
      const { error: fallbackInsertError } = await supabase.from("images").insert(payload);
      if (!fallbackInsertError) {
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      setError("Image uploaded to storage, but failed to write images table row.");
      return;
    }

    const trimmedUploadCaption = uploadCaption.trim();
    let captionAdded = false;
    if (trimmedUploadCaption) {
      const captionImageId = insertedImageId || (await resolveImageIdByUrl(publicUrl));
      if (captionImageId) {
        captionAdded = await createCaptionForImageId(captionImageId, trimmedUploadCaption, userId);
      }
      if (!captionImageId || !captionAdded) {
        setError("Image uploaded, but caption could not be added automatically. Open the meme and add it there.");
      }
    }

    setMessage(
      trimmedUploadCaption
        ? captionAdded
          ? "Image and caption uploaded successfully."
          : "Image uploaded successfully."
        : "Image uploaded successfully.",
    );
    setFile(null);
    setUploadCaption("");
    await loadData();
  }

  async function createCaption() {
    if (!isAdmin || !supabase || !selectedImageId || !newCaption.trim()) return;
    setError(null);
    setMessage(null);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id || "";
    for (const payload of toCaptionInsertPayload(selectedImageId, newCaption.trim(), userId)) {
      const { data, error: insertError } = await supabase.from("captions").insert(payload).select("*").maybeSingle();
      if (!insertError) {
        const createdCaptionId = data ? getCaptionId(data as Row) : "";
        if (createdCaptionId) {
          setUndoStack((prev) => [...prev, { type: "caption-create", captionId: createdCaptionId }]);
        }
        setNewCaption("");
        setMessage("Caption created.");
        await loadData();
        return;
      }
    }
    setError("Failed to create caption row with available columns.");
  }

  async function replaceImage() {
    if (!isAdmin || !supabase || !replaceFile || !selectedImageId || !selectedImage) return;
    setError(null);
    setMessage(null);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) {
      setError("Login session missing. Refresh and sign in again.");
      return;
    }

    const previousUrl = getImageUrl(selectedImage);
    const filePath = `${userId}/${Date.now()}-${replaceFile.name.replace(/\s+/g, "-")}`;
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, replaceFile, { upsert: true });
    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    const nextUrl = urlData.publicUrl;

    for (const payload of toImageUrlUpdatePayloads(nextUrl)) {
      const { error: updateError } = await supabase.from("images").update(payload).eq("id", selectedImageId);
      if (!updateError) {
        setUndoStack((prev) => [...prev, { type: "image-replace", imageId: selectedImageId, previousUrl }]);
        setReplaceFile(null);
        setMessage("Image replaced.");
        await loadData();
        return;
      }
    }
    setError("Failed to replace image URL in images table.");
  }

  async function updateCaption(caption: Row) {
    if (!isAdmin || !supabase) return;
    const captionId = getCaptionId(caption);
    if (!captionId) return;

    const current = getCaptionText(caption);
    const next = (draftByCaptionId[captionId] ?? current).trim();
    if (!next || next === current) return;

    for (const payload of [{ caption_text: next }, { text: next }]) {
      const { error: updateError } = await supabase.from("captions").update(payload).eq("id", captionId);
      if (!updateError) {
        setUndoStack((prev) => [...prev, { type: "caption-update", captionId, previousText: current }]);
        setMessage("Caption updated.");
        await loadData();
        return;
      }
    }
    setError("Failed to update caption.");
  }

  async function deleteCaption(caption: Row) {
    if (!isAdmin || !supabase) return;
    const captionId = getCaptionId(caption);
    if (!captionId) return;
    const { error: deleteError } = await supabase.from("captions").delete().eq("id", captionId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setMessage("Caption deleted.");
    await loadData();
  }

  async function deleteMeme(imageId: string) {
    if (!isAdmin || !supabase || !imageId) return;
    if (!window.confirm("Delete this meme image and related captions/votes?")) return;

    const imageRow = images.find((row) => normalizeId(getImageId(row)) === normalizeId(imageId));
    if (!imageRow) {
      setError("Cannot delete this meme because no image row with that ID was found.");
      return;
    }

    const relatedCaptions = captions.filter((row) => normalizeId(getCaptionImageId(row)) === normalizeId(imageId));
    const captionIds = relatedCaptions.map((row) => getCaptionId(row)).filter(Boolean);

    const { data: relatedVotes } = captionIds.length
      ? await supabase.from("caption_votes").select("*").in("caption_id", captionIds)
      : { data: [] as Row[] };

    if (captionIds.length) {
      const { error: voteDeleteError } = await supabase.from("caption_votes").delete().in("caption_id", captionIds);
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

    setUndoStack((prev) => [
      ...prev,
      {
        type: "delete-meme",
        image: { ...imageRow },
        captions: relatedCaptions.map((row) => ({ ...row })),
        votes: ((relatedVotes ?? []) as Row[]).map((row) => ({ ...row })),
      },
    ]);

    setMessage("Meme deleted. You can undo this action.");
    setViewMode("catalog");
    await loadData();
  }

  async function resetSelectedMeme() {
    if (!isAdmin || !supabase || !selectedImageId) return;
    const original = originalByImageId[selectedImageId];
    if (!original) {
      setError("No original snapshot available for this meme yet.");
      return;
    }

    const originalUrl = getImageUrl(original.image);
    if (originalUrl) {
      for (const payload of toImageUrlUpdatePayloads(originalUrl)) {
        const { error: updateError } = await supabase.from("images").update(payload).eq("id", selectedImageId);
        if (!updateError) break;
      }
    }

    const currentForImage = captions.filter((row) => normalizeId(getCaptionImageId(row)) === normalizeId(selectedImageId));
    const originalById = new Map(original.captions.map((row) => [getCaptionId(row), row]));
    const currentById = new Map(currentForImage.map((row) => [getCaptionId(row), row]));

    const toDelete = currentForImage.filter((row) => {
      const id = getCaptionId(row);
      return Boolean(id) && !originalById.has(id);
    });

    if (toDelete.length) {
      const ids = toDelete.map((row) => getCaptionId(row)).filter(Boolean);
      await supabase.from("captions").delete().in("id", ids);
    }

    for (const [originalId, originalCaption] of originalById.entries()) {
      const text = getCaptionText(originalCaption);
      if (!text) continue;
      if (currentById.has(originalId)) {
        const textColumn = getTextColumn(originalCaption);
        await supabase.from("captions").update({ [textColumn]: text }).eq("id", originalId);
      } else {
        for (const payload of [{ image_id: selectedImageId, caption_text: text }, { image_id: selectedImageId, text }]) {
          const { error: insertError } = await supabase.from("captions").insert(payload);
          if (!insertError) break;
        }
      }
    }

    setMessage("Selected meme reset to original image and captions.");
    await loadData();
  }

  async function undoLastAction() {
    if (!isAdmin || !supabase || undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];

    if (action.type === "caption-create") {
      const { error: deleteError } = await supabase.from("captions").delete().eq("id", action.captionId);
      if (deleteError) return setError(deleteError.message);
      setUndoStack((prev) => prev.slice(0, -1));
      setMessage("Undid caption creation.");
      await loadData();
      return;
    }

    if (action.type === "caption-update") {
      for (const payload of [{ caption_text: action.previousText }, { text: action.previousText }]) {
        const { error: updateError } = await supabase.from("captions").update(payload).eq("id", action.captionId);
        if (!updateError) {
          setUndoStack((prev) => prev.slice(0, -1));
          setMessage("Undid caption update.");
          await loadData();
          return;
        }
      }
      return setError("Failed to undo caption update.");
    }

    if (action.type === "image-replace") {
      for (const payload of toImageUrlUpdatePayloads(action.previousUrl)) {
        const { error: updateError } = await supabase.from("images").update(payload).eq("id", action.imageId);
        if (!updateError) {
          setUndoStack((prev) => prev.slice(0, -1));
          setMessage("Undid image replacement.");
          await loadData();
          return;
        }
      }
      return setError("Failed to undo image replacement.");
    }

    const { error: imageInsertError } = await supabase.from("images").insert(action.image);
    if (imageInsertError) return setError(imageInsertError.message);

    if (action.captions.length) {
      const { error: captionsInsertError } = await supabase.from("captions").insert(action.captions);
      if (captionsInsertError) return setError(captionsInsertError.message);
    }

    if (action.votes.length) {
      const { error: votesInsertError } = await supabase.from("caption_votes").insert(action.votes);
      if (votesInsertError) return setError(votesInsertError.message);
    }

    setUndoStack((prev) => prev.slice(0, -1));
    setMessage("Undid meme deletion.");
    await loadData();
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Create</h1>
        <p className="mt-2 text-sm text-slate-600">
          {isAdmin
            ? "Open a meme from the catalog to manage all captions, replace image media, and moderate quickly."
            : "Browse the meme catalog and open a meme to read all caption text."}
        </p>
      </header>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
      ) : null}

      {isAdmin && viewMode === "catalog" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Upload Picture + Caption</h2>
          <input
            type="file"
            className="mt-3 w-full text-sm"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <textarea
            value={uploadCaption}
            onChange={(event) => setUploadCaption(event.target.value)}
            placeholder="Optional: write a caption to attach to this uploaded image"
            className="mt-3 min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={uploadImage}
              disabled={!file}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <UploadCloud className="h-4 w-4" />
              Upload{uploadCaption.trim() ? " + Add Caption" : ""}
            </button>
            <button
              type="button"
              onClick={undoLastAction}
              disabled={undoStack.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Undo2 className="h-4 w-4" />
              Undo Last Action
            </button>
          </div>
        </section>
      ) : null}

      {viewMode === "catalog" ? (
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
              {catalogMemes.map((meme) => {
                const imageId = meme.imageId || "No image_id";
                const imageUrl = meme.imageUrl;
                const captionCount = meme.captions.length;
                return (
                  <article key={meme.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-slate-400">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMemeKey(meme.key);
                        setViewMode("detail");
                      }}
                      className="w-full text-left"
                      aria-label={`Open meme ${meme.key}`}
                    >
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <div className="flex h-56 w-full items-center justify-center rounded-lg bg-white p-2">
                          <img src={imageUrl} alt={imageId} className="h-full w-full rounded object-contain" />
                        </div>
                      ) : (
                        <div className="flex h-56 w-full items-center justify-center rounded-lg bg-slate-200 text-xs text-slate-600">
                          No image preview
                        </div>
                      )}
                      <p className="mt-2 truncate font-mono text-xs text-slate-700">{imageId}</p>
                      <p className="mt-1 text-xs text-slate-600">{captionCount} caption{captionCount === 1 ? "" : "s"}</p>
                      <p className="mt-2 text-xs font-semibold text-slate-900 underline">Open details</p>
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setViewMode("catalog")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Catalog
            </button>
            <button
              type="button"
              onClick={loadData}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          {!selectedMeme ? (
            <p className="text-sm text-slate-500">No meme selected.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {selectedMeme.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <div className="flex h-72 w-full items-center justify-center rounded-lg bg-white p-2">
                      <img src={selectedMeme.imageUrl} alt={selectedMeme.imageId || selectedMeme.key} className="h-full w-full rounded object-contain" />
                    </div>
                  ) : (
                    <div className="flex h-72 w-full items-center justify-center rounded-lg bg-slate-200 text-xs text-slate-600">
                      No image preview
                    </div>
                  )}
                  <p className="mt-2 truncate font-mono text-xs text-slate-700">Image ID: {selectedImageId || "URL-only group"}</p>
                  <p className="text-xs text-slate-600">Captions: {selectedMeme.captions.length}</p>
                </article>

                {isAdmin ? (
                  <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <h3 className="text-sm font-semibold text-slate-900">Admin Actions</h3>
                    <textarea
                      value={newCaption}
                      onChange={(event) => setNewCaption(event.target.value)}
                      placeholder="Write a new caption for this meme"
                      className="mt-3 min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={createCaption}
                        disabled={!selectedImageId}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        <Pencil className="h-4 w-4" />
                        Add Caption
                      </button>
                      <button
                        type="button"
                        onClick={undoLastAction}
                        disabled={undoStack.length === 0}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Undo2 className="h-4 w-4" />
                        Undo
                      </button>
                      <button
                        type="button"
                        onClick={resetSelectedMeme}
                        disabled={!selectedImageId}
                        className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reset Meme
                      </button>
                    </div>

                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <label className="text-sm font-medium text-slate-800">Replace Image</label>
                      <input type="file" className="mt-2 w-full text-sm" onChange={(event) => setReplaceFile(event.target.files?.[0] ?? null)} />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={replaceImage}
                          disabled={!selectedImageId || !replaceFile}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <UploadCloud className="h-4 w-4" />
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMeme(selectedImageId)}
                          disabled={!selectedImageId}
                          className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Meme
                        </button>
                      </div>
                    </div>
                  </article>
                ) : null}
              </div>

              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <h3 className="text-sm font-semibold text-slate-900">All Captions</h3>
                <div className="mt-2 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                  {selectedMeme.captions.length === 0 ? (
                    <p className="text-xs text-slate-500">No captions found.</p>
                  ) : (
                    selectedMeme.captions.map((caption, index) => {
                      const captionId = getCaptionId(caption);
                      const currentText = getCaptionText(caption);
                      const draft = draftByCaptionId[captionId] ?? currentText;
                      return (
                        <div key={captionId || `${selectedMeme.key}-caption-${index}`} className="rounded border border-slate-200 bg-white p-2 text-xs text-slate-700">
                          {isAdmin ? (
                            <>
                              <textarea
                                value={draft}
                                onChange={(event) => setDraftByCaptionId((prev) => ({ ...prev, [captionId]: event.target.value }))}
                                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                              />
                              <div className="mt-1 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => updateCaption(caption)}
                                  className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDraftByCaptionId((prev) => ({ ...prev, [captionId]: currentText }))}
                                  className="rounded border border-amber-300 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
                                >
                                  Revert Draft
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteCaption(caption)}
                                  className="rounded border border-rose-300 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50"
                                >
                                  Delete
                                </button>
                              </div>
                            </>
                          ) : (
                            <span>{currentText}</span>
                          )}
                          {captionId ? <p className="mt-1 font-mono text-[10px] text-slate-500">Caption ID: {captionId}</p> : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </article>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
