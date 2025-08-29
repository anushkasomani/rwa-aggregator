import React from "react";

const steps = [
  { t: "Plan", d: "LLM → Strategy DSL", i: "🧠" },
  { t: "Backtest", d: "OHLCV + sentiment", i: "📈" },
  { t: "Optimize", d: "bands, turnover, caps", i: "🛠️" },
  { t: "Deploy", d: "ERC-7540, Safe roles", i: "🚀" },
  { t: "Manage", d: "rebalance, batch settle", i: "⚙️" },
  { t: "Monitor", d: "PPS, alerts", i: "🔔" },
];

export default function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-[min(1200px,95%)] pt-16">
      <h2 className="heading text-2xl">How it works</h2>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-4">
        {steps.map((s, idx) => (
          <article key={s.t} className="card glass-panel p-4 hover:translate-y-[-2px] transition-transform">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 grid place-items-center rounded-xl bg-[rgba(15,20,36,.7)] border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] shadow-[var(--glow)]">{s.i}</div>
              <div className="font-semibold">{idx+1}. {s.t}</div>
            </div>
            <p className="text-subtle text-sm mt-2">{s.d}</p>
            <a href="#docs" className="text-[var(--accent)] text-xs mt-3 inline-block neon-underline">Learn more</a>
          </article>
        ))}
      </div>
    </section>
  );
}
