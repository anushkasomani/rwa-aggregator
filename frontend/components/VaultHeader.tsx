import React from "react";

export default function VaultHeader(){
  return (
    <section className="mx-auto w-[min(1200px,95%)] pt-16">
      <div className="card glass-panel p-5">
        <div className="flex flex-col md:flex-row gap-4 md:items-end justify-between">
          <div>
            <h2 className="heading text-2xl">PromptFi Vault Alpha</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 rounded-full bg-green-500/20 border border-green-500/30">Active</span>
              <span className="px-2 py-1 rounded-full bg-white/10 border border-white/20">Non-custodial. Safe-guarded.</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["PPS", "$1.23"],
              ["YTD", "+12.4%"],
              ["Max DD", "-7.2%"],
              ["Last rebalance", "2025-08-01"],
            ].map(([k,v]) => (
              <div key={k as string} className="rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
                <div className="text-subtle text-xs">{k}</div>
                <div className="heading text-lg">{v}</div>
              </div>
            ))}
          </div>
          <button className="btn-secondary h-fit">Share vault</button>
        </div>
      </div>
    </section>
  );
}
