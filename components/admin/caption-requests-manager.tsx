"use client";

import { History } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchCaptionRequests } from "../../lib/services/caption-admin";
import { getErrorMessage } from "../../lib/services/client";
import type { CaptionRequest } from "../../types";

type CaptionRequestsManagerProps = {
  limit?: number;
};

function getRequestId(row: CaptionRequest) {
  return String(row.id ?? "");
}

export function CaptionRequestsManager({ limit = 500 }: CaptionRequestsManagerProps) {
  const [requests, setRequests] = useState<CaptionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadRequests() {
    setLoading(true);
    setError(null);

    try {
      setRequests(await fetchCaptionRequests(limit));
    } catch (error) {
      setRequests([]);
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, [limit]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">Caption Requests</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Read rows from <code className="rounded bg-slate-100 px-1.5 py-0.5">caption_requests</code> so request history is visible in the admin dashboard.
          </p>
        </div>
        <button
          type="button"
          onClick={loadRequests}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading caption requests...</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-slate-500">No caption requests returned.</p>
      ) : (
        <div className="max-h-[28rem] overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-2">Request ID</th>
                <th className="px-3 py-2">Image ID</th>
                <th className="px-3 py-2">Profile ID</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((row) => (
                <tr key={getRequestId(row) || JSON.stringify(row)} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-3 font-mono text-xs text-slate-700">{getRequestId(row) || "-"}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-600">{String(row.image_id || "-")}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-600">{String(row.profile_id || "-")}</td>
                  <td className="px-3 py-3 text-slate-600">{row.created_datetime_utc ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
