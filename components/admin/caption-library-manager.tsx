"use client";

import { History, Lightbulb, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  addCaptionExample,
  deleteCaptionExample,
  fetchCaptionExamples,
  fetchCaptionRequests,
  updateCaptionExample,
} from "../../lib/services/caption-admin";
import { getErrorMessage } from "../../lib/services/client";
import type { CaptionExample, CaptionRequest } from "../../types";

type CaptionLibraryManagerProps = {
  canManage: boolean;
};

type CaptionLibraryView = "requests" | "examples";

type CaptionExampleDraft = {
  imageDescription: string;
  caption: string;
  explanation: string;
  priority: string;
  imageId: string;
};

const REQUESTS_PAGE_SIZE = 20;
const EXAMPLES_PAGE_SIZE = 20;

function getRequestId(row: CaptionRequest) {
  return String(row.id ?? "");
}

function getExampleId(row: CaptionExample) {
  return typeof row.id === "undefined" ? "" : String(row.id);
}

function clipText(value: string, length: number) {
  if (value.length <= length) return value;
  return `${value.slice(0, Math.max(0, length - 1)).trimEnd()}...`;
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

export function CaptionLibraryManager({ canManage }: CaptionLibraryManagerProps) {
  const [activeView, setActiveView] = useState<CaptionLibraryView>("requests");
  const [requests, setRequests] = useState<CaptionRequest[]>([]);
  const [requestPage, setRequestPage] = useState(0);
  const [examples, setExamples] = useState<CaptionExample[]>([]);
  const [examplePage, setExamplePage] = useState(0);
  const [selectedExampleId, setSelectedExampleId] = useState("");
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

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [requestsRes, examplesRes] = await Promise.all([fetchCaptionRequests(500), fetchCaptionExamples(500)]);
      setRequests(requestsRes);
      setExamples(examplesRes);
    } catch (error) {
      setRequests([]);
      setExamples([]);
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
        examples
          .map((row) => {
            const id = getExampleId(row);
            return id ? [id, toDraft(row)] : null;
          })
          .filter(Boolean) as Array<[string, CaptionExampleDraft]>,
      ),
    );
  }, [examples]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(requests.length / REQUESTS_PAGE_SIZE) - 1);
    setRequestPage((page) => Math.min(page, maxPage));
  }, [requests.length]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(examples.length / EXAMPLES_PAGE_SIZE) - 1);
    setExamplePage((page) => Math.min(page, maxPage));
  }, [examples.length]);

  const requestPageCount = Math.max(1, Math.ceil(requests.length / REQUESTS_PAGE_SIZE));
  const requestStart = requestPage * REQUESTS_PAGE_SIZE;
  const pagedRequests = requests.slice(requestStart, requestStart + REQUESTS_PAGE_SIZE);
  const requestEnd = Math.min(requestStart + pagedRequests.length, requests.length);

  const examplePageCount = Math.max(1, Math.ceil(examples.length / EXAMPLES_PAGE_SIZE));
  const exampleStart = examplePage * EXAMPLES_PAGE_SIZE;
  const pagedExamples = examples.slice(exampleStart, exampleStart + EXAMPLES_PAGE_SIZE);
  const exampleEnd = Math.min(exampleStart + pagedExamples.length, examples.length);
  const selectedExample =
    pagedExamples.find((row) => getExampleId(row) === selectedExampleId) ??
    examples.find((row) => getExampleId(row) === selectedExampleId) ??
    pagedExamples[0] ??
    null;

  useEffect(() => {
    if (!selectedExample) {
      if (selectedExampleId) setSelectedExampleId("");
      return;
    }

    const nextId = getExampleId(selectedExample);
    if (nextId && nextId !== selectedExampleId) {
      setSelectedExampleId(nextId);
    }
  }, [selectedExample, selectedExampleId]);

  useEffect(() => {
    if (pagedExamples.length === 0) return;
    const selectedOnPage = pagedExamples.some((row) => getExampleId(row) === selectedExampleId);
    if (!selectedOnPage) {
      setSelectedExampleId(getExampleId(pagedExamples[0]));
    }
  }, [examplePage, pagedExamples, selectedExampleId]);

  const exampleStats = useMemo(() => {
    const selectedId = selectedExample ? getExampleId(selectedExample) : "";
    return {
      selectedId,
      selectedDraft: selectedId ? drafts[selectedId] ?? toDraft(selectedExample as CaptionExample) : null,
    };
  }, [drafts, selectedExample]);

  async function handleAddExample() {
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
      await loadData();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveExample(row: CaptionExample) {
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
      await loadData();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteExample(row: CaptionExample) {
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
              {activeView === "requests" ? (
                <History className="h-5 w-5 text-slate-700" />
              ) : (
                <Lightbulb className="h-5 w-5 text-slate-700" />
              )}
              <h2 className="text-lg font-semibold text-slate-900">Caption Requests + Examples</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Review incoming caption requests and manage the example captions that guide the model. These live in the
              same caption workflow, so they now share one admin view.
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
            { id: "requests", label: "Caption Requests" },
            { id: "examples", label: "Caption Examples" },
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

      {activeView === "requests" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {loading ? (
            <p className="text-sm text-slate-500">Loading caption requests...</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-slate-500">No caption requests returned.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Request History</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Showing {requests.length === 0 ? 0 : requestStart + 1}-{requestEnd} of {requests.length}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRequestPage((page) => Math.max(0, page - 1))}
                    disabled={requestPage === 0}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <p className="text-xs text-slate-500">
                    Page {requestPage + 1} of {requestPageCount}
                  </p>
                  <button
                    type="button"
                    onClick={() => setRequestPage((page) => Math.min(requestPageCount - 1, page + 1))}
                    disabled={requestPage >= requestPageCount - 1}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Request ID</th>
                      <th className="px-3 py-2">Image ID</th>
                      <th className="px-3 py-2">Profile ID</th>
                      <th className="px-3 py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRequests.map((row) => (
                      <tr key={getRequestId(row) || JSON.stringify(row)} className="border-t border-slate-100 align-top">
                        <td className="px-3 py-3 font-mono text-xs text-slate-700">{getRequestId(row) || "-"}</td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-600">{String(row.image_id || "-")}</td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-600">{String(row.profile_id || "-")}</td>
                        <td className="px-3 py-3 text-slate-600">{row.created_datetime_utc ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
              onClick={handleAddExample}
              disabled={!canManage || busy}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <Plus className="h-4 w-4" />
              Add Example
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {loading ? (
              <p className="text-sm text-slate-500">Loading caption examples...</p>
            ) : examples.length === 0 ? (
              <p className="text-sm text-slate-500">No caption examples returned.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Example Library</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Showing {examples.length === 0 ? 0 : exampleStart + 1}-{exampleEnd} of {examples.length}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExamplePage((page) => Math.max(0, page - 1))}
                      disabled={examplePage === 0}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <p className="text-xs text-slate-500">
                      Page {examplePage + 1} of {examplePageCount}
                    </p>
                    <button
                      type="button"
                      onClick={() => setExamplePage((page) => Math.min(examplePageCount - 1, page + 1))}
                      disabled={examplePage >= examplePageCount - 1}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="space-y-2">
                      {pagedExamples.map((row) => {
                        const id = getExampleId(row);
                        const selected = selectedExampleId === id;
                        return (
                          <button
                            key={id || JSON.stringify(row)}
                            type="button"
                            onClick={() => setSelectedExampleId(id)}
                            className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                              selected
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-100"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-semibold">{clipText(row.caption ?? "Untitled example", 60)}</p>
                              <div className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${selected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"}`}>
                                P{typeof row.priority === "number" ? row.priority : 0}
                              </div>
                            </div>
                            <p className={`mt-2 text-xs leading-relaxed ${selected ? "text-slate-200" : "text-slate-500"}`}>
                              {clipText(row.image_description ?? "", 96) || "No image description."}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedExample && exampleStats.selectedDraft ? (
                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">Selected Example</h3>
                          <p className="mt-1 font-mono text-xs text-slate-500">{exampleStats.selectedId}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveExample(selectedExample)}
                            disabled={!canManage || busy || !exampleStats.selectedId}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Save className="h-3.5 w-3.5" />
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExample(selectedExample)}
                            disabled={!canManage || busy || !exampleStats.selectedId}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)]">
                        <input
                          type="text"
                          value={exampleStats.selectedDraft.imageDescription}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [exampleStats.selectedId]: { ...exampleStats.selectedDraft!, imageDescription: event.target.value },
                            }))
                          }
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          disabled={!canManage || busy || !exampleStats.selectedId}
                        />
                        <input
                          type="number"
                          value={exampleStats.selectedDraft.priority}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [exampleStats.selectedId]: { ...exampleStats.selectedDraft!, priority: event.target.value },
                            }))
                          }
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          disabled={!canManage || busy || !exampleStats.selectedId}
                        />
                        <input
                          type="text"
                          value={exampleStats.selectedDraft.imageId}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [exampleStats.selectedId]: { ...exampleStats.selectedDraft!, imageId: event.target.value },
                            }))
                          }
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          disabled={!canManage || busy || !exampleStats.selectedId}
                        />
                      </div>
                      <textarea
                        value={exampleStats.selectedDraft.caption}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [exampleStats.selectedId]: { ...exampleStats.selectedDraft!, caption: event.target.value },
                          }))
                        }
                        className="mt-3 min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        disabled={!canManage || busy || !exampleStats.selectedId}
                      />
                      <textarea
                        value={exampleStats.selectedDraft.explanation}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [exampleStats.selectedId]: { ...exampleStats.selectedDraft!, explanation: event.target.value },
                          }))
                        }
                        className="mt-3 min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        disabled={!canManage || busy || !exampleStats.selectedId}
                      />
                    </article>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                      Select a caption example to inspect or edit it.
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
