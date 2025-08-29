import React from "react";

const logos = [
  { name: "Ethereum" },
  { name: "Base" },
  { name: "Arbitrum" },
  { name: "Uniswap" },
  { name: "Sushi" },
  { name: "Balancer" },
  { name: "Coingecko" },
  { name: "Coinbase" },
  { name: "Binance" },
  { name: "Glassnode" },
];

export default function IntegrationsRibbon() {
  return (
    <section className="mx-auto w-[min(1200px,95%)] pt-16" aria-label="Universal access via guarded automation">
      <div className="text-subtle text-sm mb-3">Universal access via guarded automation</div>
      <div className="relative overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] bg-[rgba(12,18,32,.5)]">
        <div className="flex animate-[scroll_25s_linear_infinite] [--w:1400px]" style={{width:"var(--w)"}}>
          {[...logos, ...logos].map((l, i) => (
            <div key={i} className="px-8 py-4 text-subtle hover:text-[var(--foreground)] transition-colors">
              <div className="opacity-70 hover:opacity-100 drop-shadow-[0_0_8px_rgba(255,255,255,.08)]">{l.name}</div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </section>
  );
}
