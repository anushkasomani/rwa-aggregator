"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useAppState } from "@/components/state/AppStateProvider";
import { useWallet } from "@/components/wallet/WalletProvider";

type CreatedRow = {
  id: string;
  name: string;
  aum?: number | null;
  holders?: number | null;
  m30?: number | null;      // 30D return in %
  since?: string | null;    // ISO
  status?: string | null;
};

type InvestedRow = {
  id: string;               // strategy id
  name: string;
  shares?: number | null;
  value?: number | null;
  pnl?: number | null;      // in %
  since?: string | null;    // ISO (investment.created_at)
  last?: string | null;     // last activity (placeholder for now)
};

type StrategyDetail = {
  id: string;
  name: string;
  created_at?: string;
  status?: string;
  // you can add more if your API returns (AUM, holders, etc.)
};

type InvestmentAPI = {
  id: string;
  strategy_id: string;
  investor_address: string;
  amount?: number | null;       // off-chain amount (optional)
  tx_hash?: string | null;
  created_at: string;           // since
  // optionally backend may embed:
  strategy?: StrategyDetail | null;
};

type InvestmentsByUserAPI = {
  items?: InvestmentAPI[];      // if you return a paginated shape
} | InvestmentAPI[];            // or a raw array

type StrategiesByUserAPI = {
  items?: any[];                // card rows or full rows
} | any[];

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

export default function PortfolioPage() {
  const { state, setState } = useAppState();
  const { address, setModalOpen } = useWallet();

  const [tab, setTab] = useState<"Invested" | "Created">("Invested");
  const [loading, setLoading] = useState(false);

  // ---------- LOAD DATA FROM BACKEND ----------
  useEffect(() => {
    (async () => {
      if (!address) return;
      // Only load if both lists are empty (keep your original memoization logic)
      const alreadyLoaded =
        (state.portfolio?.invested?.length ?? 0) > 0 ||
        (state.portfolio?.created?.length ?? 0) > 0;
      if (alreadyLoaded) return;

      setLoading(true);
      try {
        const [createdRows, investedRows] = await Promise.all([
          fetchCreated(address),
          fetchInvested(address),
        ]);

        setState((s: any) => ({
          ...s,
          portfolio: {
            created: createdRows,
            invested: investedRows,
          },
        }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // ---------- RENDER ----------
  const createdList: CreatedRow[] = useMemo(
    () => (state.portfolio?.created as CreatedRow[]) ?? [],
    [state.portfolio?.created]
  );
  const investedList: InvestedRow[] = useMemo(
    () => (state.portfolio?.invested as InvestedRow[]) ?? [],
    [state.portfolio?.invested]
  );

  return (
    <main className="mx-auto w-[min(1100px,94%)] py-12">
      <h1 className="heading text-3xl mb-4">My Portfolio</h1>

      {/* Connect wallet gate */}
      {!address ? (
        <div className="card glass-panel p-6 text-center">
          Connect your wallet to view your portfolio.&nbsp;
          <button className="btn-secondary inline-block" onClick={() => setModalOpen(true)}>
            Connect
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-3">
            {(["Invested", "Created"] as const).map((t) => (
              <button
                key={t}
                className={`btn-secondary ${
                  tab === t
                    ? "shadow-[0_0_18px_rgba(0,229,255,.25)] border-[color-mix(in_srgb,var(--accent)_60%,transparent)]"
                    : ""
                }`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Invested" ? (
            (investedList?.length ?? 0) ? (
              <div className="card glass-panel p-4">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 text-sm text-subtle">
                  <div>Strategy</div>
                  <div>Shares</div>
                  <div>Value</div>
                  <div>P&amp;L %</div>
                  <div>Since</div>
                  <div>Last</div>
                </div>
                <div className="mt-2 grid gap-2">
                  {investedList.map((r) => (
                    <div
                      key={r.id}
                      className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]"
                    >
                      <a href={`/strategy/${r.id}`} className="neon-underline">
                        {r.name}
                      </a>
                      <div>{fmtNum(r.shares)}</div>
                      <div>{fmtMoney(r.value)}</div>
                      <div>{fmtPct(r.pnl)}</div>
                      <div>{fmtDate(r.since)}</div>
                      <div>{fmtDate(r.last)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card glass-panel p-6 text-center">
                {loading ? "Loading…" : <>No investments yet. <a className="neon-underline" href="/explore">Explore</a> or <a className="neon-underline" href="/build">Build</a>.</>}
              </div>
            )
          ) : (createdList?.length ?? 0) ? (
            <div className="card glass-panel p-4">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 text-sm text-subtle">
                <div>Strategy</div>
                <div>AUM</div>
                <div>Holders</div>
                <div>30D</div>
                <div>Since</div>
                <div>Status</div>
              </div>
              <div className="mt-2 grid gap-2">
                {createdList.map((r) => (
                  <div
                    key={r.id}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]"
                  >
                    <a href={`/strategy/${r.id}`} className="neon-underline">
                      {r.name}
                    </a>
                    <div>{fmtMoney(r.aum)}</div>
                    <div>{fmtNum(r.holders)}</div>
                    <div>{fmtPct(r.m30)}</div>
                    <div>{fmtDate(r.since)}</div>
                    <div>{r.status ?? "active"}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card glass-panel p-6 text-center">
              {loading ? "Loading…" : <>No created strategies yet. <a className="neon-underline" href="/build">Create one</a>.</>}
            </div>
          )}
        </>
      )}
    </main>
  );
}

/* ===========================
   Backend fetchers + mapping
   =========================== */

const GET_STRATS_BY_USER = (addr: string) =>
  `${API_BASE}/v1/strategies/by-user/${addr}?limit=50`;

const GET_INVESTMENTS_BY_USER = (addr: string) =>
  `${API_BASE}/v1/investments/by-user/${addr}?limit=50`;

const GET_STRATEGY = (id: string) => `${API_BASE}/v1/strategies/${id}`;

async function fetchCreated(address: string): Promise<CreatedRow[]> {
  try {
    const res = await fetch(GET_STRATS_BY_USER(address));
    if (!res.ok) throw new Error(`GET by-user failed: ${res.status}`);
    const json: StrategiesByUserAPI = await res.json();
    const items = Array.isArray(json) ? json : json.items || [];

    // Items might be "card" projection or full rows; handle both
    return (items as any[]).map((it) => {
      const id = String(it.id);
      const name = String(it.name ?? "Unnamed Strategy");
      // placeholders until you add indexer
      const aum = toNum(it.aum);
      const holders = toNum(it.holders);
      const m30 = toNum(it.m30);
      const since = String(it.created_at || "");
      const status = String(it.status || "active");
      return { id, name, aum, holders, m30, since, status };
    });
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function fetchInvested(address: string): Promise<InvestedRow[]> {
  try {
    const res = await fetch(GET_INVESTMENTS_BY_USER(address));
    if (!res.ok) {
      // If you haven't implemented the endpoint yet, just return empty
      console.warn("Investments endpoint not ready:", res.status);
      return [];
    }
    const json: InvestmentsByUserAPI = await res.json();
    const items: InvestmentAPI[] = Array.isArray(json) ? json : json.items || [];

    // Ensure we have strategy names; if not embedded, fetch details
    const needLookup = items.filter((r) => !r.strategy);
    const lookups = await Promise.allSettled(
      needLookup.map((r) => fetch(GET_STRATEGY(r.strategy_id)).then((x) => x.json()))
    );
    const byId = new Map<string, StrategyDetail>();
    lookups.forEach((p, i) => {
      if (p.status === "fulfilled") {
        const detail = p.value as StrategyDetail;
        const id = needLookup[i].strategy_id;
        byId.set(id, detail);
      }
    });

    return items.map((r) => {
      const strat = r.strategy || byId.get(r.strategy_id);
      const name = String(strat?.name ?? "Strategy");
      // If you expose shares/value/pnl later, map them here
      const shares = null; // placeholder until vault live
      const value = toNum(r.amount); // using amount as value for now
      const pnl = null; // depends on NAV indexer
      const since = r.created_at || strat?.created_at || null;
      const last = null;
      return { id: r.strategy_id, name, shares, value, pnl, since, last };
    });
  } catch (e) {
    console.error(e);
    return [];
  }
}

/* ==============
   Format helpers
   ============== */
function fmtNum(n?: number | null) {
  if (n == null || !isFinite(Number(n))) return "—";
  return Number(n).toLocaleString();
}
function fmtMoney(n?: number | null) {
  if (n == null || !isFinite(Number(n))) return "—";
  return `$${Number(n).toLocaleString()}`;
}
function fmtPct(n?: number | null) {
  if (n == null || !isFinite(Number(n))) return "—";
  // If you store decimals (0.12), convert to %
  const v = Math.abs(Number(n)) <= 1 ? Number(n) * 100 : Number(n);
  return `${v.toFixed(2)}%`;
}
function fmtDate(s?: string | null) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return "—";
  }
}
function toNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
