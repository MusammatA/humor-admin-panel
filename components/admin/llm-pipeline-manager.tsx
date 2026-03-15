"use client";

import { FileText, Link2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "../../lib/services/client";
import { fetchPromptChains, fetchResponses } from "../../lib/services/llm";
import type { LLMPromptChain, LLMResponse } from "../../types";

type LLMPipelineManagerProps = {
  responseLimit?: number;
};

const CHAINS_PAGE_SIZE = 20;
const RESPONSES_PAGE_SIZE = 20;

function getChainId(row: LLMPromptChain) {
  return String(row.id ?? "");
}

function clipText(value: unknown, length: number) {
  const text = String(value ?? "").trim();
  if (text.length <= length) return text;
  return `${text.slice(0, Math.max(0, length - 1)).trimEnd()}...`;
}

export function LLMPipelineManager({ responseLimit = 1000 }: LLMPipelineManagerProps) {
  const [chains, setChains] = useState<LLMPromptChain[]>([]);
  const [responses, setResponses] = useState<LLMResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chainPage, setChainPage] = useState(0);
  const [responsePage, setResponsePage] = useState(0);
  const [selectedChainId, setSelectedChainId] = useState("");

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [chainsRes, responsesRes] = await Promise.all([fetchPromptChains(500), fetchResponses(responseLimit)]);
      setChains(chainsRes);
      setResponses(responsesRes);
    } catch (error) {
      setChains([]);
      setResponses([]);
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [responseLimit]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(chains.length / CHAINS_PAGE_SIZE) - 1);
    setChainPage((page) => Math.min(page, maxPage));
  }, [chains.length]);

  const chainPageCount = Math.max(1, Math.ceil(chains.length / CHAINS_PAGE_SIZE));
  const chainStart = chainPage * CHAINS_PAGE_SIZE;
  const pagedChains = chains.slice(chainStart, chainStart + CHAINS_PAGE_SIZE);
  const chainEnd = Math.min(chainStart + pagedChains.length, chains.length);
  const selectedChain =
    pagedChains.find((row) => getChainId(row) === selectedChainId) ??
    chains.find((row) => getChainId(row) === selectedChainId) ??
    pagedChains[0] ??
    null;

  useEffect(() => {
    if (!selectedChain) {
      if (selectedChainId) setSelectedChainId("");
      return;
    }

    const nextId = getChainId(selectedChain);
    if (nextId && nextId !== selectedChainId) {
      setSelectedChainId(nextId);
    }
  }, [selectedChain, selectedChainId]);

  useEffect(() => {
    if (pagedChains.length === 0) return;
    const onPage = pagedChains.some((row) => getChainId(row) === selectedChainId);
    if (!onPage) {
      setSelectedChainId(getChainId(pagedChains[0]));
    }
  }, [chainPage, pagedChains, selectedChainId]);

  const responsesByChain = useMemo(() => {
    return Object.fromEntries(
      Object.entries(
        responses.reduce<Record<string, number>>((acc, row) => {
          const key = String(row.llm_prompt_chain_id ?? "");
          if (!key) return acc;
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {}),
      ),
    );
  }, [responses]);

  const filteredResponses = useMemo(() => {
    const activeChainId = selectedChain ? getChainId(selectedChain) : "";
    return responses.filter((row) => String(row.llm_prompt_chain_id ?? "") === activeChainId);
  }, [responses, selectedChain]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredResponses.length / RESPONSES_PAGE_SIZE) - 1);
    setResponsePage((page) => Math.min(page, maxPage));
  }, [filteredResponses.length]);

  const responsePageCount = Math.max(1, Math.ceil(filteredResponses.length / RESPONSES_PAGE_SIZE));
  const responseStart = responsePage * RESPONSES_PAGE_SIZE;
  const pagedResponses = filteredResponses.slice(responseStart, responseStart + RESPONSES_PAGE_SIZE);
  const responseEnd = Math.min(responseStart + pagedResponses.length, filteredResponses.length);

  return (
    <section className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-slate-700" />
              <h2 className="text-lg font-semibold text-slate-900">Prompt Chains + LLM Responses</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Prompt chains and model responses are part of the same execution trail. Select a chain on the left to
              inspect the responses produced for it on the right.
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Loading prompt chains and llm responses...</p>
        ) : chains.length === 0 ? (
          <p className="text-sm text-slate-500">No prompt chains returned.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Chain Directory</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Showing {chains.length === 0 ? 0 : chainStart + 1}-{chainEnd} of {chains.length}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setChainPage((page) => Math.max(0, page - 1))}
                      disabled={chainPage === 0}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setChainPage((page) => Math.min(chainPageCount - 1, page + 1))}
                      disabled={chainPage >= chainPageCount - 1}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="space-y-2">
                    {pagedChains.map((row) => {
                      const id = getChainId(row);
                      const selected = selectedChainId === id;
                      const responseCount = responsesByChain[id] ?? 0;
                      return (
                        <button
                          key={id || JSON.stringify(row)}
                          type="button"
                          onClick={() => setSelectedChainId(id)}
                          className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                            selected
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold">Chain {id}</p>
                            <div className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${selected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"}`}>
                              {responseCount} responses
                            </div>
                          </div>
                          <p className={`mt-2 text-xs ${selected ? "text-slate-200" : "text-slate-500"}`}>
                            Caption request: {String(row.caption_request_id ?? "-")}
                          </p>
                          <p className={`mt-1 text-xs ${selected ? "text-slate-200" : "text-slate-500"}`}>
                            Created: {row.created_datetime_utc ?? row.created_at ?? "-"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {selectedChain ? (
                  <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-slate-700" />
                          <h3 className="text-base font-semibold text-slate-900">Responses For Chain {getChainId(selectedChain)}</h3>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          Caption request id: <span className="font-mono text-xs text-slate-700">{String(selectedChain.caption_request_id ?? "-")}</span>
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Only the most recent {responseLimit} response rows are loaded into this admin view.</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Response Log</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Showing {filteredResponses.length === 0 ? 0 : responseStart + 1}-{responseEnd} of {filteredResponses.length}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setResponsePage((page) => Math.max(0, page - 1))}
                          disabled={responsePage === 0}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          onClick={() => setResponsePage((page) => Math.min(responsePageCount - 1, page + 1))}
                          disabled={responsePage >= responsePageCount - 1}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>

                    {filteredResponses.length === 0 ? (
                      <p className="mt-4 text-sm text-slate-500">No loaded response rows point at this chain.</p>
                    ) : (
                      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th className="px-3 py-2">Created</th>
                              <th className="px-3 py-2">Model</th>
                              <th className="px-3 py-2">Request</th>
                              <th className="px-3 py-2">Seconds</th>
                              <th className="px-3 py-2">Response</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagedResponses.map((row) => (
                              <tr key={row.id || JSON.stringify(row)} className="border-t border-slate-100 align-top">
                                <td className="px-3 py-3 text-slate-600">{row.created_datetime_utc ?? "-"}</td>
                                <td className="px-3 py-3 font-mono text-xs text-slate-700">{String(row.llm_model_id ?? "-")}</td>
                                <td className="px-3 py-3 font-mono text-xs text-slate-700">{String(row.caption_request_id ?? "-")}</td>
                                <td className="px-3 py-3 text-slate-600">{String(row.processing_time_seconds ?? "-")}</td>
                                <td className="max-w-3xl px-3 py-3 text-slate-700">{clipText(row.llm_model_response, 220) || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </article>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                    Select a prompt chain to inspect its responses.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
