import type { LLMModel, LLMProvider, LLMPromptChain, LLMResponse } from "../../types";
import { getSupabaseBrowserClientOrThrow } from "./client";

type MatchValue = string | number;

type ProviderMatch = {
  id?: MatchValue;
  name?: string;
};

type ModelMatch = {
  id?: MatchValue;
  name?: string;
  providerModelId?: string;
};

function applyProviderMatch<T extends { eq(column: string, value: MatchValue): T }>(request: T, match: ProviderMatch) {
  if (typeof match.id !== "undefined") return request.eq("id", match.id);
  if (match.name) return request.eq("name", match.name);
  throw new Error("Provider id or name is required.");
}

function applyModelMatch<T extends { eq(column: string, value: MatchValue): T }>(request: T, match: ModelMatch) {
  if (typeof match.id !== "undefined") return request.eq("id", match.id);
  if (match.providerModelId) return request.eq("provider_model_id", match.providerModelId);
  if (match.name) return request.eq("name", match.name);
  throw new Error("Model id, provider_model_id, or name is required.");
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

export async function fetchModels(limit = 200) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const { data, error } = await supabase.from("llm_models").select("*").limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as LLMModel[];
}

export async function addModel(model: Pick<LLMModel, "name"> & Partial<LLMModel>) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const { error } = await supabase.from("llm_models").insert([model]);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateModel(match: ModelMatch, updates: Partial<LLMModel>) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const request = applyModelMatch(supabase.from("llm_models").update(updates), match);
  const { error } = await request;

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteModel(match: ModelMatch) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const request = applyModelMatch(supabase.from("llm_models").delete(), match);
  const { error } = await request;

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchPromptChains(limit = 500) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const { data, error } = await supabase
    .from("llm_prompt_chains")
    .select("*")
    .order("id", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as LLMPromptChain[];
}

export async function fetchResponses(limit = 500) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const { data, error } = await supabase
    .from("llm_model_responses")
    .select("*")
    .order("created_datetime_utc", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as LLMResponse[];
}
