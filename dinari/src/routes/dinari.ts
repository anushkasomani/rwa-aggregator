import { Router } from "express";
import { dinari } from "../services/dinariClient.js"; // see below

const router = Router();

// Create entity + account
router.post("/bootstrap", async (req, res) => {
  const { userId, displayName } = req.body;
  try {
    const entity = await dinari.v2.entities.create({ name: displayName || `User-${userId}` });
    const account = await dinari.v2.entities.accounts.create(entity.id);

    // TODO: Save entity.id and account.id in DB against userId
    res.json({ entityId: entity.id, accountId: account.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to bootstrap Dinari account" });
  }
});

// Start KYC
router.post("/kyc/start", async (req, res) => {
  const { entityId } = req.body;
  try {
    const resp = await dinari.v2.entities.kyc.createManagedCheck(entityId);
    res.json(resp);
  } catch (err) {
    res.status(500).json({ error: "Failed to start KYC" });
  }
});

// Get KYC status
router.post("/kyc/status", async (req, res) => {
  const { entityId } = req.body;
  const info = await dinari.v2.entities.kyc.retrieve(entityId);
  res.json({ status: info.status });
});

// Connect wallet
router.post("/wallet/connect", async (req, res) => {
  const { accountId, address, chainId } = req.body;
  const wallet = await dinari.v2.accounts.wallet.connectInternal(accountId, {
    chain_id: chainId,
    wallet_address: address,
    is_shared: false,
  });
  res.json(wallet);
});

// Mint sandbox token
router.post("/mint-sandbox", async (req, res) => {
  const { accountId, chainId } = req.body;
  const resp = await dinari.v2.accounts.mintSandboxTokens(accountId, { chain_id: chainId });
  res.json(resp);
});

// Place limit buy order
router.post("/orders/limit-buy", async (req, res) => {
  const { accountId, stockId, assetQuantity, limitPrice } = req.body;
  const orderReq = await dinari.v2.accounts.orderRequests.createLimitBuy(accountId, {
    asset_quantity: assetQuantity,
    limit_price: limitPrice,
    stock_id: stockId,
  });
  res.json(orderReq);
});

export default router;
