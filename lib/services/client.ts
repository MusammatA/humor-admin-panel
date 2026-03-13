import { createSupabaseBrowserClient } from "../supabase-browser";

export const MISSING_SUPABASE_BROWSER_ENV_MESSAGE =
  "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.";

export const MISSING_SESSION_MESSAGE = "Login session missing. Refresh and sign in again.";

export function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Unexpected error.";
}

export function getSupabaseBrowserClientOrThrow() {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(MISSING_SUPABASE_BROWSER_ENV_MESSAGE);
  }
  return supabase;
}

export async function getCurrentUserIdOrThrow() {
  const supabase = getSupabaseBrowserClientOrThrow();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    throw new Error(MISSING_SESSION_MESSAGE);
  }

  return user.id;
}
