import type { ImageRecord } from "../../types";
import { deleteStorageObjectByPublicUrl } from "../supabase-storage";
import { getCurrentUserIdOrThrow, getSupabaseBrowserClientOrThrow } from "./client";

function sanitizeFileName(fileName: string) {
  return fileName.replace(/\s+/g, "-");
}

function toImageInsertPayloads(publicUrl: string, userId: string) {
  return [
    { image_url: publicUrl, user_id: userId },
    { public_url: publicUrl, user_id: userId },
    { cdn_url: publicUrl, user_id: userId },
    { image_url: publicUrl },
    { public_url: publicUrl },
  ];
}

function toImageUrlUpdatePayloads(url: string) {
  return [{ image_url: url }, { public_url: url }, { cdn_url: url }, { url }];
}

export async function fetchAllImages(pageSize = 1000, maxPages = 200) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const all: ImageRecord[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from("images").select("*").range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as ImageRecord[];
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
  }

  return all;
}

export async function resolveImageIdByUrl(url: string) {
  if (!url) return "";

  const supabase = getSupabaseBrowserClientOrThrow();
  for (const column of ["image_url", "public_url", "cdn_url", "url"]) {
    const { data, error } = await supabase.from("images").select("id").eq(column, url).limit(1).maybeSingle();
    if (!error && data && typeof data.id !== "undefined") {
      return String(data.id);
    }
  }

  return "";
}

export async function addImage(params: { file: File; bucketName?: string }) {
  const { file, bucketName = "images" } = params;
  const supabase = getSupabaseBrowserClientOrThrow();
  const userId = await getCurrentUserIdOrThrow();
  const filePath = `${userId}/${Date.now()}-${sanitizeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file, { upsert: true });
  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
  const publicUrl = urlData.publicUrl;
  let imageId = "";
  let inserted = false;

  for (const payload of toImageInsertPayloads(publicUrl, userId)) {
    const { data, error } = await supabase.from("images").insert(payload).select("*").maybeSingle();
    if (!error) {
      inserted = true;
      imageId = data?.id ? String(data.id) : "";
      break;
    }

    const { error: fallbackInsertError } = await supabase.from("images").insert(payload);
    if (!fallbackInsertError) {
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    throw new Error("Image uploaded to storage, but failed to write images table row.");
  }

  if (!imageId) {
    imageId = await resolveImageIdByUrl(publicUrl);
  }

  return { imageId, publicUrl, filePath, userId };
}

export async function updateImageUrl(imageId: string, url: string) {
  if (!imageId || !url) {
    throw new Error("Image id and URL are required.");
  }

  const supabase = getSupabaseBrowserClientOrThrow();

  for (const payload of toImageUrlUpdatePayloads(url)) {
    const { error } = await supabase.from("images").update(payload).eq("id", imageId);
    if (!error) {
      return;
    }
  }

  throw new Error("Failed to replace image URL in images table.");
}

export async function updateImage(params: { imageId: string; file: File; bucketName?: string }) {
  const { imageId, file, bucketName = "images" } = params;
  const supabase = getSupabaseBrowserClientOrThrow();
  const userId = await getCurrentUserIdOrThrow();
  const filePath = `${userId}/${Date.now()}-${sanitizeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file, { upsert: true });
  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
  const publicUrl = urlData.publicUrl;
  await updateImageUrl(imageId, publicUrl);

  return { publicUrl, filePath, userId };
}

export async function deleteImage(params: {
  imageId: string;
  imageUrl: string;
  bucketName?: string;
  captionIds?: string[];
}) {
  const { imageId, imageUrl, bucketName = "images", captionIds = [] } = params;
  const supabase = getSupabaseBrowserClientOrThrow();

  if (captionIds.length) {
    const { error: voteDeleteError } = await supabase.from("caption_votes").delete().in("caption_id", captionIds);
    if (voteDeleteError) {
      throw new Error(voteDeleteError.message);
    }
  }

  const { error: captionDeleteError } = await supabase.from("captions").delete().eq("image_id", imageId);
  if (captionDeleteError) {
    throw new Error(captionDeleteError.message);
  }

  const { error: imageDeleteError } = await supabase.from("images").delete().eq("id", imageId);
  if (imageDeleteError) {
    throw new Error(imageDeleteError.message);
  }

  const { error: storageDeleteError, ref } = await deleteStorageObjectByPublicUrl(supabase, imageUrl, bucketName);

  return {
    storageWarning: storageDeleteError
      ? `Deleted image row ${imageId}, but failed to remove storage object ${ref?.path ?? imageUrl}: ${storageDeleteError.message}`
      : "",
  };
}
