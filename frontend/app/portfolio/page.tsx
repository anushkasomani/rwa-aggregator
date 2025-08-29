"use client";
import React, { useEffect, useState } from "react";
import { useAppState } from "@/components/state/AppStateProvider";
import { Portfolio as P } from "@/lib/builder";

export default function PortfolioPage(){
  const { state, setState } = useAppState();
  const [tab, setTab] = useState<'Invested'|'Created'>('Invested');

  useEffect(()=>{ (async ()=>{
    if (state.portfolio.invested.length || state.portfolio.created.length) return;
    const data = await P.load();
    setState(s=> ({ ...s, portfolio: data }));
  })(); }, [setState, state.portfolio]);

  return (
    <main className="mx-auto w-[min(1100px,94%)] py-12">
      <h1 className="heading text-3xl mb-4">My Portfolio</h1>
      <div className="flex gap-2 mb-3">
        {(['Invested','Created'] as const).map(t => (
          <button key={t} className={`btn-secondary ${tab===t? 'shadow-[0_0_18px_rgba(0,229,255,.25)] border-[color-mix(in_srgb,var(--accent)_60%,transparent)]' : ''}`} onClick={()=> setTab(t)}>{t}</button>
        ))}
      </div>
      {tab==='Invested' ? (
        state.portfolio.invested.length ? (
          <div className="card glass-panel p-4">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 text-sm text-subtle">
              <div>Strategy</div><div>Shares</div><div>Value</div><div>P&L %</div><div>Since</div><div>Last</div>
            </div>
            <div className="mt-2 grid gap-2">
              {state.portfolio.invested.map((r:any)=> (
                <div key={r.address} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
                  <a href={`/strategy/${r.address}`} className="neon-underline">{r.name}</a>
                  <div>{r.shares}</div>
                  <div>${r.value.toLocaleString()}</div>
                  <div>{r.pnl}%</div>
                  <div>{r.since}</div>
                  <div>{r.last}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card glass-panel p-6 text-center">No investments yet. <a className="neon-underline" href="/explore">Explore</a> or <a className="neon-underline" href="/build">Build</a>.</div>
        )
      ) : (
        state.portfolio.created.length ? (
          <div className="card glass-panel p-4">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 text-sm text-subtle">
              <div>Strategy</div><div>AUM</div><div>Holders</div><div>30D</div><div>Since</div><div>Status</div>
            </div>
            <div className="mt-2 grid gap-2">
              {state.portfolio.created.map((r:any)=> (
                <div key={r.address} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
                  <a href={`/strategy/${r.address}`} className="neon-underline">{r.name}</a>
                  <div>${r.aum.toLocaleString()}</div>
                  <div>{r.holders}</div>
                  <div>{r.m30}%</div>
                  <div>{r.since}</div>
                  <div>{r.status}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card glass-panel p-6 text-center">No created strategies yet. <a className="neon-underline" href="/build">Create one</a>.</div>
        )
      )}
    </main>
  );
}
