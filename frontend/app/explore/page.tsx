"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "@/components/state/AppStateProvider";
import { useWallet } from "@/components/wallet/WalletProvider";
import InvestModal from "@/components/InvestModal";
import { ethers } from "ethers";
import VaultArtifact from "@/abi/MultiAssetVault.json"; // same as Build

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

type StrategyDetailAPI = {
  id: string;
  name: string;
  vault_address?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";
const INVEST_URL = `${API_BASE}/v1/investments`;
const EXPLORE_URL = `${API_BASE}/v1/strategies/explore`;
const STRATEGY_SHOW_URL = (id: string) => `${API_BASE}/v1/strategies/${id}`;

// --- Demo inventory (non-investable) ---
// --- Demo inventory (non-investable placeholders) ---
const DEMO_CREATOR = "0x0000000000000000000000000000000000000001";
const nowIso = () => new Date().toISOString();
const DUMMY_STRATEGIES: StrategyCardAPI[] = [
  {
    id: "dummy:bluechip",
    name: "BlueChip",
    creator_address: DEMO_CREATOR,
    plan_summary: { assets: ["BTC", "ETH"], cadence: "weekly", crux: "Equal-weight BTC/ETH; drift bands ±5pp; weekly rebalance" },
    backtest_stats: { cagr: 0.22, sharpe: 1.6, max_dd: -0.28 },
    // gentle up with tiny dips
    spark: [100,101,99,102,104,103,106,108,107,111,115,118,122],
    is_public: true,
    tags: ["demo","long-only","blue-chip"],
    created_at: nowIso(),
  },
  {
    id: "dummy:momentum",
    name: "Momentum",
    creator_address: DEMO_CREATOR,
    plan_summary: { assets: ["BTC","ETH","SOL","ARB"], cadence: "weekly", crux: "Top-2 by 90D momentum; cash on trend break" },
    backtest_stats: { cagr: 0.39, sharpe: 1.9, max_dd: -0.33 },
    // early drawdown then higher highs
    spark: [100,95,98,105,112,120,115,128,136,145,153,165,178],
    is_public: true,
    tags: ["demo","momentum","top-N"],
    created_at: nowIso(),
  },
  {
    id: "dummy:highgrowth",
    name: "HighGrowth",
    creator_address: DEMO_CREATOR,
    plan_summary: { assets: ["SOL","ARB","OP","AVAX"], cadence: "weekly", crux: "Growth tilt; 40% max weight; volatility cap" },
    backtest_stats: { cagr: 0.52, sharpe: 1.4, max_dd: -0.44 },
    // volatile swings but strong uptrend
    spark: [100,110,95,125,118,140,130,155,170,150,180,200,220],
    is_public: true,
    tags: ["demo","growth","risk-on"],
    created_at: nowIso(),
  },
  {
    id: "dummy:trending",
    name: "TrendingTokens",
    creator_address: DEMO_CREATOR,
    plan_summary: { assets: ["BTC","ETH","SOL","DOGE","TON"], cadence: "daily", crux: "Donchian breakouts; vol filter ×1.5; daily checks" },
    backtest_stats: { cagr: 0.35, sharpe: 1.3, max_dd: -0.37 },
    // choppy moves, higher lows
    spark: [100,103,101,107,112,108,116,122,118,125,133,130,139],
    is_public: true,
    tags: ["demo","breakout","volume-gated"],
    created_at: nowIso(),
  },
  {
    id: "dummy:stableyield",
    name: "StableYield",
    creator_address: DEMO_CREATOR,
    plan_summary: { assets: ["USDC","USDT","DAI"], cadence: "monthly", crux: "Rotate to top stablecoin yields (TVL>20M)" },
    backtest_stats: { cagr: 0.08, sharpe: 2.4, max_dd: -0.02 },
    // smooth, low-vol slope up
    spark: [100,100.5,101,101.6,102.2,102.9,103.7,104.6,105.5,106.5,107.6,108.8],
    is_public: true,
    tags: ["demo","yield","stable"],
    created_at: nowIso(),
  },
  {
    id: "dummy:defirot",
    name: "DeFiRotation",
    creator_address: DEMO_CREATOR,
    plan_summary: { assets: ["UNI","AAVE","GMX","SNX"], cadence: "weekly", crux: "Score = momentum + TVL growth; hold top-2" },
    backtest_stats: { cagr: 0.27, sharpe: 1.2, max_dd: -0.41 },
    // sideways then breakout
    spark: [100,98,99,101,100,102,105,103,106,110,118,130,135],
    is_public: true,
    tags: ["demo","rotation","defi"],
    created_at: nowIso(),
  },
  {
    id: "dummy:ainarrative",
    name: "AINarrative",
    creator_address: DEMO_CREATOR,
    plan_summary: { assets: ["TAO","RNDR","FET","AGIX"], cadence: "weekly", crux: "Sentiment tilt 20%; trend + breakout overlay" },
    backtest_stats: { cagr: 0.45, sharpe: 1.5, max_dd: -0.48 },
    // surge, retrace, bigger surge
    spark: [100,112,130,120,140,160,150,170,195,185,210,240,260],
    is_public: true,
    tags: ["demo","narrative","sentiment"],
    created_at: nowIso(),
  },
];


// --- Chain addresses ---
const CONTRACT_ADDRESSES = {
  USDT: "0xAb231A5744C8E6c45481754928cCfFFFD4aa0732",
  USDC: "0xB6076C93701D6a07266c31066B298AeC6dd65c2d", // check chain
  WAVAX: "0xd00ae08403B9bbb9124bB305C09058E32C39A48c",
};

// Minimal ERC-20 ABI
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
] as const;

const VAULT_ABI = (VaultArtifact as any).abi;

export default function ExplorePage() {
  const { state, setState, setToast } = useAppState();
  const { address: appWalletAddress, setModalOpen } = useWallet();

  const [q, setQ] = useState("");
  const [cadence, setCadence] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  // invest modal state
  const [investOpen, setInvestOpen] = useState(false);
  const [investing, setInvesting] = useState(false);
  const [selected, setSelected] = useState<StrategyCardAPI | null>(null);
  const [vaultAddress, setVaultAddress] = useState<string | null>(null);

  // NEW: demo flag
const [investIsDemo, setInvestIsDemo] = useState(false);

  const nextCursorRef = useRef<string | null>(null);

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

  const serverList: StrategyCardAPI[] = (state.explore?.list as StrategyCardAPI[]) ?? [];
  const mergedList: StrategyCardAPI[] = useMemo(
    () => [...DUMMY_STRATEGIES, ...serverList],
    [serverList]
  );

  const filtered = useMemo(() => {
    return mergedList.filter((it) => {
      const hay =
        `${it.name} ${it.creator_address} ${(it.tags || []).join(" ")} ${(it.plan_summary?.assets || []).join(" ")} ${it.plan_summary?.cadence || ""}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (cadence && (it.plan_summary?.cadence || "").toLowerCase() !== cadence.toLowerCase())
        return false;
      return true;
    });
  }, [mergedList, q, cadence]);

  function Spark({ series }: { series?: number[] }) {
    if (!series || series.length < 2) {
      return (
        <div className="w-full h-10 grid place-items-center text-subtle text-xs">
          no spark
        </div>
      );
    }
    const w = 140, h = 36, pad = 4;
    const min = Math.min(...series), max = Math.max(...series);
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

  // ---------- Invest flow ----------
  const safeAddr = (label: string, v: string) => {
    if (!v || typeof v !== "string" || !v.startsWith("0x") || v.length !== 42) {
      throw new Error(`${label} must be a 42-char 0x address. Got: ${v}`);
    }
    return ethers.getAddress(v.toLowerCase());
  };

  function formatError(err: any): string {
    if (!err) return "Unknown error";
    return err.reason ?? err.shortMessage ?? err.message ?? (typeof err === "string" ? err : JSON.stringify(err));
  }

  async function getSigner(): Promise<ethers.Signer> {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      return await provider.getSigner();
    }
    throw new Error("MetaMask is not available in this browser.");
  }

  const isDummy = (it: StrategyCardAPI) => it.id.startsWith("dummy:");

  async function openInvest(it: StrategyCardAPI) {
    try {
      if (!appWalletAddress) return setModalOpen(true);
  
      setSelected(it);
      setInvestOpen(true);
      setVaultAddress(null);
  
      if (isDummy(it)) {
        // Open modal, but mark as demo so confirm won't transact
        setInvestIsDemo(true);
        return;
      }
  
      setInvestIsDemo(false);
  
      // fetch strategy detail to get vault_address
      const res = await fetch(STRATEGY_SHOW_URL(it.id));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const detail: StrategyDetailAPI = await res.json();
      const va = detail?.vault_address ?? null;
  
      if (!va) {
        setToast({ title: "Missing vault", description: "This strategy doesn't have a vault address yet.", tone: "error" });
        setInvestOpen(false);
        return;
      }
  
      const normalized = safeAddr("vault", va);
      setVaultAddress(normalized);
    } catch (e) {
      setToast({ title: "Load failed", description: formatError(e), tone: "error" });
      setInvestOpen(false);
    }
  }
  

  async function confirmInvest(amountStr: string) {
    if (!selected || !vaultAddress) return;
    // DEMO row: show toast and close modal
  if (investIsDemo) {
    setToast({
      title: "Demo strategy",
      description: "This is a showcase card — investing will be enabled soon.",
      tone: "info",
    });
    setInvestOpen(false);
    return;
  }
    try {
      setInvesting(true);
      const signer = await getSigner();

      const USDC_ADDR = safeAddr("USDC", CONTRACT_ADDRESSES.USDC);
      const VAULT_ADDR = safeAddr("vault", vaultAddress);
      const OWNER_ADDR = safeAddr("owner", await signer.getAddress());

      const usdc = new ethers.Contract(USDC_ADDR, ERC20_ABI, signer);
      const vault = new ethers.Contract(VAULT_ADDR, VAULT_ABI, signer);

      let dec = 6;
      let sym = "USDC";
      try {
        const [d, s] = await Promise.all([usdc.decimals(), usdc.symbol()]);
        if (typeof d === "number") dec = d;
        if (typeof s === "string" && s.length) sym = s;
      } catch {}

      const amtStr = amountStr.trim();
      if (!amtStr) throw new Error("Enter an amount");
      const wanted = ethers.parseUnits(amtStr, dec);

      const bal = await usdc.balanceOf(OWNER_ADDR);
      if (bal < wanted) {
        setToast({
          title: "Insufficient balance",
          description: `Wallet has ${Number(ethers.formatUnits(bal, dec)).toFixed(4)} ${sym}, needs ${amtStr} ${sym}.`,
          tone: "error",
        });
        return;
      }

      const allowance = await usdc.allowance(OWNER_ADDR, VAULT_ADDR);
      if (allowance < wanted) {
        const tx1 = await usdc.approve(VAULT_ADDR, wanted);
        await tx1.wait();
      }

      const tx2 = await vault.deposit(wanted);
      await tx2.wait();

      // Record the investment (skip for obvious dummy strategies)
try {
  if (!selected?.id?.startsWith?.("dummy")) {
    await fetch(INVEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": tx2.hash,
      },
      body: JSON.stringify({
        strategy_id: selected!.id,        // selected card id
        investor_address: String(OWNER_ADDR),
        amount: Number(amountStr),        // human units
        tx_hash: tx2.hash,
        created_at: new Date().toISOString(),
      }),
    });
  }
} catch (err) {
  console.warn("Investment POST failed (ExplorePage)", err);
  setToast({
    title: "Saved on-chain; DB update failed",
    description: "Your deposit succeeded, but recording it in DB failed. You can retry later.",
    tone: "warning",
  });
}


      try {
        const pending: bigint = await vault.pendingUSDC();
        setToast({
          title: "Deposit queued",
          description: `Pending USDC: ${Number(ethers.formatUnits(pending, 6)).toFixed(2)}`,
          tone: "success",
        });
      } catch {
        setToast({ title: "Deposit successful", tone: "success" });
      }

      setInvestOpen(false);
    } catch (e) {
      setToast({ title: "Deposit failed", description: formatError(e), tone: "error" });
    } finally {
      setInvesting(false);
    }
  }
  // ---------- /Invest flow ----------

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
              const isDemo = isDummy(it);
              const cagr = it.backtest_stats?.cagr;
              const sharpe = it.backtest_stats?.sharpe;
              const maxdd = it.backtest_stats?.max_dd;
              const cadenceLabel = it.plan_summary?.cadence ?? "—";
              const assets = it.plan_summary?.assets ?? [];
              const tags = it.tags ?? [];

              return (
                <article key={it.id} className="card glass-panel p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold truncate flex items-center gap-2">
                      {it.name}
                      {isDemo && (
                        <span className="text-[10px] uppercase px-2 py-0.5 rounded-full border border-white/20 text-subtle">
                          Demo
                        </span>
                      )}
                    </div>
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
                  <button
  className="btn-secondary"
  onClick={() => {
    if (isDummy(it)) {
      setToast({ title: "Demo strategy", description: "Details view for demos is coming soon.", tone: "info" });
    } else {
      window.location.href = `/strategy/${it.id}`;
    }
  }}
>
  View
</button>

<button
  className="btn-primary"
  onClick={() => {
    if (!appWalletAddress) setModalOpen(true);
    else openInvest(it); // works for both demo & real now
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

      {/* Invest modal (real strategies only) */}
      <InvestModal
        open={investOpen}
        onClose={() => setInvestOpen(false)}
        onConfirm={(amt) => confirmInvest(amt)}
        confirming={investing}
        minUsdc={1}
      />
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
  const asPct = Math.abs(n) <= 1 ? n * 100 : n;
  return `${asPct.toFixed(1)}%`;
}
