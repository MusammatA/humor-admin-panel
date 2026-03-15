"use client";

import { Bot, Cpu, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "../../lib/services/client";
import {
  addModel,
  addProvider,
  deleteModel,
  deleteProvider,
  fetchModels,
  fetchProviders,
  updateModel,
  updateProvider,
} from "../../lib/services/llm";
import type { LLMModel, LLMProvider } from "../../types";

type LLMRegistryManagerProps = {
  canManage: boolean;
};

type RegistryView = "models" | "providers";

type ModelDraft = {
  name: string;
  llmProviderId: string;
  providerModelId: string;
  isTemperatureSupported: boolean;
};

type ProviderDraft = {
  name: string;
};

const REGISTRY_PAGE_SIZE = 20;

function getModelId(row: LLMModel) {
  return typeof row.id === "undefined" ? "" : String(row.id);
}

function getProviderId(row: LLMProvider) {
  return typeof row.id === "undefined" ? "" : String(row.id);
}

function getProviderLabel(row: LLMProvider) {
  return String(row.name || row.provider || row.slug || row.id || "");
}

function clipText(value: string, length: number) {
  if (value.length <= length) return value;
  return `${value.slice(0, Math.max(0, length - 1)).trimEnd()}...`;
}

function toModelDraft(row: LLMModel): ModelDraft {
  return {
    name: row.name ?? "",
    llmProviderId:
      typeof row.llm_provider_id === "undefined" || row.llm_provider_id === null ? "" : String(row.llm_provider_id),
    providerModelId: row.provider_model_id ?? "",
    isTemperatureSupported: row.is_temperature_supported === true,
  };
}

function toProviderDraft(row: LLMProvider): ProviderDraft {
  return {
    name: row.name ?? "",
  };
}

function parseProviderId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function LLMRegistryManager({ canManage }: LLMRegistryManagerProps) {
  const [activeView, setActiveView] = useState<RegistryView>("models");
  const [models, setModels] = useState<LLMModel[]>([]);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [modelDrafts, setModelDrafts] = useState<Record<string, ModelDraft>>({});
  const [providerDrafts, setProviderDrafts] = useState<Record<string, ProviderDraft>>({});
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [modelPage, setModelPage] = useState(0);
  const [providerPage, setProviderPage] = useState(0);
  const [newModel, setNewModel] = useState<ModelDraft>({
    name: "",
    llmProviderId: "",
    providerModelId: "",
    isTemperatureSupported: false,
  });
  const [newProviderName, setNewProviderName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [modelsRes, providersRes] = await Promise.all([fetchModels(500), fetchProviders(500)]);
      setModels(modelsRes);
      setProviders(providersRes);
    } catch (error) {
      setModels([]);
      setProviders([]);
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setModelDrafts(
      Object.fromEntries(
        models
          .map((row) => {
            const id = getModelId(row);
            return id ? [id, toModelDraft(row)] : null;
          })
          .filter(Boolean) as Array<[string, ModelDraft]>,
      ),
    );
  }, [models]);

  useEffect(() => {
    setProviderDrafts(
      Object.fromEntries(
        providers
          .map((row) => {
            const id = getProviderId(row);
            return id ? [id, toProviderDraft(row)] : null;
          })
          .filter(Boolean) as Array<[string, ProviderDraft]>,
      ),
    );
  }, [providers]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(models.length / REGISTRY_PAGE_SIZE) - 1);
    setModelPage((page) => Math.min(page, maxPage));
  }, [models.length]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(providers.length / REGISTRY_PAGE_SIZE) - 1);
    setProviderPage((page) => Math.min(page, maxPage));
  }, [providers.length]);

  const providerNameById = useMemo(
    () =>
      Object.fromEntries(
        providers
          .map((provider) => {
            const id = getProviderId(provider);
            return id ? [id, getProviderLabel(provider)] : null;
          })
          .filter(Boolean) as Array<[string, string]>,
      ),
    [providers],
  );

  const modelPageCount = Math.max(1, Math.ceil(models.length / REGISTRY_PAGE_SIZE));
  const modelStart = modelPage * REGISTRY_PAGE_SIZE;
  const pagedModels = models.slice(modelStart, modelStart + REGISTRY_PAGE_SIZE);
  const modelEnd = Math.min(modelStart + pagedModels.length, models.length);
  const selectedModel =
    pagedModels.find((row) => getModelId(row) === selectedModelId) ??
    models.find((row) => getModelId(row) === selectedModelId) ??
    pagedModels[0] ??
    null;

  const providerPageCount = Math.max(1, Math.ceil(providers.length / REGISTRY_PAGE_SIZE));
  const providerStart = providerPage * REGISTRY_PAGE_SIZE;
  const pagedProviders = providers.slice(providerStart, providerStart + REGISTRY_PAGE_SIZE);
  const providerEnd = Math.min(providerStart + pagedProviders.length, providers.length);
  const selectedProvider =
    pagedProviders.find((row) => getProviderId(row) === selectedProviderId) ??
    providers.find((row) => getProviderId(row) === selectedProviderId) ??
    pagedProviders[0] ??
    null;

  useEffect(() => {
    if (!selectedModel) {
      if (selectedModelId) setSelectedModelId("");
      return;
    }

    const nextId = getModelId(selectedModel);
    if (nextId && nextId !== selectedModelId) {
      setSelectedModelId(nextId);
    }
  }, [selectedModel, selectedModelId]);

  useEffect(() => {
    if (pagedModels.length === 0) return;
    const onPage = pagedModels.some((row) => getModelId(row) === selectedModelId);
    if (!onPage) {
      setSelectedModelId(getModelId(pagedModels[0]));
    }
  }, [modelPage, pagedModels, selectedModelId]);

  useEffect(() => {
    if (!selectedProvider) {
      if (selectedProviderId) setSelectedProviderId("");
      return;
    }

    const nextId = getProviderId(selectedProvider);
    if (nextId && nextId !== selectedProviderId) {
      setSelectedProviderId(nextId);
    }
  }, [selectedProvider, selectedProviderId]);

  useEffect(() => {
    if (pagedProviders.length === 0) return;
    const onPage = pagedProviders.some((row) => getProviderId(row) === selectedProviderId);
    if (!onPage) {
      setSelectedProviderId(getProviderId(pagedProviders[0]));
    }
  }, [providerPage, pagedProviders, selectedProviderId]);

  async function handleAddModel() {
    if (!canManage) return;

    const name = newModel.name.trim();
    const providerModelId = newModel.providerModelId.trim();
    const llmProviderId = parseProviderId(newModel.llmProviderId);
    if (!name || !providerModelId || llmProviderId === null) {
      setError("Model name, provider, and provider model id are required.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await addModel({
        name,
        llm_provider_id: llmProviderId,
        provider_model_id: providerModelId,
        is_temperature_supported: newModel.isTemperatureSupported,
      });
      setNewModel({ name: "", llmProviderId: "", providerModelId: "", isTemperatureSupported: false });
      setMessage(`Added model ${name}.`);
      await loadData();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveModel(row: LLMModel) {
    if (!canManage) return;

    const id = getModelId(row);
    const draft = modelDrafts[id];
    if (!id || !draft) {
      setError("Cannot update an llm_models row without an id.");
      return;
    }

    const name = draft.name.trim();
    const providerModelId = draft.providerModelId.trim();
    const llmProviderId = parseProviderId(draft.llmProviderId);
    if (!name || !providerModelId || llmProviderId === null) {
      setError("Model name, provider, and provider model id are required.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await updateModel(
        { id },
        {
          name,
          llm_provider_id: llmProviderId,
          provider_model_id: providerModelId,
          is_temperature_supported: draft.isTemperatureSupported,
        },
      );
      setMessage(`Saved model ${name}.`);
      await loadData();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteModel(row: LLMModel) {
    if (!canManage) return;

    const id = getModelId(row);
    const name = row.name ?? id;
    if (!id) {
      setError("Cannot delete an llm_models row without an id.");
      return;
    }

    const confirmed = window.confirm(`Delete model ${name}?`);
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await deleteModel({ id });
      setMessage(`Deleted model ${name}.`);
      await loadData();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddProvider() {
    if (!canManage) return;

    const name = newProviderName.trim();
    if (!name) {
      setError("Provider name is required.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await addProvider({ name });
      setNewProviderName("");
      setMessage(`Added provider ${name}.`);
      await loadData();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveProvider(row: LLMProvider) {
    if (!canManage) return;

    const id = getProviderId(row);
    const draft = providerDrafts[id];
    const name = draft?.name.trim() ?? "";
    if (!id || !name) {
      setError("Provider id and name are required.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await updateProvider({ id }, { name });
      setMessage(`Saved provider ${name}.`);
      await loadData();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteProvider(row: LLMProvider) {
    if (!canManage) return;

    const id = getProviderId(row);
    const name = getProviderLabel(row) || id;
    if (!id) {
      setError("Provider id is required.");
      return;
    }

    const confirmed = window.confirm(`Delete provider ${name}?`);
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await deleteProvider({ id });
      setMessage(`Deleted provider ${name}.`);
      await loadData();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {activeView === "models" ? <Bot className="h-5 w-5 text-slate-700" /> : <Cpu className="h-5 w-5 text-slate-700" />}
              <h2 className="text-lg font-semibold text-slate-900">LLM Models + Providers</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Manage the provider registry and the models attached to it in one place. They are part of the same LLM
              configuration layer, so this view keeps them together and paginated.
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {([
            { id: "models", label: "LLM Models" },
            { id: "providers", label: "LLM Providers" },
          ] as const).map((view) => {
            const selected = activeView === view.id;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {view.label}
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
        {message ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
        ) : null}
      </section>

      {activeView === "models" ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Add Model</h3>
            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <input
                type="text"
                value={newModel.name}
                onChange={(event) => setNewModel((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Model name"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                disabled={!canManage || busy}
              />
              <select
                value={newModel.llmProviderId}
                onChange={(event) => setNewModel((prev) => ({ ...prev, llmProviderId: event.target.value }))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                disabled={!canManage || busy}
              >
                <option value="">Select provider</option>
                {providers.map((provider) => (
                  <option key={getProviderId(provider) || getProviderLabel(provider)} value={getProviderId(provider)}>
                    {getProviderLabel(provider)}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newModel.providerModelId}
                onChange={(event) => setNewModel((prev) => ({ ...prev, providerModelId: event.target.value }))}
                placeholder="provider_model_id"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                disabled={!canManage || busy}
              />
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={newModel.isTemperatureSupported}
                  onChange={(event) => setNewModel((prev) => ({ ...prev, isTemperatureSupported: event.target.checked }))}
                  disabled={!canManage || busy}
                />
                Temperature
              </label>
            </div>
            <button
              type="button"
              onClick={handleAddModel}
              disabled={!canManage || busy}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <Plus className="h-4 w-4" />
              Add Model
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {loading ? (
              <p className="text-sm text-slate-500">Loading llm models...</p>
            ) : models.length === 0 ? (
              <p className="text-sm text-slate-500">No llm models returned.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Model Registry</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Showing {models.length === 0 ? 0 : modelStart + 1}-{modelEnd} of {models.length}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setModelPage((page) => Math.max(0, page - 1))}
                      disabled={modelPage === 0}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <p className="text-xs text-slate-500">
                      Page {modelPage + 1} of {modelPageCount}
                    </p>
                    <button
                      type="button"
                      onClick={() => setModelPage((page) => Math.min(modelPageCount - 1, page + 1))}
                      disabled={modelPage >= modelPageCount - 1}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="space-y-2">
                      {pagedModels.map((row) => {
                        const id = getModelId(row);
                        const selected = selectedModelId === id;
                        return (
                          <button
                            key={id || JSON.stringify(row)}
                            type="button"
                            onClick={() => setSelectedModelId(id)}
                            className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                              selected
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-100"
                            }`}
                          >
                            <p className="text-sm font-semibold">{row.name || "Unnamed model"}</p>
                            <p className={`mt-1 text-xs ${selected ? "text-slate-200" : "text-slate-500"}`}>
                              {providerNameById[String(row.llm_provider_id ?? "")] || `Provider ${row.llm_provider_id ?? "-"}`}
                            </p>
                            <p className={`mt-2 text-xs ${selected ? "text-slate-200" : "text-slate-500"}`}>
                              {clipText(row.provider_model_id ?? "", 48) || "No provider model id"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedModel ? (
                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">{selectedModel.name || "Selected Model"}</h3>
                          <p className="mt-1 font-mono text-xs text-slate-500">{getModelId(selectedModel)}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveModel(selectedModel)}
                            disabled={!canManage || busy || !getModelId(selectedModel)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Save className="h-3.5 w-3.5" />
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteModel(selectedModel)}
                            disabled={!canManage || busy || !getModelId(selectedModel)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>

                      {(() => {
                        const id = getModelId(selectedModel);
                        const draft = modelDrafts[id] ?? toModelDraft(selectedModel);
                        return (
                          <>
                            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                              <input
                                type="text"
                                value={draft.name}
                                onChange={(event) =>
                                  setModelDrafts((prev) => ({ ...prev, [id]: { ...draft, name: event.target.value } }))
                                }
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                disabled={!canManage || busy || !id}
                              />
                              <select
                                value={draft.llmProviderId}
                                onChange={(event) =>
                                  setModelDrafts((prev) => ({
                                    ...prev,
                                    [id]: { ...draft, llmProviderId: event.target.value },
                                  }))
                                }
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                disabled={!canManage || busy || !id}
                              >
                                <option value="">Select provider</option>
                                {providers.map((provider) => (
                                  <option
                                    key={getProviderId(provider) || getProviderLabel(provider)}
                                    value={getProviderId(provider)}
                                  >
                                    {getProviderLabel(provider)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                              <input
                                type="text"
                                value={draft.providerModelId}
                                onChange={(event) =>
                                  setModelDrafts((prev) => ({
                                    ...prev,
                                    [id]: { ...draft, providerModelId: event.target.value },
                                  }))
                                }
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                disabled={!canManage || busy || !id}
                              />
                              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={draft.isTemperatureSupported}
                                  onChange={(event) =>
                                    setModelDrafts((prev) => ({
                                      ...prev,
                                      [id]: { ...draft, isTemperatureSupported: event.target.checked },
                                    }))
                                  }
                                  disabled={!canManage || busy || !id}
                                />
                                Temperature supported
                              </label>
                            </div>
                          </>
                        );
                      })()}
                    </article>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                      Select a model to inspect or edit it.
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Add Provider</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                type="text"
                value={newProviderName}
                onChange={(event) => setNewProviderName(event.target.value)}
                placeholder="Provider name"
                className="min-w-[16rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                disabled={!canManage || busy}
              />
              <button
                type="button"
                onClick={handleAddProvider}
                disabled={!canManage || busy}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                <Plus className="h-4 w-4" />
                Add Provider
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {loading ? (
              <p className="text-sm text-slate-500">Loading llm providers...</p>
            ) : providers.length === 0 ? (
              <p className="text-sm text-slate-500">No llm providers returned.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Provider Registry</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Showing {providers.length === 0 ? 0 : providerStart + 1}-{providerEnd} of {providers.length}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setProviderPage((page) => Math.max(0, page - 1))}
                      disabled={providerPage === 0}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <p className="text-xs text-slate-500">
                      Page {providerPage + 1} of {providerPageCount}
                    </p>
                    <button
                      type="button"
                      onClick={() => setProviderPage((page) => Math.min(providerPageCount - 1, page + 1))}
                      disabled={providerPage >= providerPageCount - 1}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="space-y-2">
                      {pagedProviders.map((row) => {
                        const id = getProviderId(row);
                        const selected = selectedProviderId === id;
                        return (
                          <button
                            key={id || JSON.stringify(row)}
                            type="button"
                            onClick={() => setSelectedProviderId(id)}
                            className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                              selected
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-100"
                            }`}
                          >
                            <p className="text-sm font-semibold">{getProviderLabel(row) || "Unnamed provider"}</p>
                            <p className={`mt-2 font-mono text-xs ${selected ? "text-slate-200" : "text-slate-500"}`}>
                              {id || "No id"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedProvider ? (
                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">
                            {getProviderLabel(selectedProvider) || "Selected Provider"}
                          </h3>
                          <p className="mt-1 font-mono text-xs text-slate-500">{getProviderId(selectedProvider)}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveProvider(selectedProvider)}
                            disabled={!canManage || busy || !getProviderId(selectedProvider)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Save className="h-3.5 w-3.5" />
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProvider(selectedProvider)}
                            disabled={!canManage || busy || !getProviderId(selectedProvider)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>

                      {(() => {
                        const id = getProviderId(selectedProvider);
                        const draft = providerDrafts[id] ?? toProviderDraft(selectedProvider);
                        const attachedModels = models.filter((row) => String(row.llm_provider_id ?? "") === id).length;
                        return (
                          <>
                            <div className="mt-4">
                              <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                Provider Name
                              </label>
                              <input
                                type="text"
                                value={draft.name}
                                onChange={(event) =>
                                  setProviderDrafts((prev) => ({ ...prev, [id]: { ...draft, name: event.target.value } }))
                                }
                                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                disabled={!canManage || busy || !id}
                              />
                            </div>
                            <p className="mt-4 text-sm text-slate-600">
                              Attached models: <span className="font-semibold text-slate-900">{attachedModels}</span>
                            </p>
                          </>
                        );
                      })()}
                    </article>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                      Select a provider to inspect or edit it.
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
