import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { prepareCreateVaultTransactions } = await import('../../../../../kamino/src/createVault');
    
    const result = await prepareCreateVaultTransactions(body);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}