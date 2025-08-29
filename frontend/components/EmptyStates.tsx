import React from "react";

export function EmptyBacktest(){
  return (
    <div className="card glass-panel p-6 text-center">
      <div className="heading text-xl">Feed me a strategy and I’ll cook the numbers.</div>
      <button className="btn-secondary mt-3">Run Backtest</button>
    </div>
  );
}

export function EmptyVaults(){
  return (
    <div className="card glass-panel p-6 text-center">
      <div className="heading text-xl">Publish your first strategy as a vault—non-custodial by default.</div>
      <button className="btn-secondary mt-3">Create Vault</button>
    </div>
  );
}

export function EmptyRequests(){
  return (
    <div className="card glass-panel p-6 text-center">
      <div className="heading text-xl">Deposits settle in batches for better execution.</div>
    </div>
  );
}
