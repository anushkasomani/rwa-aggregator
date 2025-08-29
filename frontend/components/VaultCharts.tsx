import React from "react";

export default function VaultCharts(){
  return (
    <section className="mx-auto w-[min(1200px,95%)] pt-8">
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <div className="card glass-panel p-4">
          <div className="flex items-center justify-between">
            <div className="heading text-lg">PPS / NAV</div>
            <div className="text-subtle text-xs flex gap-2">
              {['1M','3M','6M','1Y'].map(r=> <button key={r} className="btn-secondary px-2 py-1 text-xs">{r}</button>)}
            </div>
          </div>
          <div className="mt-3 h-[220px] rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] grid place-items-center text-subtle">Chart</div>
        </div>
        <div className="card glass-panel p-4">
          <div className="heading text-lg">Allocations</div>
          <div className="mt-3 grid gap-2 text-sm">
            {[
              ["BTC", "50%", "$62,300", "+1.2%", "0.6"],
              ["ETH", "50%", "$3,100", "+0.8%", "0.55"],
            ].map(([a,w,p,chg,sent]) => (
              <div key={a as string} className="flex items-center justify-between rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
                <div className="font-medium">{a}</div>
                <div className="text-subtle">{w}</div>
                <div className="text-subtle">{p}</div>
                <div className="text-green-400">{chg}</div>
                <div className="text-subtle">sent {sent}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
