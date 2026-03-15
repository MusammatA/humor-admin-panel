"use client";

import { Bot, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "../../lib/services/client";
import { addModel, deleteModel, fetchModels, fetchProviders, updateModel } from "../../lib/services/llm";
import type { LLMModel, LLMProvider } from "../../types";

type LLMModelsManagerProps = {
  canManage: boolean;
};

type ModelDraft = {
  name: string;
  llmProviderId: string;
  providerModelId: string;
  isTemperatureSupported: boolean;
};

function getModelId(row: LLMModel) {
  return typeof row.id === "undefined" ? "" : String(row.id);
}

function getProviderId(row: LLMProvider) {
  return typeof row.id === "undefined" ? "" : String(row.id);
}

function getProviderLabel(row: LLMProvider) {
  return String(row.name || row.provider || row.slug || row.id || "");
}

function toDraft(row: LLMModel): ModelDraft {
  return {
    name: row.name ?? "",
    llmProviderId: typeof row.llm_provider_id === "undefined" || row.llm_provider_id === null ? "" : String(row.llm_provider_id),
    providerModelId: row.provider_model_id ?? "",
    isTemperatureSupported: row.is_temperature_supported === true,
  };
}

function parseProviderId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function LLMModelsManager({ canManage }: LLMModelsManagerProps) {
  const [models, setModels] = useState<LLMModel[]>([]);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ModelDraft>>({});
  const [newModel, setNewModel] = useState<ModelDraft>({
    name: "",
    llmProviderId: "",
    providerModelId: "",
    isTemperatureSupported: false,
  });
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
    setDrafts(
      Object.fromEntries(
        models
          .map((row) => {
            const id = getModelId(row);
            return id ? [id, toDraft(row)] : null;
          })
          .filter(Boolean) as Array<[string, ModelDraft]>,
      ),
    );
  }, [models]);

  async function handleAdd() {
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

  async function handleSave(row: LLMModel) {
    if (!canManage) return;

    const id = getModelId(row);
    const draft = drafts[id];
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

  async function handleDelete(row: LLMModel) {
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

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">LLM Models</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Create, read, update, and delete rows from <code className="rounded bg-slate-100 px-1.5 py-0.5">llm_models</code>.
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

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
      ) : null}

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
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
              onChange={(event) =>
                setNewModel((prev) => ({ ...prev, isTemperatureSupported: event.target.checked }))
              }
              disabled={!canManage || busy}
            />
            Temperature
          </label>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canManage || busy}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          <Plus className="h-4 w-4" />
          Add Model
        </button>
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-slate-500">Loading llm models...</p>
      ) : models.length === 0 ? (
        <p className="mt-5 text-sm text-slate-500">No llm models returned.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {models.map((row) => {
            const id = getModelId(row);
            const draft = drafts[id] ?? toDraft(row);

            return (
              <div key={id || JSON.stringify(row)} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(event) =>
                      setDrafts((prev) => ({ ...prev, [id]: { ...draft, name: event.target.value } }))
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    disabled={!canManage || busy || !id}
                  />
                  <select
                    value={draft.llmProviderId}
                    onChange={(event) =>
                      setDrafts((prev) => ({ ...prev, [id]: { ...draft, llmProviderId: event.target.value } }))
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    disabled={!canManage || busy || !id}
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
                    value={draft.providerModelId}
                    onChange={(event) =>
                      setDrafts((prev) => ({ ...prev, [id]: { ...draft, providerModelId: event.target.value } }))
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    disabled={!canManage || busy || !id}
                  />
                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.isTemperatureSupported}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [id]: { ...draft, isTemperatureSupported: event.target.checked },
                        }))
                      }
                      disabled={!canManage || busy || !id}
                    />
                    Temperature
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSave(row)}
                      disabled={!canManage || busy || !id}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(row)}
                      disabled={!canManage || busy || !id}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-2 font-mono text-xs text-slate-500">{id || "No id column"}</p>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
