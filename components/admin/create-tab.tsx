"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, RotateCcw, Trash2, Undo2, UploadCloud } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";

type Row = Record<string, unknown>;

type CreateTabProps = {
  isAdmin: boolean;
  bucketName?: string;
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

  const [file, setFile] = useState<File | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [newCaption, setNewCaption] = useState("");
  const [selectedImageId, setSelectedImageId] = useState("");
  const [draftByCaptionId, setDraftByCaptionId] = useState<Record<string, string>>({});
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [originalByImageId, setOriginalByImageId] = useState<Record<string, { image: Row; captions: Row[] }>>({});

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
    const captionRows = (captionsRes.data ?? []) as Row[];
    setImages(imageRows);
    setCaptions(captionRows);

    if (!selectedImageId && imageRows[0]) {
      setSelectedImageId(getImageId(imageRows[0]));
    }

    setOriginalByImageId((prev) => {
      const next = { ...prev };
      for (const image of imageRows) {
        const imageId = getImageId(image);
        if (!imageId || next[imageId]) continue;
        next[imageId] = {
          image: { ...image },
          captions: captionRows.filter((row) => str(row, ["image_id"]) === imageId).map((row) => ({ ...row })),
        };
      }
      return next;
    });

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

  const selectedImage = useMemo(
    () => images.find((row) => getImageId(row) === selectedImageId) ?? null,
    [images, selectedImageId],
  );

  const selectedCaptions = useMemo(() => captionsByImage.get(selectedImageId) ?? [], [captionsByImage, selectedImageId]);

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
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, replaceFile, {
      upsert: true,
    });
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

    const payloads = [{ caption_text: next }, { text: next }];
    for (const payload of payloads) {
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
    if (!isAdmin || !supabase) return;
    if (!window.confirm("Delete this meme image and related captions/votes?")) return;
    setError(null);
    setMessage(null);

    const imageRow = images.find((row) => getImageId(row) === imageId);
    if (!imageRow) return;

    const relatedCaptions = captions.filter((row) => str(row, ["image_id"]) === imageId);
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

    if (selectedImageId === imageId) {
      setSelectedImageId("");
    }

    setMessage("Meme deleted. You can undo this action.");
    await loadData();
  }

  async function resetSelectedMeme() {
    if (!isAdmin || !supabase || !selectedImageId) return;
    const original = originalByImageId[selectedImageId];
    if (!original) {
      setError("No original snapshot available for this meme yet.");
      return;
    }

    setError(null);
    setMessage(null);

    const originalUrl = getImageUrl(original.image);
    if (originalUrl) {
      for (const payload of toImageUrlUpdatePayloads(originalUrl)) {
        const { error: updateError } = await supabase.from("images").update(payload).eq("id", selectedImageId);
        if (!updateError) break;
      }
    }

    const currentForImage = captions.filter((row) => str(row, ["image_id"]) === selectedImageId);
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
        const payloads = [{ image_id: selectedImageId, caption_text: text }, { image_id: selectedImageId, text }];
        for (const payload of payloads) {
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
    setError(null);
    setMessage(null);

    if (action.type === "caption-create") {
      const { error: deleteError } = await supabase.from("captions").delete().eq("id", action.captionId);
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
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
      setError("Failed to undo caption update.");
      return;
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
      setError("Failed to undo image replacement.");
      return;
    }

    if (action.type === "delete-meme") {
      const { error: imageInsertError } = await supabase.from("images").insert(action.image);
      if (imageInsertError) {
        setError(imageInsertError.message);
        return;
      }

      if (action.captions.length) {
        const { error: captionsInsertError } = await supabase.from("captions").insert(action.captions);
        if (captionsInsertError) {
          setError(captionsInsertError.message);
          return;
        }
      }

      if (action.votes.length) {
        const { error: votesInsertError } = await supabase.from("caption_votes").insert(action.votes);
        if (votesInsertError) {
          setError(votesInsertError.message);
          return;
        }
      }

      setUndoStack((prev) => prev.slice(0, -1));
      setMessage("Undid meme deletion.");
      await loadData();
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Create</h1>
        <p className="mt-2 text-sm text-slate-600">
          {isAdmin
            ? "Click an image to edit its caption words, replace image media, delete, undo, or reset to original."
            : "Browse the meme catalog and read caption text. Admin privileges are required for changes."}
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
            <h2 className="text-lg font-semibold text-slate-900">Selected Meme Editor</h2>
            <p className="mt-2 text-xs text-slate-500">
              Captions are editable free-form series of words. Select an image card below to target that meme.
            </p>
            <p className="mt-2 rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
              Selected image ID: {selectedImageId || "None"}
            </p>
            <textarea
              value={newCaption}
              onChange={(event) => setNewCaption(event.target.value)}
              placeholder="Write a new caption for the selected meme"
              className="mt-3 min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm"
            />
            <div className="mt-3 flex flex-wrap gap-2">
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
                Undo Last Action
              </button>
              <button
                type="button"
                onClick={resetSelectedMeme}
                disabled={!selectedImageId}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                Reset Selected Meme
              </button>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <label className="text-sm font-medium text-slate-800">Replace Selected Image</label>
              <input
                type="file"
                className="mt-2 w-full text-sm"
                onChange={(event) => setReplaceFile(event.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={replaceImage}
                disabled={!selectedImageId || !replaceFile}
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UploadCloud className="h-4 w-4" />
                Replace Image
              </button>
            </div>
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
              const isSelected = imageId === selectedImageId;

              return (
                <article
                  key={imageId}
                  className={`rounded-xl border p-3 ${
                    isSelected
                      ? "border-slate-900 bg-slate-100 shadow-sm"
                      : "border-slate-200 bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedImageId(imageId)}
                    className="w-full text-left"
                    aria-label={`Select meme ${imageId}`}
                  >
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt={imageId} className="h-48 w-full rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-48 w-full items-center justify-center rounded-lg bg-slate-200 text-xs text-slate-600">
                        No image preview
                      </div>
                    )}
                    <p className="mt-2 truncate font-mono text-xs text-slate-700">{imageId}</p>
                    {isSelected ? <p className="mt-1 text-xs font-semibold text-slate-900">Selected for editing</p> : null}
                  </button>

                  <ul className="mt-2 space-y-1">
                    {imageCaptions.length === 0 ? (
                      <li className="rounded bg-white px-2 py-1 text-xs text-slate-500">No captions yet.</li>
                    ) : (
                      imageCaptions.map((caption) => {
                        const captionId = getCaptionId(caption);
                        const currentText = getCaptionText(caption);
                        const draft = draftByCaptionId[captionId] ?? currentText;
                        return (
                          <li key={captionId} className="rounded bg-white px-2 py-2 text-xs text-slate-700">
                            {isAdmin ? (
                              <>
                                <textarea
                                  value={draft}
                                  onChange={(event) =>
                                    setDraftByCaptionId((prev) => ({ ...prev, [captionId]: event.target.value }))
                                  }
                                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                                />
                                <div className="mt-1 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => updateCaption(caption)}
                                    className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    Save Caption
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDraftByCaptionId((prev) => ({ ...prev, [captionId]: currentText }))
                                    }
                                    className="rounded border border-amber-300 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
                                  >
                                    Revert Draft
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteCaption(caption)}
                                    className="rounded border border-rose-300 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50"
                                  >
                                    Delete Caption
                                  </button>
                                </div>
                              </>
                            ) : (
                              <span>{currentText}</span>
                            )}
                          </li>
                        );
                      })
                    )}
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
