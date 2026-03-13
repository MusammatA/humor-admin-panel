import type { AllowedDomain, Profile } from "../../types";
import { getSupabaseBrowserClientOrThrow } from "./client";

type DomainMatch = {
  id?: string;
  domain?: string;
};

function applyDomainMatch<T extends { eq(column: string, value: string): T }>(request: T, match: DomainMatch) {
  if (match.id) return request.eq("id", match.id);
  if (match.domain) return request.eq("domain", match.domain);
  throw new Error("Domain id or domain value is required.");
}

export async function fetchProfilesPreview(limit = 40) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const { data, error } = await supabase.from("profiles").select("*").limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Profile[];
}

export async function fetchAllowedDomains(limit = 200) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const { data, error } = await supabase.from("allowed_domains").select("*").limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AllowedDomain[];
}

export async function addAllowedDomain(domain: string) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const { error } = await supabase.from("allowed_domains").insert([{ domain }]);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateAllowedDomain(match: DomainMatch, domain: string) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const request = applyDomainMatch(supabase.from("allowed_domains").update({ domain }), match);
  const { error } = await request;

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteAllowedDomain(match: DomainMatch) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const request = applyDomainMatch(supabase.from("allowed_domains").delete(), match);
  const { error } = await request;

  if (error) {
    throw new Error(error.message);
  }
}
