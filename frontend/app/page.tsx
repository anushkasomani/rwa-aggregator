import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import IntegrationsRibbon from "@/components/IntegrationsRibbon";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PromptFi — Talk-to-Portfolio Vaults (ERC-7540, Safe + Zodiac)",
  description: "Turn prompts into non-custodial async vaults. Backtest, deploy, and operate with strict guardrails.",
  openGraph: {
    title: "PromptFi — Talk-to-Portfolio Vaults (ERC-7540, Safe + Zodiac)",
    description: "Turn prompts into non-custodial async vaults. Backtest, deploy, and operate with strict guardrails.",
    type: "website",
  },
  twitter: {
    title: "PromptFi — Talk-to-Portfolio Vaults (ERC-7540, Safe + Zodiac)",
    description: "Turn prompts into non-custodial async vaults. Backtest, deploy, and operate with strict guardrails.",
    card: "summary_large_image",
  },
};

export default function Home() {
  return (
    <div>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="relative">
          <div className="absolute inset-0 -z-10 opacity-80">
            <div className="h-[520px] w-full bg-[radial-gradient(800px_400px_at_20%_10%,rgba(124,58,237,.25),transparent),radial-gradient(1000px_600px_at_80%_10%,rgba(0,229,255,.18),transparent)]"/>
          </div>
          <div className="mx-auto w-[min(1100px,94%)] pt-16">
            <div className="card glass-panel p-8 md:p-10">
              <h1 className="heading text-4xl md:text-5xl">PromptFi — Talk your strategy. We’ll backtest and launch the vault.</h1>
              <p className="text-subtle mt-3 max-w-2xl">Turn a prompt into a guarded, non-custodial ERC-7540 vault. Safe + Zodiac rails.</p>
              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <Link href="/build" className="btn-primary">Build with a Prompt</Link>
                <Link href="/explore" className="btn-secondary">Explore Strategies</Link>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-subtle">
                {['Non-custodial','Safe + Zodiac','ERC-7540 async','Guardrails on'].map(b=> (
                  <span key={b} className="px-2 py-1 rounded-full border border-[color-mix(in_srgb,var(--foreground)_12%,transparent)] bg-[rgba(15,20,36,.6)]">{b}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How it works (4 cards) */}
        <section className="mx-auto w-[min(1200px,95%)] pt-16">
          <h2 className="heading text-2xl">How it works</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { t: 'Plan', d: 'AI turns text into a Strategy DSL (whitelisted indicators & caps).', i: '🧠' },
              { t: 'Backtest', d: 'OHLCV + sentiment; bands & turnover limits enforced.', i: '📈' },
              { t: 'Deploy', d: 'Async vault (ERC-7540) owned by Safe; Roles-gated execution.', i: '🚀' },
              { t: 'Operate', d: 'Agent batches I/O, rebalances, optional yield rotation.', i: '⚙️' },
            ].map((s)=> (
              <article key={s.t} className="card glass-panel p-5 hover:translate-y-[-2px] transition-transform">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 grid place-items-center rounded-xl bg-[rgba(15,20,36,.7)] border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] shadow-[var(--glow)]">{s.i}</div>
                  <div className="font-semibold">{s.t}</div>
                </div>
                <p className="text-subtle text-sm mt-2">{s.d}</p>
                <a href="#docs" className="neon-underline text-xs mt-3 inline-block">Learn more</a>
              </article>
            ))}
          </div>
          <div className="mt-4">
            <Link href="/build" className="btn-primary">Start Building</Link>
          </div>
        </section>

        {/* What you get */}
        <section className="mx-auto w-[min(1200px,95%)] pt-16">
          <h2 className="heading text-2xl">What you get</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              'Strategy Planner','Backtester','Vault Factory','Agent Runner','Indexer/API','Explainability panel'
            ].map((t)=> (
              <article key={t} className="card glass-panel p-5">
                <div className="font-semibold">{t}</div>
                <div className="text-subtle text-sm mt-1">Documentation coming soon.</div>
                <div className="mt-3 flex gap-2">
                  <a href="#docs" className="btn-secondary">Learn more</a>
                  <Link href={t.includes('Planner')||t.includes('Backtester')||t.includes('Vault')?'/build':'/explore'} className="btn-primary">{t.includes('Planner')||t.includes('Backtester')||t.includes('Vault')? 'Build' : 'Explore'}</Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Security & Guardrails */}
        <section className="mx-auto w-[min(1200px,95%)] pt-16">
          <div className="card glass-panel p-6">
            <h2 className="heading text-2xl">Security & Guardrails</h2>
            <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-subtle">
              {['±5pp drift bands','≤15% daily turnover','max weight 40% (50% hard)','slippage ≤ 0.8%','order max $2k','48h timelock','guardian pause'].map(b => (
                <li key={b} className="rounded-xl border p-3 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">{b}</li>
              ))}
            </ul>
            <div className="mt-3"><Link href="/explore" className="btn-secondary">Explore Strategies</Link></div>
          </div>
        </section>

        {/* Integrations */}
        <IntegrationsRibbon />

        {/* FAQ */}
        <section className="mx-auto w-[min(1200px,95%)] pt-16">
          <h2 className="heading text-2xl">FAQ</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ['What is ERC-7540 async?','Async requests enable batched settlement and transferable receipts.'],
              ['How are strategies guarded?','Roles + Safe with band, turnover, and slippage constraints.'],
              ['Can I fork an existing strategy?','Yes—start from Explore and use Fork to pre-fill the builder.'],
              ['How do fees work?','Creators set caps; execution follows policy with transparent receipts.'],
            ].map(([q,a])=> (
              <article key={q as string} className="card glass-panel p-5">
                <div className="font-semibold">{q}</div>
                <p className="text-subtle text-sm mt-1">{a}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Final CTA bar */}
        <section className="mx-auto w-[min(1200px,95%)] pt-12">
          <div className="card glass-panel p-5 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="heading text-xl">Ready to build or invest?</div>
            <div className="flex gap-2">
              <Link href="/build" className="btn-primary">Build with a Prompt</Link>
              <Link href="/explore" className="btn-secondary">Invest in Strategies</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
