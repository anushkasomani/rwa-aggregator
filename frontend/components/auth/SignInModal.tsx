"use client";
import React, { useState } from "react";
import { useWallet } from "@/components/wallet/WalletProvider";

export default function SignInModal({ open, onClose }: { open: boolean; onClose: ()=>void }){
  const [panel, setPanel] = useState<'main'|'wallet'>('main');
  const { setModalOpen } = useWallet();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}/>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(520px,94%)] card glass-panel p-6">
        <h3 className="heading text-xl">Sign in</h3>
        {panel==='main' && (
          <div className="grid gap-3 mt-3 md:grid-cols-2">
            <button className="btn-primary" onClick={()=>{ /* email flow stub */ onClose(); }}>Continue with Email</button>
            <button className="btn-secondary" onClick={()=> setPanel('wallet')}>Connect Wallet</button>
          </div>
        )}
        {panel==='wallet' && (
          <div className="mt-3">
            <div className="text-subtle text-sm mb-2">Choose a wallet</div>
            <div className="grid gap-2">
              {['MetaMask','WalletConnect','Coinbase Wallet'].map(w => (
                <button key={w} className="btn-secondary justify-start" onClick={()=>{ setModalOpen(true); onClose(); }}>
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="text-subtle text-xs mt-3">Non-custodial by default. Your wallet stays in your control.</div>
      </div>
    </div>
  );
}
