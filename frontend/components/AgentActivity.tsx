import React from "react";

export default function AgentActivity(){
  const rows = [
    { t: "2025-08-01 10:15", a: "BUY BTC", n: "$1,200", s: "0.4%", r: "✅" },
    { t: "2025-08-01 10:16", a: "SELL ETH", n: "$900", s: "0.6%", r: "✅" },
    { t: "2025-08-01 10:18", a: "BUY BTC", n: "$2,100", s: "0.8%", r: "⛔" },
  ];
  return (
    <section className="mx-auto w-[min(1200px,95%)] pt-8">
      <div className="card glass-panel p-4">
        <div className="heading text-lg mb-2">Agent activity & safety</div>
        <div className="text-subtle text-xs mb-2">Policy: max order $2k, slippage ≤ 0.8%</div>
        <div className="grid gap-2 text-sm">
          {rows.map((r,i)=> (
            <div key={i} className={`grid grid-cols-[1.3fr_1fr_1fr_1fr_40px] gap-2 rounded-xl border p-2 border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] ${r.r==='✅'?'border-green-400/30':'border-red-400/30'} }`}>
              <div>{r.t}</div><div>{r.a}</div><div>{r.n}</div><div>slip {r.s}</div><div>{r.r}</div>
            </div>
          ))}
        </div>
        <a href="#policy" className="neon-underline text-sm mt-2 inline-block">View Roles policy</a>
      </div>
    </section>
  );
}
