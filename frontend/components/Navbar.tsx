"use client";
import Link from "next/link";
import React, { useState } from "react";
import { useWallet } from "@/components/wallet/WalletProvider";
import SignInModal from "@/components/auth/SignInModal";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [signin, setSignin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { address, short, disconnect, setModalOpen } = useWallet();
  return (
    <header className="sticky top-0 z-40">
      <div className="glass-panel mx-auto mt-3 w-[min(1200px,95%)] rounded-2xl px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2" aria-label="PromptFi logo">
            <div className="h-6 w-6 rounded-md bg-[var(--accent)] shadow-[var(--glow)]"/>
            <span className="heading text-[15px]">PromptFi</span>
          </Link>
          <nav className="hidden md:flex mx-auto gap-6 text-sm text-subtle">
            {[
              { href: "#how", label: "How it works" },
              { href: "#templates", label: "Templates" },
              { href: "#docs", label: "Docs" },
              { href: "/community", label: "Community" },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="neon-underline hover:text-[var(--foreground)]">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto hidden md:flex items-center gap-3">
            <Link href="#app" className="btn-primary text-sm">Launch App</Link>
            <Link href="/community" className="text-xs px-2 py-1 rounded-full bg-[rgba(124,58,237,.15)] border border-[rgba(124,58,237,.35)]">New</Link>
            {!address ? (
              <button className="btn-secondary text-sm" onClick={()=> setModalOpen(true)}>Connect Wallet</button>
            ) : (
              <div className="relative">
                <button className="btn-secondary text-sm" onClick={()=> setMenuOpen(v=>!v)}>{short()}</button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 card glass-panel p-2 min-w-[180px]">
                    <button className="neon-underline py-1 text-left w-full" onClick={()=> navigator.clipboard.writeText(address!)}>Copy address</button>
                    <button className="neon-underline py-1 text-left w-full" onClick={()=> setModalOpen(true)}>Switch wallet</button>
                    <button className="neon-underline py-1 text-left w-full" onClick={()=>{ disconnect(); setMenuOpen(false); }}>Disconnect</button>
                  </div>
                )}
              </div>
            )}
            <button className="btn-secondary text-sm" onClick={()=> setSignin(true)}>Sign in</button>
          </div>
          <button aria-label="Menu" onClick={() => setOpen(v=>!v)} className="md:hidden ml-auto btn-secondary px-3 py-2">
            ☰
          </button>
        </div>
        {open && (
          <div className="mt-3 grid gap-2 md:hidden">
            <Link href="#how" onClick={()=>setOpen(false)} className="neon-underline py-2">How it works</Link>
            <Link href="#templates" onClick={()=>setOpen(false)} className="neon-underline py-2">Templates</Link>
            <Link href="#docs" onClick={()=>setOpen(false)} className="neon-underline py-2">Docs</Link>
            <Link href="/community" onClick={()=>setOpen(false)} className="neon-underline py-2">Community</Link>
            <div className="flex gap-2 pt-2">
              <Link href="#app" className="btn-primary flex-1 text-center">Launch App</Link>
              {!address ? (
                <button className="btn-secondary flex-1" onClick={()=> { setModalOpen(true); setOpen(false); }}>Connect Wallet</button>
              ) : (
                <button className="btn-secondary flex-1" onClick={()=> { setMenuOpen(true); setOpen(false); }}>{short()}</button>
              )}
              <button className="btn-secondary flex-1" onClick={()=> { setSignin(true); setOpen(false); }}>Sign in</button>
            </div>
          </div>
        )}
      </div>
      <SignInModal open={signin} onClose={()=> setSignin(false)} />
    </header>
  );
}
