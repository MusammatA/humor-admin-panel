import type { HumorFlavor, HumorMix, HumorStep } from "../../types";
import { getSupabaseBrowserClientOrThrow } from "./client";

const HUMOR_STEP_FILTER_COLUMNS = ["flavor_id", "humor_flavor_id", "flavor", "flavor_name"] as const;
const HUMOR_STEP_TABLES = ["humor_steps", "humor_flavor_steps"] as const;
const HUMOR_MIX_TABLES = [
  { name: "humor_mix", valueColumn: "val" },
  { name: "humor_flavor_mix", valueColumn: "caption_count" },
] as const;

function stepOrderValue(step: HumorStep) {
  const raw = step.step_order ?? step.order_index ?? step.position;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Number.MAX_SAFE_INTEGER;
}

function sortHumorSteps(steps: HumorStep[]) {
  return [...steps].sort((a, b) => {
    const delta = stepOrderValue(a) - stepOrderValue(b);
    if (delta !== 0) return delta;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}

export async function fetchHumorFlavors(limit = 200) {
  const supabase = getSupabaseBrowserClientOrThrow();
  const { data, error } = await supabase.from("humor_flavors").select("*").limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as HumorFlavor[];
}

export async function fetchHumorMix(limit = 200) {
  const supabase = getSupabaseBrowserClientOrThrow();
  let lastError: Error | null = null;

  for (const table of HUMOR_MIX_TABLES) {
    const { data, error } = await supabase.from(table.name).select("*").limit(limit);
    if (error) {
      lastError = new Error(error.message);
      continue;
    }

    return ((data ?? []) as HumorMix[]).map((row) => ({
      ...row,
      val: row.val ?? row[table.valueColumn],
    }));
  }

  if (lastError) {
    throw lastError;
  }

  return [] as HumorMix[];
}

export async function updateHumorMix(id: string, val: unknown) {
  const supabase = getSupabaseBrowserClientOrThrow();
  let lastError: Error | null = null;

  for (const table of HUMOR_MIX_TABLES) {
    const nextValue =
      table.valueColumn === "caption_count" && typeof val !== "number" ? Number(val) : val;
    const payload = {
      [table.valueColumn]:
        table.valueColumn === "caption_count" && typeof nextValue === "number" && Number.isFinite(nextValue)
          ? nextValue
          : val,
    };

    const { error } = await supabase.from(table.name).update(payload).eq("id", id);
    if (!error) {
      return;
    }

    lastError = new Error(error.message);
  }

  if (lastError) {
    throw lastError;
  }
}

export async function fetchHumorSteps(flavorRef: string, limit = 200) {
  if (!flavorRef.trim()) return [] as HumorStep[];

  const supabase = getSupabaseBrowserClientOrThrow();
  let lastError: Error | null = null;

  for (const table of HUMOR_STEP_TABLES) {
    const columns = table === "humor_flavor_steps" ? ["flavor_id"] : [...HUMOR_STEP_FILTER_COLUMNS];
    for (const column of columns) {
      const { data, error } = await supabase.from(table).select("*").eq(column, flavorRef).limit(limit);
      if (error) {
        lastError = new Error(error.message);
        continue;
      }

      return sortHumorSteps((data ?? []) as HumorStep[]);
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [] as HumorStep[];
}

export const fetchFlavors = fetchHumorFlavors;
export const fetchStepsForFlavor = fetchHumorSteps;
export const updateMix = updateHumorMix;
