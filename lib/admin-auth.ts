export function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function readAdminAllowlist(): Set<string> {
  const raw = String(process.env.ADMIN_ALLOWED_EMAILS || "");
  return new Set(
    raw
      .split(",")
      .map((item) => normalizeEmail(item))
      .filter(Boolean),
  );
}

export function isAllowlistedAdminEmail(email: string): boolean {
  const allowlist = readAdminAllowlist();
  if (!allowlist.size) return false;
  return allowlist.has(normalizeEmail(email));
}

