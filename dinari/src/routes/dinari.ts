import { Router } from "express";
import { dinari } from "../services/dinariClient.js";

const router = Router();

/* ──────────────────────────────────────────────────────────────────────────
   Logging + error helpers
   ────────────────────────────────────────────────────────────────────────── */
router.use((req, res, next) => {
  const start = Date.now();
  console.log(`[dinari] -> ${req.method} ${req.originalUrl} body=`, req.body);
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[dinari] <- ${req.method} ${req.originalUrl} status=${res.statusCode} ${ms}ms`);
  });
  next();
});

function logDinariError(err: any, label: string) {
  try {
    console.error(`[dinari:error] ${label}`, JSON.stringify(err, Object.getOwnPropertyNames(err)));
  } catch {
    console.error(`[dinari:error] ${label}`, err);
  }
}

function jsonError(res: any, status: number, message: string, extra?: any) {
  return res.status(status).json({ error: message, ...(extra ?? {}) });
}

/* ──────────────────────────────────────────────────────────────────────────
   Tiny in-memory cache (quotes, stock list)
   ────────────────────────────────────────────────────────────────────────── */
type CacheEntry<T> = { at: number; ttl: number; value: T };
const cache = new Map<string, CacheEntry<any>>();

function setCache<T>(key: string, value: T, ttlMs: number) {
  cache.set(key, { at: Date.now(), ttl: ttlMs, value });
}
function getCache<T>(key: string): T | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.at > e.ttl) {
    cache.delete(key);
    return null;
  }
  return e.value as T;
}

/* ──────────────────────────────────────────────────────────────────────────
   CASH BALANCES (kept as-is, with robust errors)
   ────────────────────────────────────────────────────────────────────────── */
router.post("/account/cash-balances", async (req, res) => {
  try {
    const accountId = req.body?.accountId || process.env.ACCOUNT_ID;
    if (!accountId) return jsonError(res, 400, "Missing accountId");

    const resp: any = await dinari.v2.accounts.getCashBalances(accountId);
    console.log(`[dinari] cash-balances raw resp=`, resp);

    const rows = (resp?.data || resp || []).map((b: any) => ({
      currency: b.currency || b.currency_code || b.asset || b.symbol || "USD",
      available: Number(b.available ?? b.free ?? b.amount ?? b.balance ?? 0),
      pending: b.pending !== undefined ? Number(b.pending) : undefined,
      total:
        b.total !== undefined
          ? Number(b.total)
          : Number(b.available ?? b.free ?? b.amount ?? b.balance ?? 0),
      updatedAt: b.updated_at || b.updatedAt || null,
    }));

    return res.json({ balances: rows });
  } catch (err: any) {
    logDinariError(err, "cash-balances");
    return jsonError(res, err?.status || 500, err?.message || "Failed to load cash balances");
  }
});

/* ──────────────────────────────────────────────────────────────────────────
   ORDERS LIST (kept) + NEW: get single order/request
   ────────────────────────────────────────────────────────────────────────── */
router.post("/account/orders", async (req, res) => {
  try {
    const accountId = req.body?.accountId || process.env.ACCOUNT_ID;
    if (!accountId) return jsonError(res, 400, "Missing accountId");

    const resp: any = await dinari.v2.accounts.orders.list(accountId);
    console.log(`[dinari] orders list raw resp=`, resp);

    const items = (resp?.data || resp || []).map((o: any) => ({
      id: o.id || o.order_id,
      side: o.side || "-",
      symbol: o.symbol || o.stock_ticker || o.stock_id || "-",
      stockId: o.stock_id || null,
      quantity: Number(o.quantity ?? o.asset_quantity ?? 0),
      price:
        o.limit_price !== undefined
          ? Number(o.limit_price)
          : o.price !== undefined
          ? Number(o.price)
          : undefined,
      status: o.status || "-",
      createdAt: o.created_at || o.createdAt || null,
    }));

    return res.json({ orders: items });
  } catch (err: any) {
    logDinariError(err, "orders list");
    return jsonError(res, err?.status || 500, err?.message || "Failed to load orders");
  }
});

// Get a single order request (poll while pending)
router.post("/orders/request/retrieve", async (req, res) => {
  try {
    const { accountId, requestId } = req.body || {};
    if (!accountId || !requestId) {
      return jsonError(res, 400, "Missing accountId or requestId");
    }
    const data = await dinari.v2.accounts.orderRequests.retrieve(accountId, requestId);
    console.log(`[dinari] orderRequest.retrieve resp=`, data);
    return res.json({ request: data });
  } catch (err: any) {
    logDinariError(err, "orderRequest.retrieve");
    return jsonError(res, err?.status || 500, err?.message || "Failed to retrieve order request");
  }
});

// Get a single order by id
router.post("/orders/retrieve", async (req, res) => {
  try {
    const { accountId, orderId } = req.body || {};
    if (!accountId || !orderId) {
      return jsonError(res, 400, "Missing accountId or orderId");
    }
    const data = await dinari.v2.accounts.orders.retrieve(accountId, orderId);
    console.log(`[dinari] orders.retrieve resp=`, data);
    return res.json({ order: data });
  } catch (err: any) {
    logDinariError(err, "orders.retrieve");
    return jsonError(res, err?.status || 500, err?.message || "Failed to retrieve order");
  }
});

/* ──────────────────────────────────────────────────────────────────────────
   MARKET DATA: stocks list, stock map, quote (with short cache)
   ────────────────────────────────────────────────────────────────────────── */
router.get("/market/stocks", async (req, res) => {
  try {
    const force = req.query?.refresh === "1";
    let rows = !force ? getCache<any[]>("stocks:list") : null;

    if (!rows) {
      const resp: any = await dinari.v2.marketData.stocks.list();
      console.log(`[dinari] market.stocks.list resp=`, resp);

      rows = (resp?.data || resp || []).map((s: any) => ({
        id: s.id || s.stock_id || s.instrument_id,
        ticker: s.ticker || s.symbol,
        name: s.name || s.company_name || s.title || "",
      }));
      setCache("stocks:list", rows, 5 * 60 * 1000); // 5 minutes
    }

    return res.json({ stocks: rows });
  } catch (err: any) {
    logDinariError(err, "market.stocks.list");
    return jsonError(res, err?.status || 500, err?.message || "Failed to load stocks");
  }
});

router.get("/market/stock-map", async (req, res) => {
  try {
    let rows = getCache<any[]>("stocks:list");
    if (!rows) {
      const resp: any = await dinari.v2.marketData.stocks.list();
      rows = (resp?.data || resp || []).map((s: any) => ({
        id: s.id || s.stock_id || s.instrument_id,
        ticker: s.ticker || s.symbol,
        name: s.name || s.company_name || s.title || "",
      }));
      setCache("stocks:list", rows, 5 * 60 * 1000);
    }
    const map = rows.reduce((acc: any, s: any) => {
      if (s?.id) acc[s.id] = { ticker: s.ticker, name: s.name };
      return acc;
    }, {});
    return res.json({ map });
  } catch (err: any) {
    logDinariError(err, "market.stock-map");
    return jsonError(res, err?.status || 500, err?.message || "Failed to build stock map");
  }
});

// in routes/dinari.ts (or wherever you added the quote route)
router.post("/market/quote", async (req, res) => {
  const stockId = req.body?.stockId;
  if (!stockId) return res.status(400).json({ error: "Missing stockId" });

  try {
    const stocks: any = dinari.v2.marketData.stocks;

    let quoteResp;
    if (typeof stocks?.retrieveQuote === "function") {
      quoteResp = await stocks.retrieveQuote(stockId);
    } else if (typeof stocks?.getQuote === "function") {
      // fallback for older SDK shapes
      quoteResp = await stocks.getQuote(stockId);
    } else {
      // neither available => SDK too old
      return res.status(501).json({
        error:
          "Market quote method not available in this @dinari/api-sdk version. Please upgrade to the latest SDK.",
      });
    }

    // Normalize fields a bit for the frontend
    const q = quoteResp?.data ?? quoteResp;
    res.json({
      quote: {
        bid: Number(q?.bid ?? q?.best_bid ?? 0),
        ask: Number(q?.ask ?? q?.best_ask ?? 0),
        last: Number(q?.last ?? q?.price ?? 0),
        timestamp: q?.timestamp ?? q?.as_of ?? null,
        raw: q,
      },
    });
  } catch (err: any) {
    console.error("market/quote error", err?.response ?? err);
    res.status(err?.status || 500).json({ error: err?.message || "Failed to fetch quote" });
  }
});


/* ──────────────────────────────────────────────────────────────────────────
   ACCOUNT / ENTITY (kept as in your file)
   ────────────────────────────────────────────────────────────────────────── */
router.post("/bootstrap", async (req, res) => {
  const { userId, displayName } = req.body || {};
  try {
    const entity = await dinari.v2.entities.create({ name: displayName || `User-${userId}` });
    const account = await dinari.v2.entities.accounts.create(entity.id);
    return res.json({ entityId: entity.id, accountId: account.id });
  } catch (err: any) {
    logDinariError(err, "bootstrap");
    return jsonError(res, 500, "Failed to bootstrap Dinari account");
  }
});

router.post("/kyc/start", async (req, res) => {
  try {
    const { entityId } = req.body || {};
    const resp = await dinari.v2.entities.kyc.createManagedCheck(entityId);
    return res.json(resp);
  } catch (err: any) {
    logDinariError(err, "kyc/start");
    return jsonError(res, 500, "Failed to start KYC");
  }
});

router.post("/kyc/status", async (req, res) => {
  try {
    const { entityId } = req.body || {};
    const info = await dinari.v2.entities.kyc.retrieve(entityId);
    return res.json({ status: info.status });
  } catch (err: any) {
    logDinariError(err, "kyc/status");
    return jsonError(res, 500, "Failed to get KYC status");
  }
});

router.post("/wallet/connect", async (req, res) => {
  try {
    const { accountId, address, chainId } = req.body || {};
    const wallet = await dinari.v2.accounts.wallet.connectInternal(accountId, {
      chain_id: chainId,
      wallet_address: address,
      is_shared: false,
    });
    return res.json(wallet);
  } catch (err: any) {
    logDinariError(err, "wallet/connect");
    return jsonError(res, err?.status || 500, err?.message || "Failed to connect wallet");
  }
});

router.post("/mint-sandbox", async (req, res) => {
  try {
    const { accountId, chainId } = req.body || {};
    const resp = await dinari.v2.accounts.mintSandboxTokens(accountId, { chain_id: chainId });
    console.log(`[dinari] mint-sandbox resp=`, resp);
    return res.json(resp);
  } catch (err: any) {
    logDinariError(err, "mint-sandbox");
    return jsonError(res, err?.status || 500, err?.message || "Sandbox mint failed");
  }
});

/* ──────────────────────────────────────────────────────────────────────────
   ORDERS: Limit Buy (server-side $1 min guard)
   ────────────────────────────────────────────────────────────────────────── */
router.post("/orders/limit-buy", async (req, res) => {
  try {
    const { accountId, stockId, assetQuantity, limitPrice } = req.body || {};
    if (!accountId || !stockId || !assetQuantity || !limitPrice) {
      return jsonError(res, 400, "Missing accountId, stockId, assetQuantity, or limitPrice");
    }

    // Enforce Dinari min notional $1 to avoid 400 HTML responses
    const notional = Number(assetQuantity) * Number(limitPrice);
    if (isFinite(notional) && notional < 1) {
      return jsonError(res, 400, "Order notional must be ≥ $1.00", { notional });
    }

    const orderReq = await dinari.v2.accounts.orderRequests.createLimitBuy(accountId, {
      asset_quantity: Number(assetQuantity),
      limit_price: Number(limitPrice),
      stock_id: stockId,
    });
    console.log(`[dinari] orderRequests.createLimitBuy resp=`, orderReq);

    return res.json(orderReq);
  } catch (err: any) {
    logDinariError(err, "orders/limit-buy");
    return jsonError(res, err?.status || 500, err?.message || "Order failed");
  }
});

export default router;
