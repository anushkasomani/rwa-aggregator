"use client";
import React, { useMemo, useState } from "react";
import { useAppState } from "@/components/state/AppStateProvider";
import { Backtest, Planner, Explain, withLoading } from "@/lib/builder";
import StrategyCard from "@/components/strategy/StrategyCard";
import DeployModal from "@/components/DeployModal";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useRouter } from "next/navigation";
import { ethers } from "ethers";
import Artifact from "../../abi/Basketfactory.json";
import { MetaMaskInpageProvider } from "@metamask/providers";

declare global {
  interface Window {
    ethereum?: MetaMaskInpageProvider;
  }
}


const BasketFactoryABI=Artifact.abi

const CONTRACT_ADDRESSES = {
  BasketFactory: "0x2f7640f44271944d8AcF982F5564Eb67fe93D7C6",
  USDT: "0xAb231A5744C8E6c45481754928cCfFFFD4aa0732",
  USDC: "0xB6076C93701D6a07266c31066B298AeC6dd65c2d", // Base token
  WAVAX: "0xd00ae08403B9bbb9124bB305C09058E32C39A48c", // Main asset
};

type CurvePoint = { t?: string; time?: string; equity: number };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";
const CREATE_URL = `${API_BASE}/v1/strategies`;
const tickerToAddress: Record<string, string> = {
  BTC: CONTRACT_ADDRESSES.WAVAX,
  ETH: CONTRACT_ADDRESSES.USDT,
  USDC: CONTRACT_ADDRESSES.USDC,
  };

export default function BuildPage() {
  const router = useRouter();
  const { state, setState, setToast } = useAppState();
  const { address, setModalOpen } = useWallet();
  const [step, setStep] = useState(1);
  const [text, setText] = useState("equal-weight BTC/ETH… 20D SMA… sentiment ≥ 0.30");
  const [deployOpen, setDeployOpen] = useState(false);
  const [activating, setActivating] = useState(false);

  async function startPrompt() {
    try {
      const res = await withLoading("planner", setState, () => Planner.plan(text));
      setState((s) => ({ ...s, plan: res.plan || res }));
      setToast({ title: "Plan generated", tone: "success" });
      setStep(2);
      setTimeout(() => document.getElementById("plan")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e: any) {
      setToast({ title: "Planner error", description: String(e), tone: "error" });
    }
  }

  async function runBacktest() {
    if (!state.plan) {
      setToast({ title: "No plan", description: "Generate a plan first.", tone: "warning" });
      return;
    }
    try {
      const res = await withLoading("backtest", setState, () => Backtest.run(state.plan));
      setState((s) => ({ ...s, backtest: { stats: res.stats, equity_curve: res.equity_curve } }));
      setStep(3);
      setToast({ title: "Backtest complete", tone: "success" });
      setTimeout(() => document.getElementById("backtest")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e: any) {
      setToast({ title: "Backtest error", description: String(e), tone: "error" });
    }
  }

  async function loadExplain() {
    if (state.explain) return setStep(3);
    try {
      const res = await withLoading("explain", setState, () => Explain.run({ metrics: [] }));
      setState((s) => ({ ...s, explain: res.data }));
      setToast({ title: "Explain loaded", tone: "success" });
    } catch (e: any) {
      setToast({ title: "Explain error", description: String(e), tone: "error" });
    }
  }

  // ---- Build API payload for POST /v1/strategies ----
  function buildCreatePayload(assets: string[], weights: number[], vault: string) {
    const plan = state.plan ?? {};
    const name = String(plan?.name || plan?.plan?.name || "Untitled Strategy").slice(0, 120);
    const curve = Array.isArray(state.backtest?.equity_curve)
    ? (state.backtest?.equity_curve as CurvePoint[]).map((p) => ({
    t: (p.t || p.time || "").toString(),
    eq: Number(p.equity),
    }))
    : undefined;
    const stats = state.backtest?.stats
    ? {
    cagr: numOrNull((state.backtest.stats as any).cagr),
    sharpe: numOrNull((state.backtest.stats as any).sharpe),
    stdev: numOrNull((state.backtest.stats as any).stdev),
    max_dd: numOrNull((state.backtest.stats as any).max_dd),
    win_rate: numOrNull((state.backtest.stats as any).win_rate),
    period: (state.backtest.stats as any).period ?? undefined,
    }
    : undefined;
    return {
    name,
    creator_address: String(address),
    plan_json: plan,
    backtest_stats: stats,
    equity_curve: curve,
    is_public: true,
    status: "active" as const,
    tags: guessTags(plan),
    assets,
    weights,
    vault_address: vault,
    };
    }
    
    
    function numOrNull(x: any): number | null {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
    }
    
    
    function guessTags(plan: any): string[] {
    const tags: string[] = [];
    const textPile = JSON.stringify(plan || {}).toLowerCase() + " " + text.toLowerCase();
    if (/\bmomentum|\bbreakout|\btrend|\bema|\bsma|\badx/.test(textPile)) tags.push("momentum");
    if (/\bsentiment|\bnews|\btwitter|\breddit/.test(textPile)) tags.push("sentiment");
    if (/\byield|\bstable|\bstablecoin|\bdefillama|\btvl/.test(textPile)) tags.push("yield");
    if (/\brisk|\bmax_weight|\bturnover|\bband/.test(textPile)) tags.push("risk");
    return Array.from(new Set(tags)).slice(0, 5);
    }
    // ✅ Here's your updated `BuildPage.tsx` snippet with proper signer handling (based on your MintPage):
// 🔁 Only the updated activate() function + getSigner() change — rest of your logic is fine.

// Replace your existing `getSigner()` and `activate()` with the following:

async function getSigner(): Promise<ethers.Signer> {
  if (typeof window !== "undefined" && window.ethereum) {
    const provider = new ethers.BrowserProvider(window.ethereum);
    return await provider.getSigner();
  } else {
    throw new Error("MetaMask is not available in this browser.");
  }
}

async function activate() {
  if (!address) return setModalOpen(true);
  if (!state.plan) {
    setToast({ title: "No plan", description: "Generate a plan first.", tone: "warning" });
    return;
  }

  try {
    setActivating(true);
    const signer = await getSigner();

    const plan = state.plan;
    const name = plan?.name || "Untitled";
    const symbol = "STRAT";
    const universe = plan?.universe_list || plan?.universe || [];
    const assets = universe.map((t) => tickerToAddress[t]);
    const weights = assets.map(() => 0); // ← dummy zero weights for now

    const basketFactory = new ethers.Contract(
      CONTRACT_ADDRESSES.BasketFactory,
      BasketFactoryABI,
      signer
    );

    const tx = await basketFactory.createBasket(
      assets,
      weights,
      CONTRACT_ADDRESSES.USDC, // base token
      name,
      symbol,
      { gasLimit: 3_000_000 }
    );

    const receipt = await tx.wait();
    const basketAddress = receipt.logs[0]?.address || "0x0000000000000000000000000000000000000000";

    const body = buildCreatePayload(assets, weights, basketAddress);

    const res = await fetch(CREATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const msg = await safeText(res);
      throw new Error(`POST /strategies failed (${res.status}): ${msg}`);
    }

    const json = (await res.json()) as { id: string };
    setState((s) => ({
      ...s,
      review: { name: body.name, address, createdAt: new Date().toISOString(), id: json.id },
    }));
    setToast({ title: "Strategy published", description: `#${json.id}`, tone: "success" });
    setDeployOpen(false);
    setStep(4);
  } catch (e: any) {
    setToast({ title: "Activate failed", description: String(e?.message || e), tone: "error" });
  } finally {
    setActivating(false);
  }
}

  async function safeText(r: Response) {
    try {
      return await r.text();
    } catch {
      return "";
    }
  }

  const stats = useMemo(() => state.backtest?.stats, [state.backtest]);

  function templateText(t: string) {
    const map: Record<string, string> = {
      "Equal-Weight Trend + Sentiment":
        "equal-weight BTC/ETH, weekly rebalance, buy when close > 20D SMA; adjust weights by sentiment score (0.3–0.8). Max weight 40%, turnover ≤ 15%, bands ±5pp.",
      "Momentum Long-Only (Top-N)":
        "rank universe BTC,ETH,SOL,ARB by 90D momentum; hold top 2 equal-weight; cash otherwise. Weekly rebalance, turnover ≤ 15%, max weight 40%.",
      "Volume-Gated Breakouts":
        "buy breakout when close > 50D high AND volume > 1.5x 30D avg; sell on close < 20D SMA. Daily checks, weekly rebalance, bands ±5pp.",
      "Yield Rotation (DeFiLlama)":
        "allocate to top 2 stablecoin yields (TVL > 20M, risk ≤ medium) from DeFiLlama; rebalance monthly; enforce 48h cooldown on venue changes.",
      "Custom Strategy":
        "Describe your desired strategy, e.g., equal-weight BTC/ETH if price > 20D SMA and sentiment ≥ 0.30; include constraints like max weight, bands, turnover, and cadence.",
    };
    return map[t] ?? "";
  }

  const universe: string[] =
    (state.plan?.universe_list as string[]) ??
    (state.plan?.universe as string[]) ??
    [];

  const cadence = state.plan?.rebalance?.cadence ?? "—";
  const maxWeight = state.plan?.risk?.max_weight ?? "—";
  const bandPP = state.plan?.rebalance?.band_pp ?? "—";

  return (
    <main className="mx-auto w-[min(1100px,94%)] py-12">
      <h1 className="heading text-3xl mb-4">Build</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <aside className="card glass-panel p-4 h-fit sticky top-20">
          {["Prompt", "Plan", "Backtest", "Review & Activate"].map((t, i) => (
            <div
              key={t}
              className={`flex items-center gap-2 py-2 ${
                step === i + 1 ? "text-[var(--accent)]" : "text-subtle"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-current" /> {i + 1}. {t}
            </div>
          ))}
        </aside>

        <section className="grid gap-6">
          {/* Templates */}
          <div className="card glass-panel p-6">
            <h2 className="heading text-xl">Start with a Template</h2>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {[
                "Equal-Weight Trend + Sentiment",
                "Momentum Long-Only (Top-N)",
                "Volume-Gated Breakouts",
                "Yield Rotation (DeFiLlama)",
                "Custom Strategy",
              ].map((t) => (
                <button
                  key={t}
                  className="btn-secondary justify-start"
                  onClick={() => {
                    setText(templateText(t));
                    setTimeout(
                      () =>
                        document
                          .getElementById("prompt-editor")
                          ?.scrollIntoView({ behavior: "smooth" }),
                      0
                    );
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt input */}
          <div className="card glass-panel p-6">
            <h2 className="heading text-xl">Prompt</h2>
            <textarea
              id="prompt-editor"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="mt-3 w-full bg-transparent rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] p-3 outline-none"
              placeholder="equal-weight BTC/ETH… 20D SMA… sentiment ≥ 0.30"
            />
            <div className="mt-3 flex gap-2">
              <button className="btn-primary" onClick={startPrompt}>
                Start with a Prompt
              </button>
            </div>
          </div>

          {/* Plan preview */}
          {state.plan && (
            <div id="plan" className="card glass-panel p-0 overflow-hidden">
              {/* Strategy Header */}
              <div className="w-full border-b border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wide text-subtle">Generated Strategy</div>
                    <h3 className="heading text-2xl mt-1 truncate">{state.plan?.name || state.plan?.plan?.name || "Unnamed Strategy"}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
                    <span className="px-2 py-1 rounded-full border border-[color-mix(in_srgb,var(--foreground)_12%,transparent)]">Regime: {state.plan?.regime ?? "—"}</span>
                    <span className="px-2 py-1 rounded-full border border-[color-mix(in_srgb,var(--foreground)_12%,transparent)]">Direction: {state.plan?.direction_bias ?? "—"}</span>
                    <span className="px-2 py-1 rounded-full border border-[color-mix(in_srgb,var(--foreground)_12%,transparent)]">Universe: {(state.plan?.universe_list?.length ?? universe.length) || 0} assets</span>
                  </div>
                </div>
              </div>

              <div className="p-6 grid gap-6">
                {/* Minimal Strategy Card */}
                <StrategyCard
                  name={String(state.plan?.name || state.plan?.plan?.name || "Unnamed Strategy")}
                  assets={(universe || []).slice(0, 12)}
                  crux={text}
                  rebalance={String(state.plan?.rebalance?.cadence || "—")}
                />

                {/* Custom Rules */}
                <section>
                  <div className="heading text-lg mb-2">Custom Rules</div>
                  <div className="rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] divide-y divide-[color-mix(in_srgb,var(--foreground)_8%,transparent)] overflow-hidden">
                    {Array.isArray(state.plan?.custom_rules) && state.plan.custom_rules.length > 0 ? (
                      state.plan.custom_rules.map((rule: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 p-3 font-mono text-sm">
                          <svg width="14" height="14" viewBox="0 0 24 24" className="opacity-70"><path d="M7 7h10M7 12h10M7 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                          <span className="truncate">{String(rule)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-subtle text-sm">No custom rules provided.</div>
                    )}
                  </div>
                </section>

                {/* Explainer */}
                <section>
                  <div className="text-subtle text-xs mb-1">What this strategy does</div>
                  <p className="text-sm leading-relaxed text-[color-mix(in_srgb,var(--foreground)_92%,transparent)]">
                    This strategy trades <strong>{universe.length ? universe.join(", ") : "—"}</strong>. It prefers <strong>{state.plan?.weighting?.mode ?? "—"}</strong> weighting{typeof state.plan?.weighting?.tilt_sentiment_pct === 'number' ? (<> with sentiment tilt <strong>{state.plan.weighting.tilt_sentiment_pct}</strong>%</>) : null}. Entries favor trend (<strong>EMA{state.plan?.gates?.trend?.ema_short ?? "—"}/{state.plan?.gates?.trend?.ema_long ?? "—"} + ADX≥{state.plan?.gates?.trend?.adx_min ?? "—"}</strong>), avoid ranges (<strong>ADX≤{state.plan?.gates?.range?.adx_max ?? "—"}</strong>), and react to breakouts (<strong>Donchian {state.plan?.gates?.breakout?.donchian_n ?? "—"}, Vol×{state.plan?.gates?.breakout?.min_vol_mult ?? "—"}</strong>). It rebalances <strong>{state.plan?.rebalance?.cadence ?? "—"}</strong> with drift band <strong>{state.plan?.rebalance?.band_pp ?? "—"}pp</strong> and caps single-asset risk at <strong>{typeof state.plan?.risk?.max_weight === 'number' ? `${(state.plan.risk.max_weight * 100).toFixed(0)}%` : "—"}</strong>.
                  </p>
                </section>

                {/* CTA row */}
                <div className="sticky bottom-0 z-10 pt-2">
                  <div className="card glass-panel p-3 rounded-2xl flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full sm:w-auto">
                      <button className="btn-primary w-full" onClick={runBacktest}>Backtest Strategy</button>
                      <button className="btn-secondary w-full" onClick={() => setStep(1)}>Edit Prompt</button>
                      <button
                        className="btn-secondary w-full"
                        onClick={() => setDeployOpen(true)}
                        disabled={activating}
                      >
                        Activate
                      </button>
                    </div>
                  </div>
                </div>

                {/* JSON toggle */}
                <JsonToggle plan={state.plan} />
              </div>
            </div>
          )}

          {/* Backtest results */}
          {state.backtest && (
            <div id="backtest" className="card glass-panel p-6">
              <h2 className="heading text-xl">Backtest</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                {stats &&
                  Object.entries(stats)
                    .slice(0, 4)
                    .map(([k, v]) => (
                      <div
                        key={k}
                        className="rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]"
                      >
                        <div className="text-subtle text-xs">{k}</div>
                        <div className="heading text-lg">
                          {typeof v === "number" ? v.toFixed(3) : String(v)}
                        </div>
                      </div>
                    ))}
              </div>

              <div className="mt-4 h-[260px] rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] p-3">
                <EquityChart data={state.backtest.equity_curve as CurvePoint[]} />
              </div>

              <div className="mt-3 flex gap-2">
                <button className="btn-secondary" onClick={loadExplain}>
                  Explain
                </button>
                <button className="btn-primary" onClick={() => setStep(4)}>
                  Review & Activate
                </button>
                <button className="btn-secondary" onClick={runBacktest}>
                  Re-run Backtest
                </button>
              </div>
            </div>
          )}

          {/* Review & Activate */}
          {step === 4 && (
            <div className="card glass-panel p-6">
              <h2 className="heading text-xl">Review & Activate</h2>
              <div className="mt-2 text-subtle text-sm">
                Guardrails on • Non-custodial • ERC-7540 async • Safe + Zodiac
              </div>
              <div className="mt-3 grid gap-2">
                <div className="rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
                  Universe, gates, bands, caps, fees
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  className="btn-primary"
                  onClick={() => setDeployOpen(true)}
                  disabled={activating}
                >
                  {activating ? "Publishing…" : "Activate Strategy"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <DeployModal open={deployOpen} onClose={() => setDeployOpen(false)} onConfirm={activate} />
    </main>
  );
}

/** Minimal dependency-free SVG line chart for equity curve */
function EquityChart({ data }: { data: CurvePoint[] }) {
  const points = (data || []).map((d) => Number(d.equity)).filter((n) => Number.isFinite(n));
  if (points.length < 2) {
    return (
      <div className="w-full h-full grid place-items-center text-subtle">
        Equity curve will appear here
      </div>
    );
  }

  const width = 800;
  const height = 220;
  const pad = 10;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;

  const path = points
    .map((y, i) => {
      const xPos = pad + (i / (points.length - 1)) * (width - pad * 2);
      const yPos = pad + (1 - (y - min) / span) * (height - pad * 2);
      return `${i === 0 ? "M" : "L"}${xPos.toFixed(1)},${yPos.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <rect x="0" y="0" width={width} height={height} rx="12" className="fill-transparent" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--accent)]" />
    </svg>
  );
}

function Accordion({ plan }: { plan: any }) {
  const [open, setOpen] = React.useState(false);
  return (
    <section className="rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="heading text-lg">Execution & Sentiment</div>
        <svg width="18" height="18" viewBox="0 0 24 24" className={`transition-transform ${open ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-200 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="border-t border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-subtle text-xs mb-2">Execution</div>
              <div className="rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] p-3 grid gap-1">
                <div>Per order: ${plan?.execution?.chunk_usd ?? '—'}</div>
                <div>Use yield: {String(plan?.execution?.use_yield ?? '—')}</div>
              </div>
            </div>
            <div>
              <div className="text-subtle text-xs mb-2">Sentiment Config</div>
              <div className="rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] p-3 flex flex-wrap gap-2 text-sm">
                <span className="px-2 py-1 rounded-full border border-[color-mix(in_srgb,var(--foreground)_12%,transparent)]">Good ≥ {plan?.sentiment_cfg?.good_threshold ?? '—'}</span>
                <span className="px-2 py-1 rounded-full border border-[color-mix(in_srgb,var(--foreground)_12%,transparent)]">Bad ≤ {plan?.sentiment_cfg?.bad_threshold ?? '—'}</span>
                <span className="px-2 py-1 rounded-full border border-[color-mix(in_srgb,var(--foreground)_12%,transparent)]">24h Shock: {plan?.sentiment_cfg?.shock_delta_24h ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function JsonToggle({ plan }: { plan: any }) {
  const [open, setOpen] = React.useState(false);
  return (
    <section className="rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
      <button className="w-full flex items-center justify-between p-3 text-left" onClick={() => setOpen(v=>!v)} aria-expanded={open}>
        <div className="text-sm">View JSON</div>
        <svg width="18" height="18" viewBox="0 0 24 24" className={`transition-transform ${open ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
      </button>
      {open && (
        <pre className="text-sm overflow-auto rounded-b-xl border-t border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] p-3">{JSON.stringify(plan, null, 2)}</pre>
      )}
    </section>
  );
}
