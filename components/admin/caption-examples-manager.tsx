"use client";

import { Lightbulb, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  addCaptionExample,
  deleteCaptionExample,
  fetchCaptionExamples,
  updateCaptionExample,
} from "../../lib/services/caption-admin";
import { getErrorMessage } from "../../lib/services/client";
import type { CaptionExample } from "../../types";

type CaptionExamplesManagerProps = {
  canManage: boolean;
};

type CaptionExampleDraft = {
  imageDescription: string;
  caption: string;
  explanation: string;
  priority: string;
  imageId: string;
};

function getExampleId(row: CaptionExample) {
  return typeof row.id === "undefined" ? "" : String(row.id);
}

function toDraft(row: CaptionExample): CaptionExampleDraft {
  return {
    imageDescription: row.image_description ?? "",
    caption: row.caption ?? "",
    explanation: row.explanation ?? "",
    priority: typeof row.priority === "number" ? String(row.priority) : "",
    imageId: row.image_id ?? "",
  };
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function CaptionExamplesManager({ canManage }: CaptionExamplesManagerProps) {
  const [examples, setExamples] = useState<CaptionExample[]>([]);
  const [drafts, setDrafts] = useState<Record<string, CaptionExampleDraft>>({});
  const [newExample, setNewExample] = useState<CaptionExampleDraft>({
    imageDescription: "",
    caption: "",
    explanation: "",
    priority: "0",
    imageId: "",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadExamples() {
    setLoading(true);
    setError(null);

    try {
      setExamples(await fetchCaptionExamples(500));
    } catch (error) {
      setExamples([]);
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadExamples();
  }, []);

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        examples
          .map((row) => {
            const id = getExampleId(row);
            return id ? [id, toDraft(row)] : null;
          })
          .filter(Boolean) as Array<[string, CaptionExampleDraft]>,
      ),
    );
  }, [examples]);

  async function handleAdd() {
    if (!canManage) return;

    const imageDescription = newExample.imageDescription.trim();
    const caption = newExample.caption.trim();
    const explanation = newExample.explanation.trim();
    if (!imageDescription || !caption || !explanation) {
      setError("Image description, caption, and explanation are required.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await addCaptionExample({
        image_description: imageDescription,
        caption,
        explanation,
        priority: parseOptionalNumber(newExample.priority) ?? 0,
        image_id: newExample.imageId.trim() || null,
      });
      setNewExample({
        imageDescription: "",
        caption: "",
        explanation: "",
        priority: "0",
        imageId: "",
      });
      setMessage("Added caption example.");
      await loadExamples();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(row: CaptionExample) {
    if (!canManage) return;

    const id = getExampleId(row);
    const draft = drafts[id];
    if (!id || !draft) {
      setError("Cannot update a caption example row without an id.");
      return;
    }

    const imageDescription = draft.imageDescription.trim();
    const caption = draft.caption.trim();
    const explanation = draft.explanation.trim();
    if (!imageDescription || !caption || !explanation) {
      setError("Image description, caption, and explanation are required.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await updateCaptionExample(
        { id },
        {
          image_description: imageDescription,
          caption,
          explanation,
          priority: parseOptionalNumber(draft.priority) ?? 0,
          image_id: draft.imageId.trim() || null,
        },
      );
      setMessage(`Saved caption example ${id}.`);
      await loadExamples();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(row: CaptionExample) {
    if (!canManage) return;

    const id = getExampleId(row);
    if (!id) {
      setError("Cannot delete a caption example row without an id.");
      return;
    }

    const confirmed = window.confirm(`Delete caption example ${id}?`);
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await deleteCaptionExample({ id });
      setMessage(`Deleted caption example ${id}.`);
      await loadExamples();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">Caption Examples</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Create, read, update, and delete rows from <code className="rounded bg-slate-100 px-1.5 py-0.5">caption_examples</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={loadExamples}
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
        <h3 className="text-sm font-semibold text-slate-900">Add Caption Example</h3>
        <input
          type="text"
          value={newExample.imageDescription}
          onChange={(event) => setNewExample((prev) => ({ ...prev, imageDescription: event.target.value }))}
          placeholder="Image description"
          className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          disabled={!canManage || busy}
        />
        <textarea
          value={newExample.caption}
          onChange={(event) => setNewExample((prev) => ({ ...prev, caption: event.target.value }))}
          placeholder="Example caption"
          className="mt-3 min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          disabled={!canManage || busy}
        />
        <textarea
          value={newExample.explanation}
          onChange={(event) => setNewExample((prev) => ({ ...prev, explanation: event.target.value }))}
          placeholder="Why this caption is good"
          className="mt-3 min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          disabled={!canManage || busy}
        />
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <input
            type="number"
            value={newExample.priority}
            onChange={(event) => setNewExample((prev) => ({ ...prev, priority: event.target.value }))}
            placeholder="Priority"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            disabled={!canManage || busy}
          />
          <input
            type="text"
            value={newExample.imageId}
            onChange={(event) => setNewExample((prev) => ({ ...prev, imageId: event.target.value }))}
            placeholder="Image id (optional)"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            disabled={!canManage || busy}
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canManage || busy}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          <Plus className="h-4 w-4" />
          Add Example
        </button>
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-slate-500">Loading caption examples...</p>
      ) : examples.length === 0 ? (
        <p className="mt-5 text-sm text-slate-500">No caption examples returned.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {examples.map((row) => {
            const id = getExampleId(row);
            const draft = drafts[id] ?? toDraft(row);

            return (
              <article key={id || JSON.stringify(row)} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)_auto_auto]">
                  <input
                    type="text"
                    value={draft.imageDescription}
                    onChange={(event) =>
                      setDrafts((prev) => ({ ...prev, [id]: { ...draft, imageDescription: event.target.value } }))
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    disabled={!canManage || busy || !id}
                  />
                  <input
                    type="number"
                    value={draft.priority}
                    onChange={(event) =>
                      setDrafts((prev) => ({ ...prev, [id]: { ...draft, priority: event.target.value } }))
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    disabled={!canManage || busy || !id}
                  />
                  <input
                    type="text"
                    value={draft.imageId}
                    onChange={(event) =>
                      setDrafts((prev) => ({ ...prev, [id]: { ...draft, imageId: event.target.value } }))
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    disabled={!canManage || busy || !id}
                  />
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
                <textarea
                  value={draft.caption}
                  onChange={(event) =>
                    setDrafts((prev) => ({ ...prev, [id]: { ...draft, caption: event.target.value } }))
                  }
                  className="mt-3 min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  disabled={!canManage || busy || !id}
                />
                <textarea
                  value={draft.explanation}
                  onChange={(event) =>
                    setDrafts((prev) => ({ ...prev, [id]: { ...draft, explanation: event.target.value } }))
                  }
                  className="mt-3 min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  disabled={!canManage || busy || !id}
                />
                <p className="mt-2 font-mono text-xs text-slate-500">{id || "No id column"}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
