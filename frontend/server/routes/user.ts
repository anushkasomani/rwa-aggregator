import { RequestHandler } from "express";

// Mock user positions
const mockPositions = [
  {
    id: "pos-1",
    vaultId: "ew-btc-eth",
    vaultName: "EW BTC/ETH (gated)",
    shares: 965.432,
    pps: 1.034,
    value: 998.256,
    pnl: 48.256,
    pnlPercent: 0.0508,
    lastAction: "Deposit 7 days ago"
  },
  {
    id: "pos-2",
    vaultId: "real-estate-diversified",
    vaultName: "Real Estate Diversified",
    shares: 1234.567,
    pps: 1.156,
    value: 1427.159,
    pnl: 127.159,
    pnlPercent: 0.0978,
    lastAction: "Rebalance 2 days ago"
  }
];

// Mock user receipts
const mockReceipts = [
  {
    id: "receipt-1",
    vaultId: "ew-btc-eth",
    vaultName: "EW BTC/ETH (gated)",
    type: "DEPOSIT",
    status: "CLAIMABLE",
    amount: "500",
    asset: "USDC",
    estimatedShares: "483.870",
    createdAt: "2024-01-15T10:30:00Z"
  },
  {
    id: "receipt-2",
    vaultId: "real-estate-diversified",
    vaultName: "Real Estate Diversified",
    type: "DEPOSIT",
    status: "IN_SETTLEMENT",
    amount: "1000",
    asset: "USDC",
    estimatedShares: "865.051",
    createdAt: "2024-01-14T16:45:00Z"
  },
  {
    id: "receipt-3",
    vaultId: "ew-btc-eth",
    vaultName: "EW BTC/ETH (gated)",
    type: "WITHDRAWAL",
    status: "SETTLED",
    amount: "200",
    asset: "USDC",
    estimatedShares: null,
    createdAt: "2024-01-10T09:15:00Z"
  }
];

export const handleGetPositions: RequestHandler = (req, res) => {
  res.json({
    items: mockPositions
  });
};

export const handleGetReceipts: RequestHandler = (req, res) => {
  res.json({
    items: mockReceipts
  });
};

export const handleClaimReceipt: RequestHandler = (req, res) => {
  const { vaultId, receiptId } = req.params;

  // Find the receipt
  const receiptIndex = mockReceipts.findIndex(r => r.id === receiptId);
  
  if (receiptIndex === -1) {
    return res.status(404).json({ error: 'Receipt not found' });
  }

  // Update status to settled
  mockReceipts[receiptIndex].status = 'SETTLED';

  res.json({
    success: true,
    message: 'Receipt claimed successfully'
  });
};

// Strategy builder endpoints
export const handleParseStrategy: RequestHandler = (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Strategy text is required' });
  }

  // Simple mock parsing logic
  const isRealEstate = text.toLowerCase().includes('real estate');
  const isCrypto = text.toLowerCase().includes('btc') || text.toLowerCase().includes('eth') || text.toLowerCase().includes('crypto');
  const isCommodities = text.toLowerCase().includes('commodities') || text.toLowerCase().includes('gold');
  
  let suggestedName = 'Custom Strategy';
  let assets = ['USDC'];
  
  if (isRealEstate) {
    suggestedName = 'Real Estate Strategy';
    assets = ['REIT_BASKET', 'USDC'];
  } else if (isCrypto) {
    suggestedName = 'Crypto Strategy';
    assets = ['BTC', 'ETH'];
  } else if (isCommodities) {
    suggestedName = 'Commodities Strategy';
    assets = ['GOLD', 'SILVER', 'OIL'];
  }

  const plan = {
    type: 'EQUAL_WEIGHT',
    assets: assets,
    rebalancing: {
      frequency: 'weekly',
      driftThreshold: 0.05
    },
    gates: {
      trend: text.toLowerCase().includes('trend'),
      volume: text.toLowerCase().includes('volume'),
      sentiment: text.toLowerCase().includes('sentiment')
    }
  };

  res.json({
    plan,
    suggestedName
  });
};

export const handlePreviewStrategy: RequestHandler = (req, res) => {
  const { plan, overrides } = req.body;

  if (!plan) {
    return res.status(400).json({ error: 'Strategy plan is required' });
  }

  // Mock preview data
  const preview = {
    assets: overrides?.assets || plan.assets || ['BTC', 'ETH'],
    rebalancing: overrides?.rebalancing || plan.rebalancing || { frequency: 'weekly' },
    gates: overrides?.gates || plan.gates || { trend: true, volume: true },
    tradingWindows: overrides?.tradingWindows || { start: '09:00', end: '16:00' },
    fees: overrides?.fees || { management: 0.015, performance: 0.15 },
    guardrails: {
      maxWeight: 0.4,
      driftBand: 0.05,
      turnoverCap: 0.15,
      slippageCap: 0.008
    }
  };

  // Mock backtest data
  const backtest = {
    equityCurve: [
      { t: "2023-01-01", equity: 1.0 },
      { t: "2023-02-01", equity: 1.05 },
      { t: "2023-03-01", equity: 1.12 },
      { t: "2023-04-01", equity: 1.08 },
      { t: "2023-05-01", equity: 1.18 },
      { t: "2023-06-01", equity: 1.23 }
    ],
    drawdown: [
      { t: "2023-01-01", value: 0 },
      { t: "2023-02-01", value: -0.02 },
      { t: "2023-03-01", value: 0 },
      { t: "2023-04-01", value: -0.04 },
      { t: "2023-05-01", value: 0 },
      { t: "2023-06-01", value: 0 }
    ],
    stats: {
      totalReturn: 0.23,
      sharpe: 1.45,
      maxDrawdown: -0.04,
      volatility: 0.16
    }
  };

  res.json({
    ...preview,
    backtest
  });
};
