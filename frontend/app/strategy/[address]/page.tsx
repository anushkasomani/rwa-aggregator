"use client";
import React, { useEffect } from "react";
import { useAppState } from "@/components/state/AppStateProvider";
import { Indexer } from "@/lib/builder";

export default function StrategyDetail({ params }: { params: { address: string } }){
  const { state, setState } = useAppState();
  const address = params.address;

  useEffect(()=>{ (async ()=>{
    const [pps, req] = await Promise.all([Indexer.pps(address), Indexer.requests(address)]);
    setState(s=> ({ ...s, detail: { ...(s.detail||{}), address, pps: pps.series, requests: req.rows } }));
  })(); }, [address, setState]);

  return (
    <main className="mx-auto w-[min(1100px,94%)] py-12">
      <div className="card glass-panel p-6">
        <div className="flex items-center justify-between">
          <h1 className="heading text-2xl">{address}</h1>
          <div className="text-subtle text-sm">Status Active • Guardrails on</div>
        </div>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          <div className="rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] h-[260px] grid place-items-center text-subtle">NAV/PPS chart</div>
          <div className="card glass-panel p-4">
            <div className="heading text-lg">Allocations</div>
            <div className="mt-2 text-subtle text-sm">Table (stub)</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="heading text-lg">Requests</div>
          <div className="grid gap-2 mt-2">
            {(state.detail?.requests||[]).map((r:any)=>(
              <div key={r.id} className="rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] flex items-center justify-between">
                <div>#{r.id} • {r.type} • {r.amount} • {r.status}</div>
                <button className="btn-secondary">Details</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
