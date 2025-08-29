import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import {
  handleGetVaults,
  handleGetVault,
  handleCreateDeposit,
  handleCreateVault
} from "./routes/vaults";
import {
  handleGetPositions,
  handleGetReceipts,
  handleClaimReceipt,
  handleParseStrategy,
  handlePreviewStrategy
} from "./routes/user";
import {
  handleMintSandbox,
  handleCashBalances,
  handleAccountOrders,
  handleAccountPositions,
  handleAccountPortfolio,
  handleMarketQuote,
  handleLimitBuy
} from "./routes/dinari";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Vault API routes
  app.get("/api/vaults", handleGetVaults);
  app.get("/api/vaults/:id", handleGetVault);
  app.post("/api/vaults/:id/deposits", handleCreateDeposit);
  app.post("/api/vaults", handleCreateVault);

  // User API routes
  app.get("/api/me/positions", handleGetPositions);
  app.get("/api/me/receipts", handleGetReceipts);
  app.post("/api/vaults/:vaultId/receipts/:receiptId/claim", handleClaimReceipt);

  // Strategy builder API routes
  app.post("/api/strategy/parse", handleParseStrategy);
  app.post("/api/strategy/preview", handlePreviewStrategy);

  // Dinari API routes (mocks for development)
  app.post("/api/dinari/mint-sandbox", handleMintSandbox);
  app.post("/api/dinari/account/cash-balances", handleCashBalances);
  app.post("/api/dinari/account/orders", handleAccountOrders);
  app.post("/api/dinari/account/positions", handleAccountPositions);
  app.post("/api/dinari/account/portfolio", handleAccountPortfolio);
  app.post("/api/dinari/market/quote", handleMarketQuote);
  app.post("/api/dinari/orders/limit-buy", handleLimitBuy);

  return app;
}
