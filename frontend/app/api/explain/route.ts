import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = {
    date: new Date().toISOString().slice(0,10),
    items: [
      { asset: 'BTC', notes: ['price > SMA', 'volume 1.2x', 'sentiment 0.62'] },
      { asset: 'ETH', notes: ['price > SMA', 'volume 1.1x', 'sentiment 0.55'] },
    ],
  };
  return NextResponse.json({ ok: true, data, received: body });
}
