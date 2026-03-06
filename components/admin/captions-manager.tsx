"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";

type CaptionRow = {
  id: string;
  user_id?: string | null;
  topic?: string | null;
  caption_text?: string | null;
  text?: string | null;
  created_at?: string | null;
};

function getCaptionValue(row: CaptionRow) {
  return row.caption_text ?? row.text ?? "";
}

function getTextColumn(row: CaptionRow): "caption_text" | "text" {
  if ("caption_text" in row) return "caption_text";
  return "text";
}

type CaptionsManagerProps = {
  canManage: boolean;
};

export function CaptionsManager({ canManage }: CaptionsManagerProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [captions, setCaptions] = useState<CaptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<CaptionRow | null>(null);
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadCaptions() {
    if (!supabase) {
      setError("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase.from("captions").select("*");

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setCaptions((data as CaptionRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadCaptions();
  }, []);

  async function handleDelete(id: string) {
    if (!supabase) return;
    setError(null);
    const confirmed = window.confirm("Delete this caption?");
    if (!confirmed) return;

    const { error: deleteError } = await supabase.from("captions").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setCaptions((prev) => prev.filter((row) => row.id !== id));
  }

  function openEditModal(row: CaptionRow) {
    setEditing(row);
    setDraftText(getCaptionValue(row));
  }

  async function saveEdit() {
    if (!editing || !supabase) return;
    setSaving(true);
    setError(null);

    const textColumn = getTextColumn(editing);
    const { error: updateError } = await supabase
      .from("captions")
      .update({ [textColumn]: draftText })
      .eq("id", editing.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setCaptions((prev) =>
      prev.map((row) =>
        row.id === editing.id ? { ...row, [textColumn]: draftText } : row
      )
    );
    setSaving(false);
    setEditing(null);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Caption Management</h2>
          <p className="text-sm text-slate-600">
            {canManage
              ? "Fetch, edit, and delete caption rows."
              : "Read-only caption explorer for non-admin users."}
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
              {captions.map((row) => (
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
              className="min-h-36 w-full rounded-lg border border-slate-300 p-3 text-sm outline-none ring-slate-300 focus:ring"
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
  );
}
