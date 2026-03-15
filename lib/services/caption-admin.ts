import type { CaptionExample, CaptionRequest } from "../../types";
import { getSupabaseBrowserClientOrThrow } from "./client";

type CaptionExampleMatch = {
  id?: string | number;
};

function applyCaptionExampleMatch<T extends { eq(column: string, value: string | number): T }>(
  request: T,
  match: CaptionExampleMatch,
) {
  if (typeof match.id !== "undefined") return request.eq("id", match.id);
  throw new Error("Caption example id is required.");
}

export async function fetchCaptionRequests(limit = 500) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const { data, error } = await supabase
    .from("caption_requests")
    .select("*")
    .order("id", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CaptionRequest[];
}

export async function fetchCaptionExamples(limit = 500) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const { data, error } = await supabase
    .from("caption_examples")
    .select("*")
    .order("priority", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CaptionExample[];
}

export async function addCaptionExample(
  example: Pick<CaptionExample, "image_description" | "caption" | "explanation"> & Partial<CaptionExample>,
) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const { error } = await supabase.from("caption_examples").insert([example]);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateCaptionExample(match: CaptionExampleMatch, updates: Partial<CaptionExample>) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const request = applyCaptionExampleMatch(supabase.from("caption_examples").update(updates), match);
  const { error } = await request;

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteCaptionExample(match: CaptionExampleMatch) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const request = applyCaptionExampleMatch(supabase.from("caption_examples").delete(), match);
  const { error } = await request;

  if (error) {
    throw new Error(error.message);
  }
}
