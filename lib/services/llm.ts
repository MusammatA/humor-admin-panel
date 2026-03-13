import type { LLMProvider } from "../../types";
import { getSupabaseBrowserClientOrThrow } from "./client";

type ProviderMatch = {
  id?: string;
  name?: string;
};

function applyProviderMatch<T extends { eq(column: string, value: string): T }>(request: T, match: ProviderMatch) {
  if (match.id) return request.eq("id", match.id);
  if (match.name) return request.eq("name", match.name);
  throw new Error("Provider id or name is required.");
}

export async function fetchProviders(limit = 200) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const { data, error } = await supabase.from("llm_providers").select("*").limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as LLMProvider[];
}

export async function addProvider(provider: Pick<LLMProvider, "name"> & Partial<LLMProvider>) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const { error } = await supabase.from("llm_providers").insert([provider]);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateProvider(match: ProviderMatch, updates: Partial<LLMProvider>) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const request = applyProviderMatch(supabase.from("llm_providers").update(updates), match);
  const { error } = await request;

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteProvider(match: ProviderMatch) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const request = applyProviderMatch(supabase.from("llm_providers").delete(), match);
  const { error } = await request;

  if (error) {
    throw new Error(error.message);
  }
}

// The current schema uses `llm_providers`, so these model aliases target that table.
export const fetchModels = fetchProviders;
export const addModel = addProvider;
export const updateModel = updateProvider;
export const deleteModel = deleteProvider;
