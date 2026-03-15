"use client";

import { Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "../../lib/services/client";
import { fetchPromptChains } from "../../lib/services/llm";
import type { LLMPromptChain } from "../../types";

type LLMPromptChainsManagerProps = {
  title?: string;
};

function getChainId(row: LLMPromptChain) {
  return String(row.id ?? "");
}

export function LLMPromptChainsManager({ title = "Prompt Chains" }: LLMPromptChainsManagerProps) {
  const [chains, setChains] = useState<LLMPromptChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadChains() {
    setLoading(true);
    setError(null);

    try {
      setChains(await fetchPromptChains(500));
    } catch (error) {
      setChains([]);
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadChains();
  }, []);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-violet-300" />
            <h2 className="text-2xl font-semibold text-white">{title}</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Read-only view of <code className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200">llm_prompt_chains</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={loadChains}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/10"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-400">Loading prompt chains...</p>
      ) : chains.length === 0 ? (
        <p className="text-sm text-slate-400">No prompt chains returned.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-slate-400">
              <tr>
                <th className="px-4 py-3">Chain ID</th>
                <th className="px-4 py-3">Caption Request ID</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {chains.map((row) => (
                <tr key={getChainId(row) || JSON.stringify(row)} className="border-t border-white/10 text-slate-200">
                  <td className="px-4 py-3 font-mono text-xs">{getChainId(row) || "-"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{String(row.caption_request_id ?? "-")}</td>
                  <td className="px-4 py-3 text-slate-400">{row.created_datetime_utc ?? row.created_at ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
