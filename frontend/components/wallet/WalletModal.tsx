"use client";
import React from "react";
import { useWallet } from "./WalletProvider";

export default function WalletModal(){
  const { modalOpen, setModalOpen, connect } = useWallet();
  if (!modalOpen) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={()=>setModalOpen(false)}/>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(520px,94%)] card glass-panel p-6">
        <h3 className="heading text-xl">Connect Wallet</h3>
        <div className="grid gap-2 mt-3">
          {[
            { name: "MetaMask" },
            { name: "WalletConnect" },
            { name: "Coinbase Wallet" },
          ].map(w=> (
            <button key={w.name} className="btn-secondary justify-start" onClick={()=> connect()}>
              {w.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
