import type { Caption } from "../../types";
import { getSupabaseBrowserClientOrThrow } from "./client";

function toCaptionInsertPayloads(imageId: string, text: string, userId?: string) {
  if (userId) {
    return [
      { image_id: imageId, user_id: userId, caption_text: text },
      { image_id: imageId, user_id: userId, text },
      { image_id: imageId, caption_text: text },
      { image_id: imageId, text },
    ];
  }

  return [{ image_id: imageId, caption_text: text }, { image_id: imageId, text }];
}

function toCaptionUpdatePayloads(text: string) {
  return [{ caption_text: text }, { text }];
}

export async function fetchCaptions() {
  const supabase = getSupabaseBrowserClientOrThrow();
  const { data, error } = await supabase.from("captions").select("*");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Caption[];
}

export async function fetchAllCaptions(pageSize = 2000, maxPages = 200) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const all: Caption[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from("captions").select("*").range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as Caption[];
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
  }

  return all;
}

export async function createCaptionRecord(params: { imageId: string; text: string; userId?: string }) {
  const { imageId, text, userId } = params;
  const trimmed = text.trim();

  if (!imageId || !trimmed) {
    throw new Error("Image ID and caption text are required.");
  }

  const supabase = getSupabaseBrowserClientOrThrow();

  for (const payload of toCaptionInsertPayloads(imageId, trimmed, userId)) {
    const { data, error } = await supabase.from("captions").insert(payload).select("*").maybeSingle();
    if (!error) {
      return (data ?? null) as Caption | null;
    }
  }

  throw new Error("Failed to create caption row with available columns.");
}

export async function updateCaptionText(captionId: string, text: string) {
  const trimmed = text.trim();
  if (!captionId || !trimmed) {
    throw new Error("Caption id and text are required.");
  }

  const supabase = getSupabaseBrowserClientOrThrow();

  for (const payload of toCaptionUpdatePayloads(trimmed)) {
    const { error } = await supabase.from("captions").update(payload).eq("id", captionId);
    if (!error) {
      return;
    }
  }

  throw new Error("Failed to update caption.");
}

export async function deleteCaptionById(captionId: string) {
  if (!captionId) {
    throw new Error("Caption id is required.");
  }

  const supabase = getSupabaseBrowserClientOrThrow();
  const { error } = await supabase.from("captions").delete().eq("id", captionId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteCaptionsByIds(captionIds: string[]) {
  if (!captionIds.length) return;

  const supabase = getSupabaseBrowserClientOrThrow();
  const { error } = await supabase.from("captions").delete().in("id", captionIds);

  if (error) {
    throw new Error(error.message);
  }
}
