"use client";
import React, { useState } from "react";
import { useWallet } from "@/components/wallet/WalletProvider";

export default function SignInPage(){
  const [tab, setTab] = useState<'Email'|'Wallet'>('Email');
  const { setModalOpen } = useWallet();
  return (
    <main className="mx-auto w-[min(600px,94%)] py-16">
      <div className="card glass-panel p-6">
        <h1 className="heading text-3xl">Sign in</h1>
        <div className="mt-4 flex gap-2">
          {(['Email','Wallet'] as const).map(t => (
            <button key={t} className={`btn-secondary ${tab===t? 'shadow-[0_0_18px_rgba(0,229,255,.25)] border-[color-mix(in_srgb,var(--accent)_60%,transparent)]' : ''}`} onClick={()=> setTab(t)}>{t}</button>
          ))}
        </div>
        {tab==='Email' ? (
          <div className="mt-4 grid gap-2">
            <input type="email" placeholder="you@email" className="bg-transparent rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] p-3 outline-none" />
            <button className="btn-primary">Continue with Email</button>
          </div>
        ) : (
          <div className="mt-4 grid gap-2">
            {['MetaMask','WalletConnect','Coinbase Wallet'].map(w => (
              <button key={w} className="btn-secondary justify-start" onClick={()=> setModalOpen(true)}>{w}</button>
            ))}
          </div>
        )}
        <div className="text-subtle text-xs mt-3">Non-custodial by default. Your wallet stays in your control.</div>
      </div>
    </main>
  );
}
