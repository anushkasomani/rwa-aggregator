"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "@/components/state/AppStateProvider";
import { useWallet } from "@/components/wallet/WalletProvider";

type StrategyCardAPI = {
  id: string;
  name: string;
  creator_address: string;
  plan_summary: { assets?: string[]; cadence?: string; crux?: string };
  backtest_stats?: { cagr?: number; sharpe?: number; max_dd?: number };
  spark?: number[];
  is_public: boolean;
  tags?: string[];
  created_at: string;
};

type ExplorePageAPI = {
  items: StrategyCardAPI[];
  next_cursor?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";
const EXPLORE_URL = `${API_BASE}/v1/strategies/explore`;

export default function ExplorePage() {
  const { state, setState, setToast } = useAppState();
  const { address, setModalOpen } = useWallet();

  const [q, setQ] = useState("");
  const [cadence, setCadence] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  // keep local next_cursor to support "Load more"
  const nextCursorRef = useRef<string | null>(null);

  // Initial fetch (only once per mount if list empty)
  useEffect(() => {
    if (state.explore?.list?.length) return;
    fetchExplore(true).catch((e) =>
      setToast({ title: "Explore load failed", description: String(e), tone: "error" })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchExplore(initial: boolean) {
    if (loading) return;
    setLoading(true);
    try {
      const url = new URL(EXPLORE_URL);
      url.searchParams.set("limit", "24");
      if (!initial && nextCursorRef.current) {
        url.searchParams.set("cursor", nextCursorRef.current);
      }
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ExplorePageAPI = await res.json();

      // Merge/replace list in app state
      setState((s: any) => {
        const prev = initial ? [] : (s.explore?.list ?? []);
        const merged = [...prev, ...json.items];
        return {
          ...s,
          explore: {
            ...(s.explore ?? {}),
            list: merged,
            cursor: json.next_cursor ?? null,
          },
        };
      });

      nextCursorRef.current = json.next_cursor ?? null;
    } finally {
      setLoading(false);
    }
  }

  const list: StrategyCardAPI[] = (state.explore?.list as StrategyCardAPI[]) ?? [];

  // Simple client filters
  const filtered = useMemo(() => {
    return list.filter((it) => {
      const hay =
        `${it.name} ${it.creator_address} ${(it.tags || []).join(" ")} ${(it.plan_summary?.assets || []).join(" ")} ${it.plan_summary?.cadence || ""}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (cadence && (it.plan_summary?.cadence || "").toLowerCase() !== cadence.toLowerCase())
        return false;
      return true;
    });
  }, [list, q, cadence]);

  // Tiny sparkline (from API 'spark' vector)
  function Spark({ series }: { series?: number[] }) {
    if (!series || series.length < 2) {
      return (
        <div className="w-full h-10 grid place-items-center text-subtle text-xs">
          no spark
        </div>
      );
    }
    const w = 140,
      h = 36,
      pad = 4;
    const min = Math.min(...series),
      max = Math.max(...series);
    const span = max - min || 1;
    const d = series
      .map((y, i) => {
        const x = pad + (i / (series.length - 1)) * (w - pad * 2);
        const yy = pad + (1 - (y - min) / span) * (h - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${yy.toFixed(1)}`;
      })
      .join(" ");
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10">
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--accent)]" />
      </svg>
    );
  }

  return (
    <main className="mx-auto w-[min(1100px,94%)] py-12">
      <h1 className="heading text-3xl mb-4">Explore</h1>

      {/* Filters */}
      <div className="card glass-panel p-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, creator, tags, assets…"
          className="bg-transparent rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] p-3 outline-none flex-1 min-w-[220px]"
        />
        <select
          onChange={(e) => setCadence(e.target.value || undefined)}
          className="bg-transparent rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] p-3 outline-none"
        >
          <option value="">Cadence</option>
          <option>daily</option>
          <option>weekly</option>
          <option>monthly</option>
        </select>
        <button
          className="btn-secondary"
          onClick={() => {
            setQ("");
            setCadence(undefined);
          }}
        >
          Clear
        </button>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="card glass-panel p-6 mt-4 text-center">
          {loading ? "Loading…" : "No strategies match filters. Clear filters or try another search."}
        </div>
      ) : (
        <>
          {/* Grid */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((it) => {
              const cagr = it.backtest_stats?.cagr;
              const sharpe = it.backtest_stats?.sharpe;
              const maxdd = it.backtest_stats?.max_dd;
              const cadenceLabel = it.plan_summary?.cadence ?? "—";
              const assets = it.plan_summary?.assets ?? [];
              const tags = it.tags ?? [];

              return (
                <article key={it.id} className="card glass-panel p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold truncate">{it.name}</div>
                    <span className="text-subtle text-xs truncate">{shortAddr(it.creator_address)}</span>
                  </div>

                  <div className="mt-2 text-xs text-subtle flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-full border border-white/15">Cadence: {cadenceLabel}</span>
                    <span className="px-2 py-1 rounded-full border border-white/15">
                      Assets: {assets.slice(0, 4).join(", ") || "—"}
                    </span>
                  </div>

                  <div className="mt-2">
                    <Spark series={it.spark} />
                  </div>

                  <div className="mt-2 text-sm grid grid-cols-3 gap-2 text-subtle">
                    <div>CAGR {fmtPct(cagr)}</div>
                    <div>Sharpe {fmtNum(sharpe)}</div>
                    <div>MaxDD {fmtPct(maxdd)}</div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-subtle">
                    {tags.map((t) => (
                      <span key={t} className="px-2 py-1 rounded-full border border-white/15">
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <a href={`/strategy/${it.id}`} className="btn-secondary">
                      View
                    </a>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        if (!address) setModalOpen(true);
                        else setToast({ title: "Invest modal (todo)", tone: "info" });
                      }}
                    >
                      Invest
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Load more */}
          <div className="mt-6 flex justify-center">
            {nextCursorRef.current ? (
              <button className="btn-secondary" disabled={loading} onClick={() => fetchExplore(false)}>
                {loading ? "Loading…" : "Load more"}
              </button>
            ) : (
              <div className="text-subtle text-sm">End of results</div>
            )}
          </div>
        </>
      )}
    </main>
  );
}

function shortAddr(a?: string) {
  if (!a) return "—";
  const s = a.toLowerCase();
  return s.slice(0, 6) + "…" + s.slice(-4);
}

function fmtNum(n?: number) {
  if (typeof n !== "number" || !isFinite(n)) return "—";
  return n.toFixed(2);
}

function fmtPct(n?: number) {
  if (typeof n !== "number" || !isFinite(n)) return "—";
  // If your API returns decimals (0.18) instead of percent (18), adjust:
  const asPct = Math.abs(n) <= 1 ? n * 100 : n;
  return `${asPct.toFixed(1)}%`;
}
