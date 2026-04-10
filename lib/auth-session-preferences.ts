export const ADMIN_REMEMBER_SESSION_COOKIE = "admin_remember_session";

export function shouldRememberAdminSession(value: string | null | undefined): boolean {
  return value !== "0";
}

export function makeSessionScopedCookieOptions<T extends Record<string, unknown> | undefined>(
  options: T,
): T {
  if (!options) return options;

  const nextOptions = { ...options };
  delete nextOptions.maxAge;
  delete nextOptions.expires;
  return nextOptions as T;
}
