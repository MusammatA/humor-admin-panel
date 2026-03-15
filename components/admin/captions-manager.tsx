"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { CaptionExamplesManager } from "./caption-examples-manager";
import { CaptionRequestsManager } from "./caption-requests-manager";
import { deleteCaptionById, fetchCaptions, updateCaptionText } from "../../lib/services/captions";
import { getErrorMessage } from "../../lib/services/client";
import type { Caption as CaptionRow } from "../../types";

const CAPTIONS_PER_PAGE = 20;

function getCaptionValue(row: CaptionRow) {
  return row.caption_text ?? row.text ?? "";
}

function getTextColumn(row: CaptionRow): "caption_text" | "text" {
  if ("caption_text" in row) return "caption_text";
  return "text";
}

type CaptionsManagerProps = {
  canManage: boolean;
  title?: string;
  description?: string;
  includeRequests?: boolean;
  includeExamples?: boolean;
};

export function CaptionsManager({
  canManage,
  title = "Caption Management",
  description,
  includeRequests = true,
  includeExamples = true,
}: CaptionsManagerProps) {
  const [captions, setCaptions] = useState<CaptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<CaptionRow | null>(null);
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);

  async function loadCaptions() {
    setLoading(true);
    setError(null);
    try {
      setCaptions(await fetchCaptions());
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCaptions();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [captions.length]);

  async function handleDelete(id: string) {
    setError(null);
    const confirmed = window.confirm("Delete this caption?");
    if (!confirmed) return;

    try {
      await deleteCaptionById(id);
      setCaptions((prev) => prev.filter((row) => row.id !== id));
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }

  function openEditModal(row: CaptionRow) {
    setEditing(row);
    setDraftText(getCaptionValue(row));
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    setError(null);

    const textColumn = getTextColumn(editing);
    try {
      await updateCaptionText(editing.id, draftText);
      setCaptions((prev) =>
        prev.map((row) =>
          row.id === editing.id ? { ...row, [textColumn]: draftText } : row
        )
      );
      setEditing(null);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(captions.length / CAPTIONS_PER_PAGE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleCaptions = captions.slice(
    currentPage * CAPTIONS_PER_PAGE,
    currentPage * CAPTIONS_PER_PAGE + CAPTIONS_PER_PAGE,
  );

  return (
    <section className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-600">
              {description ??
                (canManage
                  ? "Fetch, edit, and delete caption rows."
                  : "Read-only caption explorer for non-admin users.")}
            </p>
          </div>
          <button
            onClick={loadCaptions}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            type="button"
          >
            Refresh
          </button>
        </div>

        {captions.length ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p>
              Showing {currentPage * CAPTIONS_PER_PAGE + 1}-
              {Math.min((currentPage + 1) * CAPTIONS_PER_PAGE, captions.length)} of {captions.length}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(0, value - 1))}
                disabled={currentPage === 0}
                className="rounded-md border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev 20
              </button>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                disabled={currentPage >= pageCount - 1}
                className="rounded-md border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next 20
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-500">Loading captions...</p>
        ) : captions.length === 0 ? (
          <p className="text-sm text-slate-500">No caption rows found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-2">Caption</th>
                  <th className="px-3 py-2">Topic</th>
                  <th className="px-3 py-2">User</th>
                  {canManage ? <th className="px-3 py-2">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {visibleCaptions.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 align-top">
                    <td className="max-w-xl px-3 py-3 text-slate-800">{getCaptionValue(row)}</td>
                    <td className="px-3 py-3 text-slate-600">{row.topic ?? "-"}</td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-500">
                      {row.user_id ?? "-"}
                    </td>
                    {canManage ? (
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(row)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            type="button"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(row.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-300 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                            type="button"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editing && canManage ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Edit Caption</h3>
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                className="min-h-36 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none ring-slate-300 focus:ring"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  type="button"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  type="button"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {includeRequests ? <CaptionRequestsManager /> : null}
      {includeExamples ? <CaptionExamplesManager canManage={canManage} /> : null}
    </section>
  );
}
