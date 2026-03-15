import type { Profile } from "../types";

export type AdminTheme = "light" | "dark";

export const ADMIN_THEME_STORAGE_KEY = "admin_theme";
export const ADMIN_THEME_METADATA_KEY = "admin_theme";
export const ADMIN_USERNAME_METADATA_KEY = "admin_username";
export const ADMIN_AVATAR_URL_METADATA_KEY = "admin_avatar_url";

type AuthUserLike = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function emailLocalPart(email: string) {
  return String(email || "").split("@")[0]?.trim() || "";
}

export function normalizeAdminTheme(value: unknown): AdminTheme {
  return value === "dark" ? "dark" : "light";
}

export function applyAdminTheme(theme: AdminTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function getAdminThemeFromUser(user: AuthUserLike | null, fallbackTheme: AdminTheme = "light") {
  const metadataTheme = normalizeAdminTheme(user?.user_metadata?.[ADMIN_THEME_METADATA_KEY]);
  if (metadataTheme === "dark") return "dark";
  return fallbackTheme;
}

export function getAdminUsernameFromUser(user: AuthUserLike | null, fallbackEmail = "") {
  return readString(user?.user_metadata?.[ADMIN_USERNAME_METADATA_KEY]) || emailLocalPart(user?.email || fallbackEmail) || "Administrator";
}

export function getAdminAvatarUrlFromUser(user: AuthUserLike | null) {
  return readString(user?.user_metadata?.[ADMIN_AVATAR_URL_METADATA_KEY]);
}

export function getProfileName(profile: Profile | null) {
  const fullName = readString(profile?.full_name);
  if (fullName) return fullName;

  const firstName = readString(profile?.first_name);
  const lastName = readString(profile?.last_name);
  const joined = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (joined) return joined;

  return readString(profile?.username);
}
