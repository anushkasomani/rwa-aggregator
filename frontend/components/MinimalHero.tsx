import React from "react";

export default function MinimalHero(){
  return (
    <section className="mx-auto w-[min(1100px,94%)] pt-16">
      <div className="card glass-panel p-8 md:p-10">
        <h1 className="heading text-4xl md:text-5xl">Vibe-code like a quant. No code needed.</h1>
        <p className="text-subtle mt-3 max-w-2xl">Autonomous agents plan, backtest, and deploy your non-custodial vault.</p>
        <button className="btn-primary mt-4">Start with a prompt</button>
      </div>
    </section>
  );
}
