"use client";
import React, { useState } from "react";
import { useToast } from "./toast/ToastProvider";

export default function StrategyBuilder() {
  const [text, setText] = useState("equal-weight BTC/ETH, buy when price > 20D SMA, tilt by sentiment");
  const [plan, setPlan] = useState<any>(null);
  const { push } = useToast();

  async function preview() {
    try {
      const res = await fetch("/api/plan", { method: "POST", body: JSON.stringify({ prompt: text }) });
      const data = await res.json();
      setPlan(data.plan);
      push({ title: "Plan parsed", tone: "success" });
    } catch (e) {
      push({ title: "Plan failed", tone: "error", description: String(e) });
    }
  }

  return (
    <section className="mx-auto w-[min(1200px,95%)] pt-16">
      <h2 className="heading text-2xl">Strategy Builder</h2>
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card glass-panel p-4">
          <div className="text-subtle text-sm mb-2">Prompt</div>
          <textarea value={text} onChange={(e)=>setText(e.target.value)} rows={8} className="w-full bg-transparent rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] p-3 outline-none" />
          <div className="mt-3 flex gap-2">
            <button className="btn-primary" onClick={preview}>Preview Plan</button>
            <button className="btn-secondary" onClick={()=>push({title:"Backtest started", tone:"info"})}>Run Backtest</button>
          </div>
        </div>
        <div className="card glass-panel p-4">
          <div className="text-subtle text-sm mb-2">Plan Preview</div>
          <pre className={`text-sm overflow-auto rounded-xl p-3 border ${plan?"border-[color-mix(in_srgb,var(--accent)_60%,transparent)] shadow-[0_0_24px_rgba(0,229,255,.2)]":"border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]"}`}>{JSON.stringify(plan ?? { note: "Preview your plan to see JSON here." }, null, 2)}</pre>
        </div>
      </div>
    </section>
  );
}
