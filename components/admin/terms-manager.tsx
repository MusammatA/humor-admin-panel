"use client";

import { BookText, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "../../lib/services/client";
import { addTerm, deleteTerm, fetchTerms, updateTerm } from "../../lib/services/terms";
import type { Term } from "../../types";

type TermsManagerProps = {
  canManage: boolean;
};

type TermDraft = {
  term: string;
  definition: string;
  example: string;
  priority: string;
  termTypeId: string;
};

function getTermId(row: Term) {
  return typeof row.id === "undefined" ? "" : String(row.id);
}

function toDraft(row: Term): TermDraft {
  return {
    term: row.term ?? "",
    definition: row.definition ?? "",
    example: row.example ?? "",
    priority: typeof row.priority === "number" ? String(row.priority) : "",
    termTypeId: typeof row.term_type_id === "number" ? String(row.term_type_id) : "",
  };
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function TermsManager({ canManage }: TermsManagerProps) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TermDraft>>({});
  const [newTerm, setNewTerm] = useState<TermDraft>({
    term: "",
    definition: "",
    example: "",
    priority: "0",
    termTypeId: "",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadTerms() {
    setLoading(true);
    setError(null);

    try {
      setTerms(await fetchTerms(500));
    } catch (error) {
      setTerms([]);
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTerms();
  }, []);

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        terms
          .map((row) => {
            const id = getTermId(row);
            return id ? [id, toDraft(row)] : null;
          })
          .filter(Boolean) as Array<[string, TermDraft]>,
      ),
    );
  }, [terms]);

  async function handleAdd() {
    if (!canManage) return;

    const term = newTerm.term.trim();
    const definition = newTerm.definition.trim();
    const example = newTerm.example.trim();
    if (!term || !definition || !example) {
      setError("Term, definition, and example are required.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await addTerm({
        term,
        definition,
        example,
        priority: parseOptionalNumber(newTerm.priority) ?? 0,
        term_type_id: parseOptionalNumber(newTerm.termTypeId),
      });
      setNewTerm({ term: "", definition: "", example: "", priority: "0", termTypeId: "" });
      setMessage(`Added term ${term}.`);
      await loadTerms();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(row: Term) {
    if (!canManage) return;

    const id = getTermId(row);
    const draft = drafts[id];
    if (!id || !draft) {
      setError("Cannot update a term row without an id.");
      return;
    }

    const term = draft.term.trim();
    const definition = draft.definition.trim();
    const example = draft.example.trim();
    if (!term || !definition || !example) {
      setError("Term, definition, and example are required.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await updateTerm(
        { id },
        {
          term,
          definition,
          example,
          priority: parseOptionalNumber(draft.priority) ?? 0,
          term_type_id: parseOptionalNumber(draft.termTypeId),
        },
      );
      setMessage(`Saved term ${term}.`);
      await loadTerms();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(row: Term) {
    if (!canManage) return;

    const id = getTermId(row);
    const term = row.term ?? id;
    if (!id) {
      setError("Cannot delete a term row without an id.");
      return;
    }

    const confirmed = window.confirm(`Delete term ${term}?`);
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await deleteTerm({ id });
      setMessage(`Deleted term ${term}.`);
      await loadTerms();
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
              <BookText className="h-5 w-5 text-slate-700" />
              <h2 className="text-lg font-semibold text-slate-900">Terms</h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Create, read, update, and delete rows from <code className="rounded bg-slate-100 px-1.5 py-0.5">terms</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={loadTerms}
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
          <h3 className="text-sm font-semibold text-slate-900">Add Term</h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_10rem]">
            <input
              type="text"
              value={newTerm.term}
              onChange={(event) => setNewTerm((prev) => ({ ...prev, term: event.target.value }))}
              placeholder="Term"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              disabled={!canManage || busy}
            />
            <input
              type="number"
              value={newTerm.priority}
              onChange={(event) => setNewTerm((prev) => ({ ...prev, priority: event.target.value }))}
              placeholder="Priority"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              disabled={!canManage || busy}
            />
            <input
              type="number"
              value={newTerm.termTypeId}
              onChange={(event) => setNewTerm((prev) => ({ ...prev, termTypeId: event.target.value }))}
              placeholder="Term type id"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              disabled={!canManage || busy}
            />
          </div>
          <textarea
            value={newTerm.definition}
            onChange={(event) => setNewTerm((prev) => ({ ...prev, definition: event.target.value }))}
            placeholder="Definition"
            className="mt-3 min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            disabled={!canManage || busy}
          />
          <textarea
            value={newTerm.example}
            onChange={(event) => setNewTerm((prev) => ({ ...prev, example: event.target.value }))}
            placeholder="Example"
            className="mt-3 min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            disabled={!canManage || busy}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canManage || busy}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <Plus className="h-4 w-4" />
            Add Term
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Loading terms...</p>
        ) : terms.length === 0 ? (
          <p className="text-sm text-slate-500">No terms returned.</p>
        ) : (
          <div className="space-y-4">
            {terms.map((row) => {
              const id = getTermId(row);
              const draft = drafts[id] ?? toDraft(row);

              return (
                <article key={id || JSON.stringify(row)} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_auto_auto]">
                    <input
                      type="text"
                      value={draft.term}
                      onChange={(event) =>
                        setDrafts((prev) => ({ ...prev, [id]: { ...draft, term: event.target.value } }))
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
                      type="number"
                      value={draft.termTypeId}
                      onChange={(event) =>
                        setDrafts((prev) => ({ ...prev, [id]: { ...draft, termTypeId: event.target.value } }))
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
                    value={draft.definition}
                    onChange={(event) =>
                      setDrafts((prev) => ({ ...prev, [id]: { ...draft, definition: event.target.value } }))
                    }
                    className="mt-3 min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    disabled={!canManage || busy || !id}
                  />
                  <textarea
                    value={draft.example}
                    onChange={(event) =>
                      setDrafts((prev) => ({ ...prev, [id]: { ...draft, example: event.target.value } }))
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
    </section>
  );
}
