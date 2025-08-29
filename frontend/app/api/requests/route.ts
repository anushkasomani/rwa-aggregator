import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vault = searchParams.get('vault');
  const rows = [
    { id: 1, type: 'Deposit', amount: 250, status: 'pending', date: new Date().toISOString().slice(0,10) },
    { id: 2, type: 'Redeem', amount: 120, status: 'claimable', date: new Date().toISOString().slice(0,10) },
  ];
  return NextResponse.json({ ok: true, vault, rows });
}
