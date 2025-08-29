"use client";
import React, { useState } from "react";
import { useToast } from "./toast/ToastProvider";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onStart: () => void;
  onTemplates: () => void;
};

export default function Hero({ value, onChange, onStart, onTemplates }: Props) {
  const { push } = useToast();
  const [focused, setFocused] = useState(false);
  return (
    <section className="relative" aria-label="Talk your strategy hero">
      <div className="absolute inset-0 -z-10 opacity-80">
        <div className="h-[520px] w-full bg-[radial-gradient(800px_400px_at_20%_10%,rgba(124,58,237,.25),transparent),radial-gradient(1000px_600px_at_80%_10%,rgba(0,229,255,.18),transparent)]"/>
      </div>
      <div className="mx-auto w-[min(1100px,94%)] pt-16">
        <div className="card glass-panel p-8 md:p-10">
          <h1 className="heading text-4xl md:text-5xl">Talk your strategy. We’ll backtest and launch the vault.</h1>
          <p className="text-subtle mt-3 max-w-2xl">PromptFi compiles your prompt into a guarded, non-custodial ERC-7540 vault with Safe + Zodiac rails.</p>
          <div className={`mt-6 rounded-2xl border ${focused?"shadow-[0_0_32px_rgba(0,229,255,.22)]":""} border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[rgba(18,26,44,.7)] backdrop-blur-xl`}>
            <textarea
              value={value}
              onChange={(e)=>onChange(e.target.value)}
              onFocus={()=>setFocused(true)}
              onBlur={()=>setFocused(false)}
              rows={3}
              placeholder="equal-weight BTC/ETH, buy only if price > 20D MA, volume strong, sentiment positive"
              className="w-full bg-transparent p-5 outline-none placeholder:text-subtle/70 text-[15px]"
            />
            <div className="flex flex-col sm:flex-row gap-3 p-4 pt-0">
              <button className="btn-primary" onClick={()=>{push({title:"Starting with prompt", tone:"info"}); onStart();}}>Start with a Prompt</button>
              <button className="btn-secondary" onClick={onTemplates}>See Templates</button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-subtle">
            {['Non-custodial','Safe + Zodiac','ERC-7540 async'].map(b=> (
              <span key={b} className="px-2 py-1 rounded-full border border-[color-mix(in_srgb,var(--foreground)_12%,transparent)] bg-[rgba(15,20,36,.6)]">{b}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
