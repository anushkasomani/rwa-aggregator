"use client";
import React from "react";

type Item = { asset: string; price: string; volume: string; sentiment: number; included: boolean };

export default function ExplainDrawer({ open, onClose, date, items }: { open: boolean; onClose: ()=>void; date: string; items: Item[] }){
  if (!open) return null;
  return (
    <aside className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}/>
      <div className="absolute right-0 top-0 h-full w-[min(420px,92%)] card glass-panel p-5 overflow-auto">
        <div className="flex items-center gap-3">
          <h3 className="heading text-xl flex-1">Explain – {date}</h3>
          <button className="btn-secondary px-3 py-1" onClick={onClose}>Close</button>
        </div>
        <div className="mt-4 grid gap-3">
          {items.map((it)=> (
            <div key={it.asset} className="rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
              <div className="flex items-center gap-2">
                <div className="font-semibold">{it.asset}</div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${badgeTone(it.sentiment)}`}>{tone(it.sentiment)}</span>
                {!it.included && <span className="text-xs px-2 py-0.5 rounded-full bg-[#EF4444]/20 border border-[#EF4444]/40">excluded</span>}
              </div>
              <ul className="list-disc list-inside text-subtle text-sm mt-1">
                <li>Price Δ vs SMA</li>
                <li>Volume x vs avg: {it.volume}</li>
                <li>Sentiment score: {it.sentiment.toFixed(2)}</li>
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-4 text-subtle text-xs">Toggle to show excluded assets and reasons in your backtest UI.</div>
      </div>
    </aside>
  );
}

function tone(s: number){ return s>0.55?"positive": s>0.45?"neutral":"negative" }
function badgeTone(s:number){
  if (s>0.55) return "bg-[var(--accent)]/20 border border-[var(--accent)]/40";
  if (s>0.45) return "bg-white/10 border border-white/20";
  return "bg-[#EF4444]/20 border border-[#EF4444]/40";
}
