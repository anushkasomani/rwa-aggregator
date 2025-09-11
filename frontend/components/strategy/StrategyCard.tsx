"use client";
import React from "react";
import AssetTagsRow from "@/components/strategy/AssetTagsRow";
import StrategyCruxHighlight from "@/components/strategy/StrategyCruxHighlight";

export default function StrategyCard({
  name,
  assets,
  crux,
  rebalance,
  className,
}: {
  name: string;
  assets: string[];
  crux: string;
  rebalance: string;
  className?: string;
}) {
  return (
    <article className={`card glass-panel p-5 ${className ?? ""}`}>
      <h3 className="heading text-xl truncate">{name}</h3>
      <div className="mt-2">
        <AssetTagsRow assets={assets} />
      </div>
      <div className="mt-3">
        <StrategyCruxHighlight crux={crux} />
      </div>
      <div className="strategy-card-footer mt-4 text-xs text-subtle">Rebalance: {rebalance || "—"}</div>
    </article>
  );
}
