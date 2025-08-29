import React from "react";

export default function DocsSpotlight(){
  const cards = [
    { t: "What’s a Strategy DSL?", d: "A compact representation of portfolio rules, constraints, and execution." },
    { t: "Why ERC-7540 async?", d: "Async requests enable batched, fair settlement and transferable receipts." },
    { t: "Safe + Zodiac Roles", d: "Granular, verifiable permissions for autonomous agents." },
  ];
  return (
    <section id="docs" className="mx-auto w-[min(1200px,95%)] pt-16">
      <h2 className="heading text-2xl">Learn the system</h2>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map(c => (
          <article key={c.t} className="card glass-panel p-4">
            <div className="font-semibold">{c.t}</div>
            <p className="text-subtle text-sm mt-1">{c.d}</p>
            <a href="#" className="neon-underline text-sm mt-3 inline-block">Read docs</a>
          </article>
        ))}
      </div>
    </section>
  );
}
