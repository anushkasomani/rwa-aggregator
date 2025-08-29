"use client";
import React from "react";

type Template = { title: string; intent: string; tags: string[]; prompt: string };

const TEMPLATES: Template[] = [
  { title: "Equal-Weight Trend + Sentiment Tilt", intent: "Weekly rebalance with 20D SMA and sentiment filter", tags: ["Risk: Med","Turnover: Low","Cadence: Weekly"], prompt: "equal-weight BTC/ETH, buy when price > 20D SMA, tilt weights by sentiment score" },
  { title: "Momentum Score Long-Only", intent: "Rank assets by momentum score", tags: ["Risk: High","Turnover: Med","Cadence: Weekly"], prompt: "long top 3 assets by 90D momentum, cash otherwise" },
  { title: "Volume-Gated Breakouts", intent: "Trade breakouts only when volume confirms", tags: ["Risk: Med","Turnover: Med","Cadence: Daily"], prompt: "buy breakout when close > 50D high and volume > 1.5x avg" },
  { title: "Yield Rotation (DeFiLlama)", intent: "Rotate into top APY venues with risk guardrails", tags: ["Risk: Var","Turnover: Low","Cadence: Monthly"], prompt: "allocate to top 2 stablecoin yields with TVL > 20M and protocol risk <= medium" },
  { title: "Custom Strategy", intent: "Start from scratch with your own rules", tags: ["Risk: ?","Turnover: ?","Cadence: ?"], prompt: "Describe your desired strategy with clear rules and constraints" },
];

export default function TemplateGallery({ onUse }: { onUse: (p: string) => void }) {
  return (
    <section id="templates" className="mx-auto w-[min(1200px,95%)] pt-16">
      <h2 className="heading text-2xl">Start from a template</h2>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TEMPLATES.map((t) => (
          <article key={t.title} className="card glass-panel p-5">
            <div className="font-semibold">{t.title}</div>
            <p className="text-subtle text-sm mt-1">{t.intent}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-subtle">
              {t.tags.map(x => <span key={x} className="px-2 py-1 rounded-full border border-[color-mix(in_srgb,var(--foreground)_12%,transparent)]">{x}</span>)}
            </div>
            <button className="btn-secondary mt-4" onClick={()=>onUse(t.prompt)}>Use this template</button>
          </article>
        ))}
      </div>
    </section>
  );
}
