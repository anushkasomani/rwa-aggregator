"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useAppState } from "@/components/state/AppStateProvider";
import { useWallet } from "@/components/wallet/WalletProvider";

export default function ExplorePage(){
  const { state, setState, setToast } = useAppState();
  const { address, setModalOpen } = useWallet();
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState<string|undefined>();
  const [cadence, setCadence] = useState<string|undefined>();

  useEffect(()=>{
    if (state.explore.list.length) return;
    const list = [
      { address:'0xAB1', name:'EW BTC/ETH + Sentiment', aum: 230000, m30: 4.2, maxdd: -7.1, tags:['Trend','Sentiment'], creator:'0xCA…FE' },
      { address:'0xCD2', name:'Momentum Score Long-Only', aum: 1200000, m30: 8.4, maxdd: -12.3, tags:['Momentum'], creator:'0xBE…EF' },
    ];
    setState(s=> ({ ...s, explore: { ...s.explore, list } }));
  }, [setState, state.explore.list.length]);

  const filtered = useMemo(()=> state.explore.list.filter((it:any)=>{
    if (q && !(`${it.name} ${it.creator} ${it.tags?.join(' ')}`.toLowerCase().includes(q.toLowerCase()))) return false;
    if (risk) return true; // placeholder
    if (cadence) return true; // placeholder
    return true;
  }), [state.explore.list, q, risk, cadence]);

  return (
    <main className="mx-auto w-[min(1100px,94%)] py-12">
      <h1 className="heading text-3xl mb-4">Explore</h1>
      <div className="card glass-panel p-4 flex flex-wrap gap-2">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search" className="bg-transparent rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] p-3 outline-none flex-1 min-w-[220px]" />
        <select onChange={(e)=> setRisk(e.target.value || undefined)} className="bg-transparent rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] p-3 outline-none">
          <option value="">Risk</option>
          <option>Low</option><option>Med</option><option>High</option>
        </select>
        <select onChange={(e)=> setCadence(e.target.value || undefined)} className="bg-transparent rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] p-3 outline-none">
          <option value="">Cadence</option>
          <option>Daily</option><option>Weekly</option><option>Monthly</option>
        </select>
        <select className="bg-transparent rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] p-3 outline-none">
          <option>Sort</option>
          <option>AUM</option><option>30D return</option><option>New</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <div className="card glass-panel p-6 mt-4 text-center">No strategies match filters. Clear filters or try another search.</div>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((it:any)=> (
            <article key={it.address} className="card glass-panel p-5">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{it.name}</div>
                <span className="text-subtle text-xs">{it.creator}</span>
              </div>
              <div className="mt-2 text-sm grid grid-cols-3 gap-2 text-subtle">
                <div>AUM ${it.aum.toLocaleString()}</div>
                <div>30D {it.m30}%</div>
                <div>MaxDD {it.maxdd}%</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-subtle">
                {it.tags.map((t:string)=> <span key={t} className="px-2 py-1 rounded-full border border-white/15">{t}</span>)}
              </div>
              <div className="mt-3 flex gap-2">
                <a href={`/strategy/${it.address}`} className="btn-secondary">View</a>
                <button className="btn-primary" onClick={()=> { if(!address){ setModalOpen(true);} else { setToast({ title: 'Invest modal (demo)', tone: 'info' }); } }}>Invest</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
