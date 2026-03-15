import type { AllowedDomain, Profile } from "../../types";
import { getSupabaseBrowserClientOrThrow } from "./client";

type DomainMatch = {
  id?: string;
  domain?: string;
};

const DOMAIN_TABLES = [
  { name: "allowed_domains", valueColumn: "domain" },
  { name: "allowed_signup_domains", valueColumn: "apex_domain" },
] as const;

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
  let lastError: Error | null = null;

  for (const table of DOMAIN_TABLES) {
    const { data, error } = await supabase.from(table.name).select("*").limit(limit);
    if (error) {
      lastError = new Error(error.message);
      continue;
    }

    return ((data ?? []) as AllowedDomain[]).map((row) => ({
      ...row,
      domain: row.domain ?? String(row[table.valueColumn] ?? ""),
    }));
  }

  if (lastError) {
    throw lastError;
  }

  return [] as AllowedDomain[];
}

export async function addAllowedDomain(domain: string) {
  const supabase = getSupabaseBrowserClientOrThrow();
  let lastError: Error | null = null;

  for (const table of DOMAIN_TABLES) {
    const { error } = await supabase.from(table.name).insert([{ [table.valueColumn]: domain }]);
    if (!error) {
      return;
    }
    lastError = new Error(error.message);
  }

  if (lastError) {
    throw lastError;
  }
}

export async function updateAllowedDomain(match: DomainMatch, domain: string) {
  const supabase = getSupabaseBrowserClientOrThrow();
  let lastError: Error | null = null;

  for (const table of DOMAIN_TABLES) {
    let request = supabase.from(table.name).update({ [table.valueColumn]: domain });
    if (match.id) {
      request = request.eq("id", match.id);
    } else if (match.domain) {
      request = request.eq(table.valueColumn, match.domain);
    } else {
      throw new Error("Domain id or domain value is required.");
    }

    const { error } = await request;
    if (!error) {
      return;
    }

    lastError = new Error(error.message);
  }

  if (lastError) {
    throw lastError;
  }
}

export async function deleteAllowedDomain(match: DomainMatch) {
  const supabase = getSupabaseBrowserClientOrThrow();
  let lastError: Error | null = null;

  for (const table of DOMAIN_TABLES) {
    let request = supabase.from(table.name).delete();
    if (match.id) {
      request = request.eq("id", match.id);
    } else if (match.domain) {
      request = request.eq(table.valueColumn, match.domain);
    } else {
      throw new Error("Domain id or domain value is required.");
    }

    const { error } = await request;
    if (!error) {
      return;
    }

    lastError = new Error(error.message);
  }

  if (lastError) {
    throw lastError;
  }
}
