import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  const plan = buildPlan(prompt || "");
  return NextResponse.json({ ok: true, plan });
}

function buildPlan(prompt: string) {
  const assets = ["BTC","ETH","SOL","ARB"].filter(a => prompt.toUpperCase().includes(a) || ["BTC","ETH"].includes(a));
  const weights = equalWeights(assets.length);
  return {
    meta: { createdAt: new Date().toISOString(), prompt },
    strategy: {
      universe: assets,
      rules: [
        { type: "sma", window: 20, condition: ">", field: "close" },
        { type: "volume", condition: ">", multipleOfAvg: 1.2 },
        { type: "sentiment", condition: ">", threshold: 0.55 },
      ],
      rebalance: { cadence: "weekly", maxTurnover: 0.15, driftBand: 0.05 },
    },
    target: Object.fromEntries(assets.map((a, i) => [a, weights[i]])),
  };
}

function equalWeights(n: number) {
  const w = 1 / Math.max(1, n);
  return Array.from({ length: n }, () => Number(w.toFixed(4)));
}
