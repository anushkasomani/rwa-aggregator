"use client";
import React from "react";

export default function AssetTagsRow({ assets, className }: { assets: string[]; className?: string }) {
  if (!Array.isArray(assets) || assets.length === 0) return null;
  return (
    <div className={`assets-scroll flex items-center gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className ?? ""}`}>
      {assets.map((a) => (
        <span key={a} className="asset-badge select-none">{a}</span>
      ))}
    </div>
  );
}
