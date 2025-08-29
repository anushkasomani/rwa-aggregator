"use client";
import React, { useMemo, useState } from "react";
import { useAppState } from "@/components/state/AppStateProvider";
import { Backtest, Planner, Explain, withLoading } from "@/lib/builder";
import DeployModal from "@/components/DeployModal";
import { useWallet } from "@/components/wallet/WalletProvider";

export default function BuildPage(){
  const { state, setState, setToast } = useAppState();
  const { address, setModalOpen } = useWallet();
  const [step, setStep] = useState(1);
  const [text, setText] = useState("equal-weight BTC/ETH… 20D SMA… sentiment ≥ 0.30");
  const [deployOpen, setDeployOpen] = useState(false);

  async function startPrompt(){
    try {
      const res = await withLoading('planner', setState, () => Planner.plan(text));
      setState(s => ({ ...s, plan: res.plan || res }));
      setToast({ title: 'Plan generated', tone: 'success' });
      setStep(2);
    } catch (e:any) { setToast({ title: 'Planner error', description: String(e), tone: 'error' }); }
  }
  async function runBacktest(){
    try {
      const res = await withLoading('backtest', setState, () => Backtest.run(state.plan));
      setState(s => ({ ...s, backtest: { stats: res.stats, equity_curve: res.series } }));
      setStep(3);
      setToast({ title: 'Backtest complete', tone: 'success' });
      setTimeout(()=> document.getElementById('backtest')?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e:any) { setToast({ title: 'Backtest error', description: String(e), tone: 'error' }); }
  }
  async function loadExplain(){
    if (state.explain) return setStep(3);
    try {
      const res = await withLoading('explain', setState, () => Explain.run({ metrics: [] }));
      setState(s => ({ ...s, explain: res.data }));
      setToast({ title: 'Explain loaded', tone: 'success' });
    } catch (e:any) { setToast({ title: 'Explain error', description: String(e), tone: 'error' }); }
  }

  function activate(){
    if (!address) { setModalOpen(true); return; }
    setState(s => ({ ...s, review: { name: 'Demo Strategy', address: '0xDEMO', createdAt: new Date().toISOString() } }));
    setToast({ title: 'Strategy activated (demo)', tone: 'success' });
    setDeployOpen(false);
  }

  const stats = useMemo(()=> state.backtest?.stats, [state.backtest]);

  function templateText(t: string) {
    const map: Record<string, string> = {
      'Equal-Weight Trend + Sentiment': 'equal-weight BTC/ETH, weekly rebalance, buy when close > 20D SMA; adjust weights by sentiment score (0.3–0.8). Max weight 40%, turnover ≤ 15%, bands ±5pp.',
      'Momentum Long-Only (Top-N)': 'rank universe BTC,ETH,SOL,ARB by 90D momentum; hold top 2 equal-weight; cash otherwise. Weekly rebalance, turnover ≤ 15%, max weight 40%.',
      'Volume-Gated Breakouts': 'buy breakout when close > 50D high AND volume > 1.5x 30D avg; sell on close < 20D SMA. Daily checks, weekly rebalance, bands ±5pp.',
      'Yield Rotation (DeFiLlama)': 'allocate to top 2 stablecoin yields (TVL > 20M, risk ≤ medium) from DeFiLlama; rebalance monthly; enforce 48h cooldown on venue changes.',
      'Custom Strategy': 'Describe your desired strategy, e.g., equal-weight BTC/ETH if price > 20D SMA and sentiment ≥ 0.30; include constraints like max weight, bands, turnover, and cadence.',
    };
    return map[t] ?? '';
  }

  return (
    <main className="mx-auto w-[min(1100px,94%)] py-12">
      <h1 className="heading text-3xl mb-4">Build</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <aside className="card glass-panel p-4 h-fit sticky top-20">
          {['Prompt','Plan','Backtest','Review & Activate'].map((t,i)=> (
            <div key={t} className={`flex items-center gap-2 py-2 ${step===i+1?'text-[var(--accent)]':'text-subtle'}`}>
              <span className="h-2 w-2 rounded-full bg-current"/> {i+1}. {t}
            </div>
          ))}
        </aside>
        <section className="grid gap-6">
          <div className="card glass-panel p-6">
            <h2 className="heading text-xl">Start with a Template</h2>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {[
                'Equal-Weight Trend + Sentiment',
                'Momentum Long-Only (Top-N)',
                'Volume-Gated Breakouts',
                'Yield Rotation (DeFiLlama)',
                'Custom Strategy',
              ].map((t)=> (
                <button key={t} className="btn-secondary justify-start" onClick={()=>{ setText(templateText(t)); setTimeout(()=> document.getElementById('prompt-editor')?.scrollIntoView({ behavior: 'smooth' }), 0); }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="card glass-panel p-6">
            <h2 className="heading text-xl">Prompt</h2>
            <textarea id="prompt-editor" value={text} onChange={(e)=>setText(e.target.value)} rows={5} className="mt-3 w-full bg-transparent rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] p-3 outline-none" placeholder="equal-weight BTC/ETH… 20D SMA… sentiment ≥ 0.30"/>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary" onClick={startPrompt}>Start with a Prompt</button>
            </div>
          </div>

          {state.plan && (
            <div className="card glass-panel p-6">
              <h2 className="heading text-xl">Generated Strategy</h2>
              <div className="mt-2 text-xs flex gap-2 text-subtle">
                <span className="px-2 py-0.5 rounded-full border border-white/15">Universe</span>
                <span className="px-2 py-0.5 rounded-full border border-white/15">cadence</span>
                <span className="px-2 py-0.5 rounded-full border border-white/15">max weight</span>
                <span className="px-2 py-0.5 rounded-full border border-white/15">band_pp</span>
              </div>
              <pre className="mt-3 text-sm overflow-auto rounded-xl p-3 border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">{JSON.stringify(state.plan, null, 2)}</pre>
              <div className="mt-3 flex gap-2">
                <button className="btn-primary" onClick={runBacktest}>Backtest Strategy</button>
                <button className="btn-secondary" onClick={()=> setStep(1)}>Edit Prompt</button>
              </div>
            </div>
          )}

          {state.backtest && (
            <div id="backtest" className="card glass-panel p-6">
              <h2 className="heading text-xl">Backtest</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                {state.backtest.stats && Object.entries(state.backtest.stats).slice(0,4).map(([k,v])=> (
                  <div key={k} className="rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
                    <div className="text-subtle text-xs">{k}</div>
                    <div className="heading text-lg">{typeof v==='number' ? v.toFixed(2) : String(v)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-[240px] rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] grid place-items-center text-subtle">Equity curve</div>
              <div className="mt-3 flex gap-2">
                <button className="btn-secondary" onClick={loadExplain}>Explain</button>
                <button className="btn-primary" onClick={()=> setStep(4)}>Review & Activate</button>
                <button className="btn-secondary" onClick={runBacktest}>Re-run Backtest</button>
              </div>
            </div>
          )}

          {step===4 && (
            <div className="card glass-panel p-6">
              <h2 className="heading text-xl">Review & Activate</h2>
              <div className="mt-2 text-subtle text-sm">Guardrails on • Non-custodial • ERC-7540 async • Safe + Zodiac</div>
              <div className="mt-3 grid gap-2">
                <div className="rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">Universe chips, gates, bands, caps, fees</div>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="btn-primary" onClick={()=> setDeployOpen(true)}>Activate Strategy</button>
              </div>
            </div>
          )}
        </section>
      </div>
      <DeployModal open={deployOpen} onClose={()=> setDeployOpen(false)} onConfirm={activate} />
    </main>
  );
}
