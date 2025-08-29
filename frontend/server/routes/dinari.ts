import { RequestHandler } from "express";

// Mock Dinari API endpoints to prevent fetch errors

export const handleMintSandbox: RequestHandler = (req, res) => {
  const { accountId, chainId } = req.body;
  
  // Simulate sandbox minting
  res.json({
    success: true,
    message: "Sandbox USDC minted successfully",
    accountId,
    chainId,
    amount: 10000, // $10,000 USDC
    timestamp: new Date().toISOString()
  });
};

export const handleCashBalances: RequestHandler = (req, res) => {
  const { accountId } = req.body;
  
  // Mock cash balances
  res.json({
    balances: [
      {
        currency: "USDC",
        available: 9500.00,
        pending: 0.00,
        total: 9500.00,
        updatedAt: new Date().toISOString()
      },
      {
        currency: "USD",
        available: 0.00,
        pending: 0.00,
        total: 0.00,
        updatedAt: new Date().toISOString()
      }
    ]
  });
};

export const handleAccountOrders: RequestHandler = (req, res) => {
  const { accountId } = req.body;
  
  // Mock orders
  res.json({
    orders: [
      {
        id: "order-1",
        side: "buy",
        symbol: "0196ea6d-b6e4-730e-a611-28c6f11c9b52", // Tesla stockId
        quantity: 2.0834,
        price: 239.50,
        status: "filled",
        createdAt: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      },
      {
        id: "order-2", 
        side: "buy",
        symbol: "AAPL_STOCK_ID",
        quantity: 1.5000,
        price: 178.45,
        status: "pending",
        createdAt: new Date(Date.now() - 1800000).toISOString() // 30 min ago
      }
    ]
  });
};

export const handleAccountPositions: RequestHandler = (req, res) => {
  const { accountId } = req.body;
  
  // Mock positions
  res.json({
    positions: [
      {
        stockId: "0196ea6d-b6e4-730e-a611-28c6f11c9b52", // Tesla
        quantity: 2.0834,
        averagePrice: 239.50,
        marketValue: 498.85,
        updatedAt: new Date().toISOString()
      }
    ]
  });
};

export const handleAccountPortfolio: RequestHandler = (req, res) => {
  const { accountId } = req.body;
  
  // Mock portfolio summary
  res.json({
    portfolio: {
      totalValue: 9998.85,
      cashValue: 9500.00,
      positionsValue: 498.85,
      updatedAt: new Date().toISOString()
    }
  });
};

export const handleMarketQuote: RequestHandler = (req, res) => {
  const { stockId } = req.body;
  
  // Mock quote data - simulate real market prices with slight variations
  const basePrice = stockId === "0196ea6d-b6e4-730e-a611-28c6f11c9b52" ? 239.50 : 178.45;
  const spread = 0.02;
  
  res.json({
    quote: {
      bid: basePrice - spread,
      ask: basePrice + spread,
      last: basePrice + (Math.random() - 0.5) * 2, // Small random variation
      timestamp: new Date().toISOString()
    }
  });
};

export const handleLimitBuy: RequestHandler = (req, res) => {
  const { accountId, stockId, assetQuantity, limitPrice } = req.body;
  
  if (!accountId || !stockId || !assetQuantity || !limitPrice) {
    return res.status(400).json({ 
      error: "Missing required fields: accountId, stockId, assetQuantity, limitPrice" 
    });
  }
  
  // Simulate order placement
  const orderId = `ord_${Date.now()}`;
  
  res.json({
    success: true,
    id: orderId,
    accountId,
    stockId,
    assetQuantity,
    limitPrice,
    status: "pending",
    createdAt: new Date().toISOString(),
    message: "Limit buy order placed successfully"
  });
};
