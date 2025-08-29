"use client";
import React, { useMemo, useState } from "react";
import { useToast } from "./toast/ToastProvider";
import ExplainDrawer from "./ExplainDrawer";
import DeployModal from "./DeployModal";
import { useWallet } from "@/components/wallet/WalletProvider";

type Pt = { t: string; v: number; why: string[] };

export default function BacktestResults() {
  const [series, setSeries] = useState<Pt[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [rebalances, setRebalances] = useState<any[]>([]);
  const [explain, setExplain] = useState<{open: boolean, date: string, items: any[]}>({open:false, date:"", items:[]});
  const [deployOpen, setDeployOpen] = useState(false);
  const { push } = useToast();
  const { address, setModalOpen } = useWallet();

  async function run() {
    try {
      const plan = { meta: { prompt: "demo" } };
      const res = await fetch("/api/backtest", { method: "POST", body: JSON.stringify({ plan }) });
      const data = await res.json();
      setSeries(data.series); setStats(data.stats); setRebalances(data.rebalances);
      push({ title: "Backtest done", tone: "success" });
    } catch (e) { push({ title: "Backtest failed", tone: "error" }); }
  }

  const path = useMemo(()=> buildPath(series.map((p)=>p.v)), [series]);

  return (
    <section className="mx-auto w-[min(1200px,95%)] pt-16">
      <div className="flex items-center gap-3">
        <h2 className="heading text-2xl">Backtest Results</h2>
        <button className="btn-primary" onClick={run}>Run Backtest</button>
      </div>
      <div className="mt-4 card glass-panel p-4">
        <svg viewBox="0 0 800 240" className="w-full h-[240px]">
          <rect x="0" y="0" width="800" height="240" fill="url(#g)" opacity="0.08"/>
          <defs>
            <linearGradient id="stroke" x1="0" x2="1">
              <stop offset="0%" stopColor="var(--accent)"/>
              <stop offset="100%" stopColor="var(--accent-secondary)"/>
            </linearGradient>
            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)"/>
              <stop offset="100%" stopColor="transparent"/>
            </linearGradient>
          </defs>
          <path d={path} fill="none" stroke="url(#stroke)" strokeWidth="2" />
        </svg>
      </div>
      {stats && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(statsDisplay(stats)).map(([k,v]) => (
            <div key={k} className="card glass-panel p-4">
              <div className="text-subtle text-sm">{k}</div>
              <div className="heading text-xl">{v}</div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 card glass-panel p-4">
        <div className="text-subtle mb-3">Rebalances</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          {rebalances.map((r,i)=> (
            <div key={i} className="rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
              <div className="flex items-center justify-between">
                <div className="font-medium">{r.date}</div>
                <button className="btn-secondary px-2 py-1 text-xs" onClick={()=> setExplain({ open:true, date:r.date, items:[
                  { asset:'BTC', price:'>SMA', volume:'1.2x', sentiment:0.6, included:true },
                  { asset:'ETH', price:'>SMA', volume:'1.1x', sentiment:0.55, included:true },
                  { asset:'SOL', price:'<SMA', volume:'0.8x', sentiment:0.41, included:false },
                ] })}>Explain</button>
              </div>
              <div className="text-subtle text-xs">BTC {r.weights.BTC*100}% • ETH {r.weights.ETH*100}%</div>
              <ul className="list-disc list-inside text-subtle mt-2">
                {r.why.map((w:string)=>(<li key={w}>{w}</li>))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className="btn-secondary" onClick={()=> setDeployOpen(true)}>Deploy Vault</button>
          {address ? null : (
            <button className="neon-underline text-subtle text-sm" onClick={()=> setModalOpen(true)}>Connect Wallet to proceed</button>
          )}
        </div>
      </div>
      <ExplainDrawer open={explain.open} onClose={()=> setExplain({ ...explain, open:false })} date={explain.date} items={explain.items as any} />
      <DeployModal open={deployOpen} onClose={()=> setDeployOpen(false)} onConfirm={()=> { setDeployOpen(false); }} />
    </section>
  );
}

function buildPath(vals: number[]) {
  if (!vals.length) return "";
  const min = Math.min(...vals), max = Math.max(...vals);
  const sx = 800 / (vals.length - 1);
  const norm = (v: number) => max === min ? 120 : 220 - ((v - min) / (max - min)) * 200;
  return vals.map((v,i)=> `${i?"L":"M"}${i*sx},${norm(v)}`).join(" ");
}

function statsDisplay(s: any) {
  return {
    CAGR: `${(s.CAGR*100).toFixed(2)}%`,
    Sharpe: s.Sharpe.toFixed(2),
    "Max Drawdown": `${(s.MaxDrawdown*100).toFixed(1)}%`,
    "Total Return": `${(s.TotalReturn*100).toFixed(1)}%`,
  };
}
