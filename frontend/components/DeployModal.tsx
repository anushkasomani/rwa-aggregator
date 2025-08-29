"use client";
import React from "react";

export default function DeployModal({ open, onClose, onConfirm }: { open: boolean; onClose: ()=>void; onConfirm: ()=>void }){
  if (!open) return null;
  const checks = [
    "Fee caps set",
    "Drift bands ±5pp",
    "Turnover ≤ 15%",
    "Order max $2k",
    "Slippage ≤ 80 bps",
    "48h timelock",
    "Guardian pause",
  ];
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}/>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(560px,94%)] card glass-panel p-6">
        <h3 className="heading text-xl">Confirm deploy</h3>
        <ul className="mt-3 grid gap-2 text-sm">
          {checks.map(c=> (
            <li key={c} className="flex items-center gap-2"><span className="text-[var(--accent)]">✅</span> {c}</li>
          ))}
        </ul>
        <div className="mt-3 text-subtle text-sm grid gap-1">
          <div>Owner: Safe (multisig)</div>
          <div>Roles policy hash: 0x7f...ab</div>
          <div>Receipts (ERC-1155) enabled</div>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn-primary" onClick={onConfirm}>Confirm & Deploy</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
        <div className="text-subtle text-xs mt-2">Deployment is non-custodial and subject to policy constraints.</div>
      </div>
    </div>
  );
}
