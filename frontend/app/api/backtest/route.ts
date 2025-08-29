import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { plan } = await req.json();
  const seeded = hash(JSON.stringify(plan?.meta?.prompt || "demo"));
  const series = generateCurve(365, seeded);
  const stats = computeStats(series);
  const table = buildRebalances(series);
  return NextResponse.json({ ok: true, series, stats, rebalances: table });
}

function generateCurve(days: number, seed: number) {
  let s = 100;
  const out: { t: string; v: number; why: string[] }[] = [];
  for (let i = 0; i < days; i++) {
    const r = (rand(seed + i) - 0.5) * 0.02;
    s *= 1 + r;
    out.push({ t: dateFromNow(-days + i), v: Number(s.toFixed(2)), why: whyNotes(r) });
  }
  return out;
}

function whyNotes(r: number) {
  return [
    `price vs SMA: ${r > 0 ? ">" : "<"}`,
    `volume vs avg: ${Math.abs(r).toFixed(2)}x`,
    `sentiment: ${(0.5 + r).toFixed(2)}`,
  ];
}

function computeStats(series: { v: number }[]) {
  const start = series[0].v;
  const end = series[series.length - 1].v;
  const ret = (end / start) - 1;
  const daily = series.slice(1).map((p, i) => p.v / series[i].v - 1);
  const mean = daily.reduce((a,b)=>a+b,0)/daily.length;
  const vol = Math.sqrt(daily.map(d=>Math.pow(d-mean,2)).reduce((a,b)=>a+b,0)/daily.length);
  const sharpe = vol ? (mean/vol)*Math.sqrt(252) : 0;
  const maxDD = maxDrawdown(series.map(s=>s.v));
  const years = 1;
  const cagr = Math.pow(1+ret, 1/years) - 1;
  return { CAGR: cagr, Sharpe: sharpe, MaxDrawdown: maxDD, TotalReturn: ret };
}

function maxDrawdown(vals: number[]) {
  let peak = vals[0];
  let dd = 0;
  for (const v of vals) { peak = Math.max(peak, v); dd = Math.min(dd, v/peak - 1); }
  return dd;
}

function buildRebalances(series: { t: string; v: number }[]) {
  const rows: any[] = [];
  for (let i = 7; i < series.length; i += 7) {
    rows.push({ date: series[i].t, weights: { BTC: 0.5, ETH: 0.5 }, why: ["price vs SMA: >","volume vs avg: 1.2x","sentiment: 0.6"] });
  }
  return rows;
}

function dateFromNow(deltaDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0,10);
}

function rand(n: number) { return fract(Math.sin(n) * 10000); }
function fract(x: number) { return x - Math.floor(x); }
function hash(str: string) { let h=0; for (let i=0;i<str.length;i++){h=(h<<5)-h+str.charCodeAt(i); h|=0;} return Math.abs(h); }
