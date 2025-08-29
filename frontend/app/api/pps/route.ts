import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vault = searchParams.get('vault');
  const series = Array.from({ length: 60 }, (_, i) => ({ t: days(i * -1), v: 100 + Math.sin(i/6)*5 + i*0.2 }));
  return NextResponse.json({ ok: true, vault, series });
}
function days(delta: number){ const d = new Date(); d.setDate(d.getDate()+delta); return d.toISOString().slice(0,10); }
