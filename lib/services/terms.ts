import type { Term } from "../../types";
import { getSupabaseBrowserClientOrThrow } from "./client";

type TermMatch = {
  id?: string | number;
  term?: string;
};

function applyTermMatch<T extends { eq(column: string, value: string | number): T }>(request: T, match: TermMatch) {
  if (typeof match.id !== "undefined") return request.eq("id", match.id);
  if (match.term) return request.eq("term", match.term);
  throw new Error("Term id or term value is required.");
}

export async function fetchTerms(limit = 500) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const { data, error } = await supabase.from("terms").select("*").limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Term[];
}

export async function addTerm(term: Pick<Term, "term" | "definition" | "example"> & Partial<Term>) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const { error } = await supabase.from("terms").insert([term]);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateTerm(match: TermMatch, updates: Partial<Term>) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const request = applyTermMatch(supabase.from("terms").update(updates), match);
  const { error } = await request;

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteTerm(match: TermMatch) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const request = applyTermMatch(supabase.from("terms").delete(), match);
  const { error } = await request;

  if (error) {
    throw new Error(error.message);
  }
}
