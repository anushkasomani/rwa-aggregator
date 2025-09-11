"use client";
import { ENV, endpointOrFallback } from "./env";
import { AppState } from "@/components/state/AppStateProvider";

async function jsonFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const Planner = {
  async plan(text: string) {
    const url = endpointOrFallback(
      ENV.PLANNER_URL && `${ENV.PLANNER_URL}/plan`,
      "/api/plan"
    );
    // Backend expects { text }, not { prompt }
    return jsonFetch(url, { method: "POST", body: JSON.stringify({ text }) });
  },
};

export const Backtest = {
  async run(plan: any) {
    const url = endpointOrFallback(
      ENV.BACKTEST_URL && `${ENV.BACKTEST_URL}/backtest`,
      "/api/backtest"
    );
    const res = await jsonFetch(url, {
      method: "POST",
      body: JSON.stringify({ plan, start: "2024-01-01" }),
    });
    // Normalize shape; support both {equity_curve} and legacy {series}
    const curve = res.equity_curve ?? res.series ?? [];
    return { stats: res.stats, equity_curve: curve, series: curve };
  },
};

export const Explain = {
  async run(metrics: any) {
    const url = endpointOrFallback(
      ENV.EXPLAIN_URL && `${ENV.EXPLAIN_URL}/explain`,
      "/api/explain"
    );
    return jsonFetch(url, { method: "POST", body: JSON.stringify({ metrics }) });
  },
};

export const Indexer = {
  async pps(address: string) {
    const url = endpointOrFallback(
      ENV.INDEXER_URL && `${ENV.INDEXER_URL}/pps?vault=${address}`,
      `/api/pps?vault=${address}`
    );
    return jsonFetch(url);
  },
  async requests(address: string) {
    const url = endpointOrFallback(
      ENV.INDEXER_URL && `${ENV.INDEXER_URL}/requests?vault=${address}`,
      `/api/requests?vault=${address}`
    );
    return jsonFetch(url);
  },
};

export const Portfolio = {
  async load() {
    return {
      invested: [
        {
          address: "0xAB1",
          name: "EW BTC/ETH + Sentiment",
          shares: 123.45,
          value: 1523.11,
          pnl: 12.3,
          since: "2025-01-04",
          last: "Deposit",
        },
      ],
      created: [
        {
          address: "0xDEMO",
          name: "Demo Vault",
          aum: 123000,
          holders: 42,
          m30: 4.2,
          since: "2025-07-20",
          status: "Active",
        },
      ],
    };
  },
};

export async function withLoading<T>(
  key: string,
  setState: (u: (s: AppState) => AppState) => void,
  fn: () => Promise<T>
) {
  try {
    setState((s) => ({ ...s, loading: { ...s.loading, [key]: true } }));
    const out = await fn();
    return out;
  } finally {
    setState((s) => {
      const { [key]: _, ...rest } = s.loading || {};
      return { ...s, loading: rest };
    });
  }
}
