"use client";

import { Mail, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage, getSupabaseBrowserClientOrThrow } from "../../lib/services/client";
import type { WhitelistedEmail } from "../../types";

type WhitelistManagerProps = {
  canManage: boolean;
};

type EntryDraft = {
  email: string;
  isSuperadmin: boolean;
};

const ENTRIES_PAGE_SIZE = 20;

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function getEntryId(row: WhitelistedEmail) {
  return String(row.id || "");
}

function getEntryEmail(row: WhitelistedEmail) {
  return normalizeEmail(row.email);
}

function getEntrySuperadmin(row: WhitelistedEmail) {
  return row.Superadmin === true;
}

export function WhitelistManager({ canManage }: WhitelistManagerProps) {
  const [entries, setEntries] = useState<WhitelistedEmail[]>([]);
  const [drafts, setDrafts] = useState<Record<string, EntryDraft>>({});
  const [newEmail, setNewEmail] = useState("");
  const [newIsSuperadmin, setNewIsSuperadmin] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadEntries() {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClientOrThrow();
      const { data, error: queryError } = await supabase.from("whitelisted_emails").select("*").limit(500);
      if (queryError) {
        throw new Error(queryError.message);
      }

      setEntries(
        [...((data ?? []) as WhitelistedEmail[])].sort((a, b) =>
          getEntryEmail(a).localeCompare(getEntryEmail(b)),
        ),
      );
    } catch (error) {
      setEntries([]);
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEntries();
  }, []);

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        entries
          .map((row) => {
            const id = getEntryId(row);
            if (!id) return null;

            return [
              id,
              {
                email: getEntryEmail(row),
                isSuperadmin: getEntrySuperadmin(row),
              },
            ];
          })
          .filter(Boolean) as Array<[string, EntryDraft]>,
      ),
    );
  }, [entries]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(entries.length / ENTRIES_PAGE_SIZE) - 1);
    setCurrentPage((page) => Math.min(page, maxPage));
  }, [entries.length]);

  const pageCount = Math.max(1, Math.ceil(entries.length / ENTRIES_PAGE_SIZE));
  const pageStart = currentPage * ENTRIES_PAGE_SIZE;
  const pagedEntries = entries.slice(pageStart, pageStart + ENTRIES_PAGE_SIZE);
  const pageEnd = Math.min(pageStart + pagedEntries.length, entries.length);

  async function addEntry() {
    if (!canManage) return;

    const email = normalizeEmail(newEmail);
    if (!email) {
      setError("Email is required.");
      return;
    }

    if (entries.some((row) => getEntryEmail(row) === email)) {
      setError(`Email ${email} is already whitelisted.`);
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClientOrThrow();
      const { error: insertError } = await supabase.from("whitelisted_emails").insert([
        {
          email,
          Superadmin: newIsSuperadmin,
        },
      ]);

      if (insertError) {
        throw new Error(insertError.message);
      }

      setNewEmail("");
      setNewIsSuperadmin(false);
      setMessage(`Added ${email} to whitelisted_emails.`);
      await loadEntries();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveEntry(row: WhitelistedEmail) {
    if (!canManage) return;

    const id = getEntryId(row);
    const draft = drafts[id];
    const email = normalizeEmail(draft?.email);

    if (!id) {
      setError("Cannot update a whitelisted email row without an id.");
      return;
    }

    if (!email) {
      setError("Email is required.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClientOrThrow();
      const { error: updateError } = await supabase
        .from("whitelisted_emails")
        .update({
          email,
          Superadmin: draft.isSuperadmin,
        })
        .eq("id", id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setMessage(`Updated ${email}.`);
      await loadEntries();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(row: WhitelistedEmail) {
    if (!canManage) return;

    const id = getEntryId(row);
    const email = getEntryEmail(row);
    if (!id) {
      setError("Cannot delete a whitelisted email row without an id.");
      return;
    }

    const confirmed = window.confirm(`Delete ${email || "this whitelisted email"}?`);
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClientOrThrow();
      const { error: deleteError } = await supabase.from("whitelisted_emails").delete().eq("id", id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      setMessage(`Deleted ${email || id}.`);
      await loadEntries();
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
            <Mail className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">Whitelisted Emails</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Read, add, update, and delete rows from <code className="rounded bg-slate-100 px-1.5 py-0.5">whitelisted_emails</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={loadEntries}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          disabled={busy}
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
        <h3 className="text-sm font-semibold text-slate-900">Add Whitelisted Email</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          <input
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder="name@columbia.edu"
            className="min-w-[16rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            disabled={!canManage || busy}
          />
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={newIsSuperadmin}
              onChange={(event) => setNewIsSuperadmin(event.target.checked)}
              disabled={!canManage || busy}
            />
            Superadmin
          </label>
          <button
            type="button"
            onClick={addEntry}
            disabled={!canManage || busy}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <Plus className="h-4 w-4" />
            Add Email
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-slate-500">Loading whitelisted emails...</p>
      ) : entries.length === 0 ? (
        <p className="mt-5 text-sm text-slate-500">No whitelisted emails returned.</p>
      ) : (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Showing {entries.length === 0 ? 0 : pageStart + 1}-{pageEnd} of {entries.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
                disabled={currentPage === 0}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
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

          {pagedEntries.map((row) => {
            const id = getEntryId(row);
            const draft = drafts[id] ?? { email: getEntryEmail(row), isSuperadmin: getEntrySuperadmin(row) };

            return (
              <div key={id || JSON.stringify(row)} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="email"
                    value={draft.email}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [id]: {
                          email: event.target.value,
                          isSuperadmin: draft.isSuperadmin,
                        },
                      }))
                    }
                    className="min-w-[16rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    disabled={!canManage || busy || !id}
                  />
                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.isSuperadmin}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [id]: {
                            email: draft.email,
                            isSuperadmin: event.target.checked,
                          },
                        }))
                      }
                      disabled={!canManage || busy || !id}
                    />
                    <ShieldCheck className="h-4 w-4 text-slate-500" />
                    Superadmin
                  </label>
                  <button
                    type="button"
                    onClick={() => saveEntry(row)}
                    disabled={!canManage || busy || !id}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteEntry(row)}
                    disabled={!canManage || busy || !id}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
                <p className="mt-2 font-mono text-xs text-slate-500">{id || "No id column"}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
