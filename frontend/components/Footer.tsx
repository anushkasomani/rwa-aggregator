import React from "react";

export default function Footer(){
  return (
    <footer className="mx-auto w-[min(1200px,95%)] pt-20 pb-10" id="footer">
      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between text-sm">
        <nav className="flex gap-5 text-subtle">
          <a href="#docs" className="neon-underline">Docs</a>
          <a href="#templates" className="neon-underline">Kitchen</a>
          <a href="/community" className="neon-underline">Community</a>
          <a href="#security" className="neon-underline">Security</a>
          <a href="#careers" className="neon-underline">Careers</a>
        </nav>
        <div className="text-subtle max-w-xl text-xs">Educational only. Not investment advice. Strategies are non-custodial and gated by Safe + Roles.</div>
        <div className="flex gap-3 text-subtle">
          <a aria-label="X" href="#">✕</a>
          <a aria-label="GitHub" href="#"></a>
          <a aria-label="Discord" href="#">🟣</a>
        </div>
      </div>
    </footer>
  );
}
