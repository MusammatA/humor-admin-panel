"use client";

import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "../../lib/services/client";
import { fetchResponses } from "../../lib/services/llm";
import type { LLMResponse } from "../../types";

type LLMResponsesManagerProps = {
  title?: string;
};

function truncate(value: unknown, max = 160) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function LLMResponsesManager({ title = "LLM Responses" }: LLMResponsesManagerProps) {
  const [responses, setResponses] = useState<LLMResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadResponses() {
    setLoading(true);
    setError(null);

    try {
      setResponses(await fetchResponses(500));
    } catch (error) {
      setResponses([]);
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadResponses();
  }, []);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-300" />
            <h2 className="text-2xl font-semibold text-white">{title}</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Read-only view of recent <code className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200">llm_model_responses</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={loadResponses}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/10"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-400">Loading llm responses...</p>
      ) : responses.length === 0 ? (
        <p className="text-sm text-slate-400">No llm responses returned.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-slate-400">
              <tr>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Chain</th>
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Seconds</th>
                <th className="px-4 py-3">Response</th>
              </tr>
            </thead>
            <tbody>
              {responses.map((row) => (
                <tr key={row.id || JSON.stringify(row)} className="border-t border-white/10 text-slate-200 align-top">
                  <td className="px-4 py-3 text-slate-400">{row.created_datetime_utc ?? "-"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{String(row.llm_model_id ?? "-")}</td>
                  <td className="px-4 py-3 font-mono text-xs">{String(row.llm_prompt_chain_id ?? "-")}</td>
                  <td className="px-4 py-3 font-mono text-xs">{String(row.caption_request_id ?? "-")}</td>
                  <td className="px-4 py-3">{String(row.processing_time_seconds ?? "-")}</td>
                  <td className="max-w-xl px-4 py-3 text-slate-300">{truncate(row.llm_model_response)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
