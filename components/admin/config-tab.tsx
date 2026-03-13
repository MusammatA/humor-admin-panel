"use client";

import { Cpu, Globe2, Plus, RefreshCw, Save, Sparkles, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import {
  addAllowedDomain,
  deleteAllowedDomain,
  fetchAllowedDomains,
  fetchProfilesPreview,
  updateAllowedDomain,
} from "../../lib/services/admin-config";
import { getErrorMessage } from "../../lib/services/client";
import { fetchFlavors, fetchHumorMix, fetchHumorSteps, updateHumorMix } from "../../lib/services/humor";
import { addProvider, deleteProvider as deleteProviderRecord, fetchProviders, updateProvider } from "../../lib/services/llm";
import type { AllowedDomain, DatabaseRow, HumorFlavor, HumorMix, HumorStep, LLMProvider, Profile } from "../../types";

type TableErrors = Partial<
  Record<"profiles" | "humor_flavors" | "humor_steps" | "humor_mix" | "llm_providers" | "allowed_domains", string>
>;

function str(row: DatabaseRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function stringifyEditableValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function coerceDraftValue(draft: string, existingValue: unknown) {
  if (typeof existingValue === "number") {
    const parsed = Number(draft);
    return Number.isFinite(parsed) ? parsed : draft;
  }

  if (typeof existingValue === "boolean") {
    if (draft === "true") return true;
    if (draft === "false") return false;
  }

  if (existingValue && typeof existingValue === "object") {
    try {
      return JSON.parse(draft);
    } catch {
      return draft;
    }
  }

  return draft;
}

function rowPreview(row: DatabaseRow, hiddenKeys: string[]) {
  const parts = Object.entries(row)
    .filter(([key]) => !hiddenKeys.includes(key))
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${stringifyEditableValue(value)}`);
  return parts.join(" • ");
}

function getProfileId(row: Profile) {
  return str(row, ["id"]);
}

function getProfileName(row: Profile) {
  return str(row, ["full_name", "name", "username"]);
}

function getProfileEmail(row: Profile) {
  return str(row, ["email"]);
}

function getFlavorLabel(row: HumorFlavor) {
  return str(row, ["name", "label", "flavor", "title", "id"]);
}

function getFlavorRef(row: HumorFlavor) {
  return str(row, ["id", "name", "label", "flavor", "title"]);
}

function getMixId(row: HumorMix) {
  return str(row, ["id"]);
}

function getStepTitle(row: HumorStep) {
  return str(row, ["title", "step", "step_text", "description", "id"]);
}

function getStepBody(row: HumorStep) {
  return str(row, ["description", "step_text", "step", "title"]);
}

function getStepOrder(row: HumorStep) {
  return str(row, ["step_order", "order_index", "position"]);
}

function getProviderId(row: LLMProvider) {
  return str(row, ["id"]);
}

function getProviderName(row: LLMProvider) {
  return str(row, ["name", "provider", "slug"]);
}

function getDomainId(row: AllowedDomain) {
  return str(row, ["id"]);
}

function getDomainValue(row: AllowedDomain) {
  return str(row, ["domain", "host"]);
}

function getSettledError<T>(result: PromiseSettledResult<T>) {
  return result.status === "rejected" ? getErrorMessage(result.reason) : "";
}

export function ConfigTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [humorFlavors, setHumorFlavors] = useState<HumorFlavor[]>([]);
  const [humorSteps, setHumorSteps] = useState<HumorStep[]>([]);
  const [humorMix, setHumorMix] = useState<HumorMix[]>([]);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [domains, setDomains] = useState<AllowedDomain[]>([]);
  const [tableErrors, setTableErrors] = useState<TableErrors>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mixDrafts, setMixDrafts] = useState<Record<string, string>>({});
  const [providerDrafts, setProviderDrafts] = useState<Record<string, string>>({});
  const [domainDrafts, setDomainDrafts] = useState<Record<string, string>>({});
  const [newProviderName, setNewProviderName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [selectedFlavorRef, setSelectedFlavorRef] = useState("");
  const [stepsLoading, setStepsLoading] = useState(false);

  async function loadConfigData() {
    setLoading(true);
    setActionError(null);
    try {
      const [profilesRes, flavorsRes, mixRes, providersRes, domainsRes] = await Promise.allSettled([
        fetchProfilesPreview(40),
        fetchFlavors(200),
        fetchHumorMix(200),
        fetchProviders(200),
        fetchAllowedDomains(200),
      ]);

      setProfiles(profilesRes.status === "fulfilled" ? profilesRes.value : []);
      setHumorFlavors(flavorsRes.status === "fulfilled" ? flavorsRes.value : []);
      setHumorMix(mixRes.status === "fulfilled" ? mixRes.value : []);
      setProviders(providersRes.status === "fulfilled" ? providersRes.value : []);
      setDomains(domainsRes.status === "fulfilled" ? domainsRes.value : []);

      const nextErrors: TableErrors = {};
      const profilesError = getSettledError(profilesRes);
      const flavorsError = getSettledError(flavorsRes);
      const mixError = getSettledError(mixRes);
      const providersError = getSettledError(providersRes);
      const domainsError = getSettledError(domainsRes);
      if (profilesError) nextErrors.profiles = profilesError;
      if (flavorsError) nextErrors.humor_flavors = flavorsError;
      if (mixError) nextErrors.humor_mix = mixError;
      if (providersError) nextErrors.llm_providers = providersError;
      if (domainsError) nextErrors.allowed_domains = domainsError;
      setTableErrors(nextErrors);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfigData();
  }, []);

  useEffect(() => {
    setMixDrafts(
      Object.fromEntries(
        humorMix
          .map((row) => {
            const id = getMixId(row);
            return id ? [id, stringifyEditableValue(row.val)] : null;
          })
          .filter(Boolean) as Array<[string, string]>,
      ),
    );
  }, [humorMix]);

  useEffect(() => {
    setProviderDrafts(
      Object.fromEntries(
        providers
          .map((row) => {
            const key = getProviderId(row) || getProviderName(row);
            return key ? [key, getProviderName(row)] : null;
          })
          .filter(Boolean) as Array<[string, string]>,
      ),
    );
  }, [providers]);

  useEffect(() => {
    setDomainDrafts(
      Object.fromEntries(
        domains
          .map((row) => {
            const key = getDomainId(row) || getDomainValue(row);
            return key ? [key, getDomainValue(row)] : null;
          })
          .filter(Boolean) as Array<[string, string]>,
      ),
    );
  }, [domains]);

  useEffect(() => {
    if (!humorFlavors.length) {
      setSelectedFlavorRef("");
      return;
    }

    if (!selectedFlavorRef || !humorFlavors.some((row) => getFlavorRef(row) === selectedFlavorRef)) {
      setSelectedFlavorRef(getFlavorRef(humorFlavors[0]) || "");
    }
  }, [humorFlavors, selectedFlavorRef]);

  useEffect(() => {
    async function loadSteps() {
      if (!selectedFlavorRef) {
        setHumorSteps([]);
        return;
      }

      setStepsLoading(true);
      try {
        const steps = await fetchHumorSteps(selectedFlavorRef, 200);
        setHumorSteps(steps);
        setTableErrors((prev) => {
          const next = { ...prev };
          delete next.humor_steps;
          return next;
        });
      } catch (error) {
        setHumorSteps([]);
        setTableErrors((prev) => ({ ...prev, humor_steps: getErrorMessage(error) }));
      } finally {
        setStepsLoading(false);
      }
    }

    loadSteps();
  }, [selectedFlavorRef]);

  async function saveMixRow(row: HumorMix) {
    const id = getMixId(row);
    if (!id) {
      setActionError("Cannot update a humor_mix row without an id.");
      return;
    }

    const nextDraft = mixDrafts[id] ?? "";
    try {
      await updateHumorMix(id, coerceDraftValue(nextDraft, row.val));
      setActionError(null);
      setMessage(`Updated humor_mix row ${id}.`);
      await loadConfigData();
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function saveProvider(row?: LLMProvider) {
    const providerId = row ? getProviderId(row) : "";
    const providerKey = providerId || (row ? getProviderName(row) : "");
    const name = row ? (providerDrafts[providerKey] ?? "").trim() : newProviderName.trim();

    if (!name) {
      setActionError("Provider name is required.");
      return;
    }

    try {
      if (row) {
        await updateProvider({ id: providerId, name: getProviderName(row) }, { name });
      } else {
        await addProvider({ name });
      }
      setActionError(null);
      setMessage(providerId ? `Saved provider ${name}.` : `Created provider ${name}.`);
      if (!providerId) setNewProviderName("");
      await loadConfigData();
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function deleteProvider(row: LLMProvider) {
    const providerId = getProviderId(row);
    const providerName = getProviderName(row);
    if (!providerId && !providerName) {
      setActionError("Cannot delete a provider without an id or name.");
      return;
    }

    try {
      await deleteProviderRecord({ id: providerId, name: providerName });
      setActionError(null);
      setMessage(`Deleted provider ${providerName || providerId}.`);
      await loadConfigData();
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function saveDomain(row?: AllowedDomain) {
    const domainId = row ? getDomainId(row) : "";
    const currentDomain = row ? getDomainValue(row) : "";
    const key = domainId || currentDomain;
    const nextDomain = (row ? domainDrafts[key] ?? "" : newDomain).trim().toLowerCase();

    if (!nextDomain) {
      setActionError("Domain is required.");
      return;
    }

    if (!row && domains.some((item) => getDomainValue(item).toLowerCase() === nextDomain)) {
      setActionError(`Domain ${nextDomain} already exists.`);
      return;
    }

    try {
      if (row) {
        await updateAllowedDomain({ id: domainId, domain: currentDomain }, nextDomain);
      } else {
        await addAllowedDomain(nextDomain);
      }
      setActionError(null);
      setMessage(row ? `Saved domain ${nextDomain}.` : `Added domain ${nextDomain}.`);
      if (!row) setNewDomain("");
      await loadConfigData();
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function deleteDomain(row: AllowedDomain) {
    const domainId = getDomainId(row);
    const domain = getDomainValue(row);
    if (!domainId && !domain) {
      setActionError("Cannot delete a domain without an id or domain value.");
      return;
    }

    try {
      await deleteAllowedDomain({ id: domainId, domain });
      setActionError(null);
      setMessage(`Deleted domain ${domain || domainId}.`);
      await loadConfigData();
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  const hasTableErrors = Object.keys(tableErrors).length > 0;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Config</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Read from <code className="rounded bg-slate-100 px-1.5 py-0.5">profiles</code> and
            manage the <code className="rounded bg-slate-100 px-1.5 py-0.5">humor_flavors</code>,
            <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5">humor_mix</code>,
            <code className="rounded bg-slate-100 px-1.5 py-0.5">llm_providers</code>, and
            <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5">allowed_domains</code> tables.
          </p>
        </div>
        <button
          type="button"
          onClick={loadConfigData}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      {actionError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
      ) : null}
      {hasTableErrors ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {Object.entries(tableErrors).map(([tableName, error]) => (
            <p key={tableName}>
              <span className="font-semibold">{tableName}:</span> {error}
            </p>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">Profiles Snapshot</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Read-only sample from the <code className="rounded bg-slate-100 px-1.5 py-0.5">profiles</code> table.
            Full browsing remains in the Search Users tab.
          </p>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading profiles...</p>
          ) : profiles.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No profiles returned.</p>
          ) : (
            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{profiles.length} rows loaded</p>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {profiles.map((row) => {
                  const id = getProfileId(row);
                  const name = getProfileName(row);
                  const email = getProfileEmail(row);
                  return (
                    <div key={id || email || JSON.stringify(row)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-sm font-medium text-slate-900">{name || email || "Unnamed profile"}</p>
                      <p className="text-xs text-slate-600">{email || "No email"}</p>
                      {id ? <p className="font-mono text-[11px] text-slate-500">{id}</p> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">Humor Flavors</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Read flavors to populate a selector, then inspect the related steps for the chosen flavor.
          </p>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading humor flavors...</p>
          ) : humorFlavors.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No humor flavors returned.</p>
          ) : (
            <>
              <div className="mt-4 flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
                {humorFlavors.map((row) => {
                  const flavorRef = getFlavorRef(row);
                  const selected = flavorRef && flavorRef === selectedFlavorRef;
                  return (
                    <button
                      key={flavorRef || getFlavorLabel(row) || JSON.stringify(row)}
                      type="button"
                      onClick={() => setSelectedFlavorRef(flavorRef)}
                      className={`rounded-full border px-3 py-1.5 text-sm ${
                        selected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      {getFlavorLabel(row) || "Unnamed flavor"}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">Flavor Steps</h3>
                  {selectedFlavorRef ? <p className="font-mono text-[11px] text-slate-500">{selectedFlavorRef}</p> : null}
                </div>
                {stepsLoading ? (
                  <p className="mt-3 text-sm text-slate-500">Loading steps...</p>
                ) : humorSteps.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No steps returned for the selected flavor.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {humorSteps.map((step, index) => (
                      <div
                        key={String(step.id ?? `${selectedFlavorRef}-${index}`)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <p className="text-sm font-medium text-slate-900">
                          {getStepOrder(step) ? `Step ${getStepOrder(step)}: ` : ""}
                          {getStepTitle(step) || `Step ${index + 1}`}
                        </p>
                        {getStepBody(step) ? (
                          <p className="mt-1 text-xs leading-relaxed text-slate-600">{getStepBody(step)}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Save className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">Humor Mix</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Update the <code className="rounded bg-slate-100 px-1.5 py-0.5">val</code> field on
            <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5">humor_mix</code> rows.
          </p>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading humor mix rows...</p>
          ) : humorMix.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No humor mix rows returned.</p>
          ) : (
            <div className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto pr-1">
              {humorMix.map((row) => {
                const id = getMixId(row);
                return (
                  <div key={id || JSON.stringify(row)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs text-slate-500">{id || "No id column"}</p>
                        <p className="mt-1 text-xs text-slate-600">{rowPreview(row, ["val"]) || "No extra columns"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => saveMixRow(row)}
                        disabled={!id}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                    <textarea
                      value={mixDrafts[id] ?? ""}
                      onChange={(event) => setMixDrafts((prev) => ({ ...prev, [id]: event.target.value }))}
                      className="mt-3 min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      placeholder="val"
                      disabled={!id}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">LLM Providers</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Create and update providers with <code className="rounded bg-slate-100 px-1.5 py-0.5">upsert</code>,
            then remove obsolete rows when needed.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="text"
              value={newProviderName}
              onChange={(event) => setNewProviderName(event.target.value)}
              placeholder="New provider name"
              className="min-w-[14rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
            <button
              type="button"
              onClick={() => saveProvider()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Add Provider
            </button>
          </div>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading providers...</p>
          ) : providers.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No providers returned.</p>
          ) : (
            <div className="mt-4 max-h-[26rem] space-y-3 overflow-y-auto pr-1">
              {providers.map((row) => {
                const id = getProviderId(row);
                const fallbackName = getProviderName(row);
                const key = id || fallbackName;
                return (
                  <div key={key || JSON.stringify(row)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={providerDrafts[key] ?? ""}
                        onChange={(event) => setProviderDrafts((prev) => ({ ...prev, [key]: event.target.value }))}
                        className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => saveProvider(row)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteProvider(row)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{rowPreview(row, ["id", "name", "provider", "slug"]) || "No extra columns"}</p>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-slate-700" />
          <h2 className="text-lg font-semibold text-slate-900">Allowed Domains</h2>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Insert, update, and delete rows from <code className="rounded bg-slate-100 px-1.5 py-0.5">allowed_domains</code>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="text"
            value={newDomain}
            onChange={(event) => setNewDomain(event.target.value)}
            placeholder="columbia.edu"
            className="min-w-[14rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
          <button
            type="button"
            onClick={() => saveDomain()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Domain
          </button>
        </div>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading domains...</p>
        ) : domains.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No allowed domains returned.</p>
        ) : (
          <div className="mt-4 max-h-[26rem] space-y-3 overflow-y-auto pr-1">
            {domains.map((row) => {
              const id = getDomainId(row);
              const domain = getDomainValue(row);
              const key = id || domain;
              return (
                <div key={key || JSON.stringify(row)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={domainDrafts[key] ?? ""}
                      onChange={(event) => setDomainDrafts((prev) => ({ ...prev, [key]: event.target.value }))}
                      className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => saveDomain(row)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDomain(row)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{rowPreview(row, ["id", "domain", "host"]) || "No extra columns"}</p>
                </div>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
