import React from "react";

export default function YieldScanner(){
  const venues = [
    { name: "AAVE-v3", apy: "5.2%", tvl: "$1.2B", risk: "low", delta: "+0.8%" },
    { name: "Curve-stables", apy: "4.1%", tvl: "$720M", risk: "med", delta: "+0.2%" },
    { name: "Llama-boosted", apy: "7.8%", tvl: "$80M", risk: "high", delta: "+2.5%" },
  ];
  return (
    <section className="mx-auto w-[min(1200px,95%)] pt-8">
      <div className="card glass-panel p-4">
        <div className="heading text-lg">Yield Scanner</div>
        <div className="mt-3 grid gap-2 text-sm">
          {venues.map(v=> (
            <div key={v.name} className="flex items-center justify-between rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
              <div className="font-medium">{v.name}</div>
              <div className="text-subtle">APY {v.apy}</div>
              <div className="text-subtle">TVL {v.tvl}</div>
              <div className="text-subtle">risk {v.risk}</div>
              <div className="text-green-400">{v.delta}</div>
            </div>
          ))}
        </div>
        <button className="btn-secondary mt-3">Enable yield rotation (beta)</button>
        <div className="text-subtle text-xs mt-1">Enabling may migrate tranches after cooldown and hysteresis checks.</div>
      </div>
    </section>
  );
}
