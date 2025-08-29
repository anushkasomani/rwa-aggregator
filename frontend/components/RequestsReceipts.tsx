"use client";
import React, { useState } from "react";

export default function RequestsReceipts(){
  const [tab, setTab] = useState<'Deposits'|'Redemptions'|'Receipts'>('Deposits');
  return (
    <section className="mx-auto w-[min(1200px,95%)] pt-8">
      <div className="card glass-panel p-4">
        <div className="flex gap-2">
          {(['Deposits','Redemptions','Receipts'] as const).map(t => (
            <button key={t} className={`btn-secondary ${tab===t? 'shadow-[0_0_18px_rgba(124,58,237,.25)] border-[color-mix(in_srgb,var(--accent-secondary)_60%,transparent)]' : ''}`} onClick={()=>setTab(t)}>{t}</button>
          ))}
        </div>
        <p className="text-subtle text-xs mt-3">Requests settle in batches for better execution; you can trade receipts instantly on supported venues.</p>
        <div className="mt-3 grid gap-2 text-sm">
          {[1,2,3].map(i => (
            <div key={i} className="flex items-center justify-between rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
              <div>#{i} • {tab} • 120.00 USDC</div>
              <span className="px-2 py-1 rounded-full bg-white/10 border border-white/20 text-xs">pending</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
