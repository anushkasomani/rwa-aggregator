"use client";
import React from "react";

export default function StrategyCruxHighlight({ crux, className }: { crux: string; className?: string }) {
  if (!crux) return null;
  return (
    <div className={`crux-highlight flex items-start gap-3 ${className ?? ""}`}>
      <span className="crux-icon" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a7 7 0 0 0-4 12v2h8v-2A7 7 0 0 0 12 3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
      </span>
      <p className="crux-text">{crux}</p>
    </div>
  );
}
