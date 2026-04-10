"use client";

import { BookText, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminEmptyState, AdminLoadingState, AdminSearchInput, useAdminToast } from "./admin-feedback";
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

const TERMS_PAGE_SIZE = 20;

function getTermId(row: Term) {
  return typeof row.id === "undefined" ? "" : String(row.id);
}

function clipText(value: string, length: number) {
  if (value.length <= length) return value;
  return `${value.slice(0, Math.max(0, length - 1)).trimEnd()}...`;
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
  const { notify } = useAdminToast();
  const [terms, setTerms] = useState<Term[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TermDraft>>({});
  const [selectedTermId, setSelectedTermId] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
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

  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery]);

  const filteredTerms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return terms;

    return terms.filter((row) =>
      [row.term, row.definition, row.example, row.id, row.priority, row.term_type_id]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(query)),
    );
  }, [searchQuery, terms]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredTerms.length / TERMS_PAGE_SIZE) - 1);
    setCurrentPage((page) => Math.min(page, maxPage));
  }, [filteredTerms.length]);

  const pageCount = Math.max(1, Math.ceil(filteredTerms.length / TERMS_PAGE_SIZE));
  const pageStart = currentPage * TERMS_PAGE_SIZE;
  const pagedTerms = filteredTerms.slice(pageStart, pageStart + TERMS_PAGE_SIZE);
  const pageEnd = Math.min(pageStart + pagedTerms.length, filteredTerms.length);
  const selectedTerm =
    pagedTerms.find((row) => getTermId(row) === selectedTermId) ??
    filteredTerms.find((row) => getTermId(row) === selectedTermId) ??
    pagedTerms[0] ??
    null;

  useEffect(() => {
    if (!selectedTerm) {
      if (selectedTermId) setSelectedTermId("");
      return;
    }

    const selectedId = getTermId(selectedTerm);
    if (selectedId && selectedId !== selectedTermId) {
      setSelectedTermId(selectedId);
    }
  }, [selectedTerm, selectedTermId]);

  useEffect(() => {
    if (pagedTerms.length === 0) return;
    const selectedOnPage = pagedTerms.some((row) => getTermId(row) === selectedTermId);
    if (!selectedOnPage) {
      setSelectedTermId(getTermId(pagedTerms[0]));
    }
  }, [currentPage, pagedTerms, selectedTermId]);

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
      notify({ type: "success", title: "Term added", message: term });
      await loadTerms();
    } catch (error) {
      const message = getErrorMessage(error);
      setError(message);
      notify({ type: "error", title: "Could not add term", message });
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
      notify({ type: "success", title: "Term saved", message: term });
      await loadTerms();
    } catch (error) {
      const message = getErrorMessage(error);
      setError(message);
      notify({ type: "error", title: "Could not save term", message });
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
      notify({ type: "success", title: "Term deleted", message: term });
      await loadTerms();
    } catch (error) {
      const message = getErrorMessage(error);
      setError(message);
      notify({ type: "error", title: "Could not delete term", message });
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
              Manage glossary words and their notes.
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
          <AdminLoadingState label="Loading terms..." />
        ) : terms.length === 0 ? (
          <AdminEmptyState title="No terms found" description="Add the first glossary term above." />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Term Directory</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Showing {filteredTerms.length === 0 ? 0 : pageStart + 1}-{pageEnd} of {filteredTerms.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
                  disabled={currentPage === 0}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <p className="text-xs text-slate-500">
                  Page {currentPage + 1} of {pageCount}
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(pageCount - 1, page + 1))}
                  disabled={currentPage >= pageCount - 1}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>

            <AdminSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search terms, definitions, examples, or ids"
            />

            {filteredTerms.length === 0 ? (
              <AdminEmptyState title="No matching terms" description="Try a different search." />
            ) : (
            <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="space-y-2">
                  {pagedTerms.map((row) => {
                    const id = getTermId(row);
                    const selected = selectedTermId === id;
                    return (
                      <button
                        key={id || JSON.stringify(row)}
                        type="button"
                        onClick={() => setSelectedTermId(id)}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                          selected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold">{row.term || "Untitled term"}</p>
                          <div className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${selected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"}`}>
                            P{typeof row.priority === "number" ? row.priority : 0}
                          </div>
                        </div>
                        <p className={`mt-2 text-xs leading-relaxed ${selected ? "text-slate-200" : "text-slate-500"}`}>
                          {clipText(row.definition ?? "", 90) || "No definition yet."}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedTerm ? (() => {
                const id = getTermId(selectedTerm);
                const draft = drafts[id] ?? toDraft(selectedTerm);

                return (
                  <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{draft.term || "Selected Term"}</h3>
                        <p className="mt-1 font-mono text-xs text-slate-500">{id || "No id column"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleSave(selectedTerm)}
                          disabled={!canManage || busy || !id}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Save className="h-3.5 w-3.5" />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(selectedTerm)}
                          disabled={!canManage || busy || !id}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_10rem]">
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
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                          Definition
                        </label>
                        <textarea
                          value={draft.definition}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [id]: { ...draft, definition: event.target.value } }))
                          }
                          className="mt-2 min-h-48 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          disabled={!canManage || busy || !id}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                          Example
                        </label>
                        <textarea
                          value={draft.example}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [id]: { ...draft, example: event.target.value } }))
                          }
                          className="mt-2 min-h-48 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          disabled={!canManage || busy || !id}
                        />
                      </div>
                    </div>
                  </article>
                );
              })() : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                  Select a term to inspect or edit it.
                </div>
              )}
            </div>
            )}
          </div>
        )}
      </section>
    </section>
  );
}
