import type { Profile } from "../../types";
import {
  ADMIN_AVATAR_URL_METADATA_KEY,
  ADMIN_THEME_METADATA_KEY,
  ADMIN_USERNAME_METADATA_KEY,
  type AdminTheme,
} from "../admin-preferences";
import { deleteStorageObjectByPublicUrl } from "../supabase-storage";
import { getCurrentUserIdOrThrow, getSupabaseBrowserClientOrThrow, MISSING_SESSION_MESSAGE } from "./client";

type AccountCounts = {
  images: number;
  captions: number;
  upvotes: number;
  downvotes: number;
};

type AccountSnapshot = {
  user: {
    id: string;
    email: string;
    userMetadata: Record<string, unknown>;
  };
  profile: Profile | null;
  counts: AccountCounts;
};

function sanitizeFileName(fileName: string) {
  return fileName.replace(/\s+/g, "-");
}

function toUserMetadata(user: { user_metadata?: Record<string, unknown> | null }) {
  return user.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};
}

async function countRowsByUser(tableName: string, userId: string, columns: string[]) {
  const supabase = getSupabaseBrowserClientOrThrow();

  for (const column of columns) {
    const { count, error } = await supabase.from(tableName).select("*", { count: "exact", head: true }).eq(column, userId);
    if (!error) {
      return count ?? 0;
    }
  }

  return 0;
}

async function countVotesByDirection(userId: string, direction: "up" | "down") {
  const supabase = getSupabaseBrowserClientOrThrow();
  const base = supabase.from("caption_votes").select("*", { count: "exact", head: true }).eq("profile_id", userId);
  const { count, error } = direction === "up" ? await base.gt("vote_value", 0) : await base.lt("vote_value", 0);
  if (error) {
    return 0;
  }
  return count ?? 0;
}

export async function fetchAccountSnapshot(): Promise<AccountSnapshot> {
  const supabase = getSupabaseBrowserClientOrThrow();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    throw new Error(MISSING_SESSION_MESSAGE);
  }

  const [profileRes, imageCount, captionCount, upvotes, downvotes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    countRowsByUser("images", user.id, ["profile_id", "user_id"]),
    countRowsByUser("captions", user.id, ["profile_id", "user_id"]),
    countVotesByDirection(user.id, "up"),
    countVotesByDirection(user.id, "down"),
  ]);

  return {
    user: {
      id: user.id,
      email: user.email || "",
      userMetadata: toUserMetadata(user),
    },
    profile: (profileRes.data ?? null) as Profile | null,
    counts: {
      images: imageCount,
      captions: captionCount,
      upvotes,
      downvotes,
    },
  };
}

export async function updateAdminTheme(theme: AdminTheme) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(MISSING_SESSION_MESSAGE);
  }

  const currentMetadata = toUserMetadata(user);
  const { data, error } = await supabase.auth.updateUser({
    data: {
      ...currentMetadata,
      [ADMIN_THEME_METADATA_KEY]: theme,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data.user ?? user;
}

export async function updateAdminProfile(params: { username: string; avatarUrl?: string }) {
  const { username, avatarUrl } = params;
  const supabase = getSupabaseBrowserClientOrThrow();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(MISSING_SESSION_MESSAGE);
  }

  const currentMetadata = toUserMetadata(user);
  const nextMetadata: Record<string, unknown> = {
    ...currentMetadata,
    [ADMIN_USERNAME_METADATA_KEY]: username,
  };

  if (typeof avatarUrl !== "undefined") {
    nextMetadata[ADMIN_AVATAR_URL_METADATA_KEY] = avatarUrl;
  }

  const { data, error } = await supabase.auth.updateUser({ data: nextMetadata });

  if (error) {
    throw new Error(error.message);
  }

  return data.user ?? user;
}

export async function uploadProfileAvatar(params: {
  file: File;
  previousAvatarUrl?: string;
  bucketName?: string;
}) {
  const { file, previousAvatarUrl = "", bucketName = "images" } = params;
  const supabase = getSupabaseBrowserClientOrThrow();
  const userId = await getCurrentUserIdOrThrow();
  const filePath = `profile-avatars/${userId}/${Date.now()}-${sanitizeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file, { upsert: true });
  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
  const publicUrl = urlData.publicUrl;

  let storageWarning = "";
  if (previousAvatarUrl && previousAvatarUrl !== publicUrl) {
    const { error: deleteError, ref } = await deleteStorageObjectByPublicUrl(supabase, previousAvatarUrl, bucketName);
    if (deleteError) {
      storageWarning = `Uploaded new photo, but could not remove old file ${ref?.path ?? previousAvatarUrl}: ${deleteError.message}`;
    }
  }

  return { publicUrl, filePath, userId, storageWarning };
}
