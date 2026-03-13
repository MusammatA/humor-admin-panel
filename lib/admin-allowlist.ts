import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./supabase-config";

export function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function normalizeDomain(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");
}

export function emailDomain(email: string): string {
  const normalized = normalizeEmail(email);
  const [, domain = ""] = normalized.split("@");
  return normalizeDomain(domain);
}

export function readAdminAllowlist(): Set<string> {
  const raw = String(process.env.ADMIN_ALLOWED_EMAILS || "");
  return new Set(
    raw
      .split(",")
      .map((email) => normalizeEmail(email))
      .filter(Boolean),
  );
}

export function readAdminDomainAllowlist(): Set<string> {
  const raw = String(process.env.ADMIN_ALLOWED_DOMAINS || "");
  return new Set(
    raw
      .split(",")
      .map((domain) => normalizeDomain(domain))
      .filter(Boolean),
  );
}

export function isAllowlistedIfConfigured(email: string): boolean {
  const allowlist = readAdminAllowlist();
  if (!allowlist.size) return true;
  return allowlist.has(normalizeEmail(email));
}

async function readAllowedDomainsFromDatabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!SUPABASE_URL || !serviceRoleKey) return null;

  const client = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.from("allowed_domains").select("domain").limit(500);
  if (error) return null;

  return new Set(
    (data ?? [])
      .map((row) => normalizeDomain((row as { domain?: unknown }).domain))
      .filter(Boolean),
  );
}

export async function isDomainAllowlistedIfConfigured(email: string): Promise<boolean> {
  const domain = emailDomain(email);
  if (!domain) return false;

  const envDomains = readAdminDomainAllowlist();
  if (envDomains.size) {
    return envDomains.has(domain);
  }

  const dbDomains = await readAllowedDomainsFromDatabase();
  if (!dbDomains || dbDomains.size === 0) {
    return true;
  }

  return dbDomains.has(domain);
}

export async function isAdminEmailAllowed(email: string): Promise<boolean> {
  if (!isAllowlistedIfConfigured(email)) return false;
  return isDomainAllowlistedIfConfigured(email);
}
