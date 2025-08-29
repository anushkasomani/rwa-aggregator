import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Search,
  CheckCircle,
  AlertCircle,
  Info,
  Clock,
  ChevronRight,
} from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

// ======= CONFIG =======
const API_BASE =
  (import.meta as any)?.env?.VITE_BACKEND_URL ||
  (window as any).__API_BASE__ ||
  ""; // Use relative URLs for same-origin requests
const IS_SANDBOX =
  ((import.meta as any)?.env?.VITE_DINARI_ENV || "sandbox") === "sandbox";
// ======================

type RwaAsset = {
  id: string;
  ticker: string;
  stockId?: string;
  name: string;
  price: number; // UI reference price; live price comes from quote
  oracle: string;
  issuer: "dinari";
  icon: string;
  marketCap: string;
  compliance: "verified" | "pending" | "non";
  dividendYield: string;
};

type CashBalance = {
  currency: string;
  available: number;
  pending?: number;
  total?: number;
  updatedAt?: string | null;
};

type OrderRow = {
  id: string;
  side: string;
  symbol: string;     // backend may return stock_id here
  quantity: number;   // may be 0 if backend uses a different field name
  price?: number;
  status: string;
  createdAt?: string | null;
};

type Quote = {
  bid?: number;
  ask?: number;
  last?: number;
  timestamp?: string | null;
};

type PositionRow = {
  stockId: string;
  quantity: number;
  averagePrice?: number;
  marketValue?: number;
  updatedAt?: string | null;
};

type PortfolioSummary = {
  totalValue?: number;
  cashValue?: number;
  positionsValue?: number;
  updatedAt?: string | null;
};

// helpers
const fmt4 = (n: number | string | undefined | null) =>
  (n === undefined || n === null ? "0.0000" : Number(n).toFixed(4));
const fmt2 = (n: number | string | undefined | null) =>
  (n === undefined || n === null ? "0.00" : Number(n).toFixed(2));

export default function Mint() {
  const [selectedAsset, setSelectedAsset] = useState<RwaAsset | null>(null);
  const [mintAmount, setMintAmount] = useState("");
  const [isUsingFiat, setIsUsingFiat] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Hard-coded for your test
  const [entityId] = useState<string | null>("0198b787-5de4-768a-89f7-a8b94bdf7c5e");
  const [accountId] = useState<string | null>("0198b787-e82d-7016-9e14-5a0e4dabd3d3");

  // Independent loading flags
  const [loadingMint, setLoadingMint] = useState(false);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);

  const [mintStatus, setMintStatus] = useState<"idle" | "minting" | "success" | "error">("idle");

  // Live data
  const [cashBalances, setCashBalances] = useState<CashBalance[] | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [positions, setPositions] = useState<PositionRow[] | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);

  const bootOnce = useRef(false);
  const quoteTimer = useRef<number | null>(null);

  const rwAssets: RwaAsset[] = [
    { id: "tsla", ticker: "bTSLA", stockId: "0196ea6d-b6e4-730e-a611-28c6f11c9b52", name: "Tesla Inc.", price: 239.5, oracle: "Chainlink", issuer: "dinari", icon: "⚡", marketCap: "$760B", compliance: "verified", dividendYield: "0.00%" },
    { id: "aapl", ticker: "bAAPL", stockId: (import.meta as any)?.env?.VITE_DINARI_AAPL_ID, name: "Apple Inc.", price: 178.45, oracle: "Chainlink", issuer: "dinari", icon: "🍎", marketCap: "$2.8T", compliance: "verified", dividendYield: "0.44%" },
    { id: "googl", ticker: "bGOOGL", stockId: (import.meta as any)?.env?.VITE_DINARI_GOOGL_ID, name: "Alphabet Inc.", price: 125.8, oracle: "Chainlink", issuer: "dinari", icon: "🔍", marketCap: "$1.6T", compliance: "verified", dividendYield: "0.00%" },
    { id: "amzn", ticker: "bAMZN", stockId: (import.meta as any)?.env?.VITE_DINARI_AMZN_ID, name: "Amazon.com Inc.", price: 142.3, oracle: "Chainlink", issuer: "dinari", icon: "📦", marketCap: "$1.5T", compliance: "pending", dividendYield: "0.00%" },
  ];

  // Search
  const filteredAssets = useMemo(() => {
    const t = searchTerm.toLowerCase();
    return rwAssets.filter(
      (a) => a.ticker.toLowerCase().includes(t) || a.name.toLowerCase().includes(t)
    );
  }, [rwAssets, searchTerm]);

  // stockId -> ticker/name/icon index for pretty display
  const stockIdIndex = useMemo(() => {
    const m: Record<string, { ticker: string; name: string; icon: string }> = {};
    for (const a of rwAssets) if (a.stockId) m[a.stockId] = { ticker: a.ticker, name: a.name, icon: a.icon };
    return m;
  }, [rwAssets]);

  const getComplianceStatus = (asset: RwaAsset) => {
    switch (asset.compliance) {
      case "verified": return { icon: CheckCircle, color: "text-green-600", text: "Compliant" } as const;
      case "pending":  return { icon: Clock,      color: "text-yellow-600", text: "Pending" } as const;
      default:         return { icon: AlertCircle, color: "text-red-600",   text: "Non-compliant" } as const;
    }
  };

  // Expected/cost helpers
  function calculateExpectedTokens() {
    if (!mintAmount || !selectedAsset) return "0.0000";
    const amount = parseFloat(mintAmount);
    if (!amount || amount <= 0) return "0.0000";
    const px = (quote?.last ?? selectedAsset.price) * 1.02; // use live price w/ 2% buffer for preview
    return isUsingFiat ? (amount / px).toFixed(4) : amount.toFixed(4);
  }

  // Single source of truth for order terms, also used to gate $1 min
  function computeOrderTerms() {
    if (!selectedAsset) return null;
    const amountNum = parseFloat(mintAmount);
    if (!amountNum || amountNum <= 0) return null;

    const refPrice = quote?.last ?? selectedAsset.price;
    const priceBuffer = 1.02; // 2% buffer
    const limitPrice = refPrice * priceBuffer;

    const assetQuantity = isUsingFiat
      ? +(amountNum / limitPrice).toFixed(6) // USD -> qty
      : +amountNum.toFixed(6);               // tokens -> qty

    const notionalUSD = assetQuantity * limitPrice;

    return { assetQuantity, limitPrice, notionalUSD };
  }

  const terms = computeOrderTerms();

  // ── Auto-mint on mount, then pull balances & orders & portfolio & positions
  useEffect(() => {
    if (bootOnce.current) return;
    bootOnce.current = true;

    (async () => {
      if (!IS_SANDBOX || !accountId) return;

      try {
        setLoadingMint(true);
        setMintStatus("minting");

        const resp = await fetch(`${API_BASE}/api/dinari/mint-sandbox`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, chainId: "eip155:11155111" }),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }

        const data = await resp.json();
        setMintStatus("success");
      } catch (e) {
        console.warn("Sandbox mint error:", e);
        setMintStatus("error");
      } finally {
        setLoadingMint(false);
      }

      // Continue with data loading even if mint fails
      await Promise.all([
        refreshBalances().catch(e => console.warn("Failed to load balances:", e)),
        refreshOrders().catch(e => console.warn("Failed to load orders:", e)),
        refreshPortfolio().catch(e => console.warn("Failed to load portfolio:", e)),
        refreshPositions().catch(e => console.warn("Failed to load positions:", e)),
      ]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  // ── Quotes: refresh when asset changes + poll every 10s
  useEffect(() => {
    // clear any previous timers
    if (quoteTimer.current) {
      window.clearInterval(quoteTimer.current);
      quoteTimer.current = null;
    }
    setQuote(null);

    if (!selectedAsset?.stockId) return;

    const load = async () => {
      try {
        setLoadingQuote(true);
        const resp = await fetch(`${API_BASE}/api/dinari/market/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stockId: selectedAsset.stockId }),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }

        const json = await resp.json();
        setQuote(json?.quote || null);
      } catch (e) {
        console.warn("Quote unavailable:", e.message || e);
        setQuote(null);
      } finally {
        setLoadingQuote(false);
      }
    };

    load();
    quoteTimer.current = window.setInterval(load, 10_000);
    return () => {
      if (quoteTimer.current) window.clearInterval(quoteTimer.current);
      quoteTimer.current = null;
    };
  }, [selectedAsset?.stockId]);

  // --- API calls ---
  async function refreshBalances() {
    try {
      setLoadingBalances(true);
      const resp = await fetch(`${API_BASE}/api/dinari/account/cash-balances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = await resp.json();
      setCashBalances(json?.balances || []);
    } catch (e) {
      console.warn("Cash balances unavailable:", e.message || e);
      setCashBalances([]);
    } finally {
      setLoadingBalances(false);
    }
  }

  async function refreshOrders() {
    try {
      setLoadingOrders(true);
      const resp = await fetch(`${API_BASE}/api/dinari/account/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = await resp.json();
      setOrders(json?.orders || []);
    } catch (e) {
      console.warn("Orders unavailable:", e.message || e);
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }

  async function refreshPositions() {
    try {
      setLoadingPositions(true);
      const resp = await fetch(`${API_BASE}/api/dinari/account/positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = await resp.json();
      setPositions(json?.positions || []);
    } catch (e) {
      console.warn("Positions unavailable:", e.message || e);
      setPositions([]);
    } finally {
      setLoadingPositions(false);
    }
  }

  async function refreshPortfolio() {
    try {
      setLoadingPortfolio(true);
      const resp = await fetch(`${API_BASE}/api/dinari/account/portfolio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = await resp.json();
      setPortfolio(json?.portfolio || null);
    } catch (e) {
      console.warn("Portfolio unavailable:", e.message || e);
      setPortfolio(null);
    } finally {
      setLoadingPortfolio(false);
    }
  }

  async function handlePlaceOrder() {
    if (!accountId) return alert("Missing accountId");
    if (!selectedAsset) return alert("Select an asset first");

    const t = computeOrderTerms();
    if (!t) return alert("Enter a valid amount");
    if (!selectedAsset.stockId) return alert("Missing stockId for selected asset. Set VITE_DINARI_* IDs.");
    if (t.notionalUSD < 1) return alert("Order must be at least $1.00 notional");

    try {
      setPlacingOrder(true);

      const resp = await fetch(`${API_BASE}/api/dinari/orders/limit-buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          stockId: selectedAsset.stockId,
          assetQuantity: t.assetQuantity,
          limitPrice: t.limitPrice,
        }),
      });

      // robust parse to avoid "<!doctype ...>" JSON errors if server misfires
      const text = await resp.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { error: text }; }

      if (!resp.ok) throw new Error(data?.error || "Order failed");
      alert(`Order placed${data?.id ? ` (#${data.id})` : "!"}`);
    } catch (e: any) {
      console.error("Order error:", e);
      alert(e?.message || "Order failed");
    } finally {
      setPlacingOrder(false);
      await Promise.all([refreshBalances(), refreshOrders(), refreshPositions(), refreshPortfolio()]);
    }
  }

  const disableOrderBtn =
    placingOrder ||
    !accountId ||
    !selectedAsset ||
    !mintAmount ||
    !parseFloat(mintAmount) ||
    !(terms && terms.notionalUSD >= 1);

  return (
    <div className="flex gap-6 h-full">
      {/* Left Column - Dinari & Assets */}
      <div className="w-72 space-y-4">
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-1">Issuer</h3>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🏛️</span>
            <div className="flex-1">
              <div className="font-medium text-gray-900">Dinari</div>
              <div className="text-sm text-gray-600 mb-2">
                US equity tokens (testnet). KYC disabled in sandbox.
              </div>
              <div className="text-xs text-gray-500">
                <div>Environment: {IS_SANDBOX ? "Sandbox (Sepolia)" : "Live"}</div>
                <div className="mt-1">
                  Entity: {entityId ? entityId.slice(0, 8) + "..." : "-"} • Account:{" "}
                  {accountId ? accountId.slice(0, 8) + "..." : "-"}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Assets list */}
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-4">Supported RWAs</h3>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search assets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredAssets.map((asset) => {
                const compliance = getComplianceStatus(asset);
                const Icon = compliance.icon;
                return (
                  <div
                    key={asset.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedAsset?.id === asset.id
                        ? "border-rwa-blue-500 bg-rwa-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                    onClick={() => setSelectedAsset(asset)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{asset.icon}</span>
                        <div>
                          <div className="font-medium text-sm">{asset.ticker}</div>
                          <div className="text-xs text-gray-500">{asset.name}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-medium">${asset.price}</div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">{asset.oracle}</Badge>
                          <Icon className={`w-3 h-3 ${compliance.color}`} />
                        </div>
                      </div>
                    </div>
                    {!IS_SANDBOX && !asset.stockId && (
                      <div className="mt-2 text-[11px] text-red-600">Missing stockId for live orders</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Center Column */}
      <div className="flex-1">
        <Card className="p-6 sticky top-4 shadow-xl ring-1 ring-rwa-blue-100 hover:shadow-2xl transition-shadow bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              Mint Tokens (Auto on Mount)
              <span className="ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-gray-600">
                <ChevronRight className="w-3 h-3 mr-1" /> {IS_SANDBOX ? "Sandbox (Sepolia)" : "Live"}
              </span>
            </h2>
          </div>

          {/* Live Quote */}
          <div className="mb-4">
            <div className="p-3 rounded-lg border bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">Live Quote</div>
                <Badge variant="outline" className="text-xs">
                  {loadingQuote ? "Loading…" : (quote?.timestamp ? new Date(quote.timestamp).toLocaleTimeString() : "—")}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                <div><span className="text-gray-500">Bid: </span><span className="font-medium">${fmt2(quote?.bid)}</span></div>
                <div><span className="text-gray-500">Ask: </span><span className="font-medium">${fmt2(quote?.ask)}</span></div>
                <div><span className="text-gray-500">Last: </span><span className="font-medium">${fmt2(quote?.last ?? selectedAsset?.price)}</span></div>
              </div>
            </div>
          </div>

          {/* Auto-mint status */}
          <div className="p-3 rounded-lg border mb-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">Auto-mint status</div>
              <Badge variant={
                mintStatus === "success" ? "default" :
                mintStatus === "error"   ? "outline" :
                "outline"
              }>
                {loadingMint
                  ? "Minting…"
                  : mintStatus === "success" ? "Minted"
                  : mintStatus === "error"   ? "Error"
                  : "Idle"}
              </Badge>
            </div>
          </div>

          {/* Amount + preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Amount</label>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${!isUsingFiat ? "text-gray-900" : "text-gray-500"}`}>Tokens</span>
                <Switch checked={isUsingFiat} onCheckedChange={setIsUsingFiat} />
                <span className={`text-xs ${isUsingFiat ? "text-gray-900" : "text-gray-500"}`}>Fiat</span>
              </div>
            </div>

            <div className="relative">
              <Input
                type="number"
                placeholder="0.0"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                className="text-right text-lg h-12 pr-16"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                {isUsingFiat ? "USD" : (selectedAsset?.ticker || "TOKEN")}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Expected {isUsingFiat ? "Tokens" : "Cost"}</span>
                <span className="font-medium">
                  {isUsingFiat
                    ? `${calculateExpectedTokens()} ${selectedAsset?.ticker ?? "TOKEN"}`
                    : (terms ? `$${fmt2(terms.notionalUSD)}` : "$0.00")}
                </span>
              </div>
              {terms && (
                <div className="text-xs text-gray-500 mt-1">
                  Using limit ${fmt2(terms.limitPrice)} (2% buffer) • Min: $1.00
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Button
                className="w-full h-12 text-base"
                disabled={disableOrderBtn}
                onClick={handlePlaceOrder}
              >
                {placingOrder ? "Placing…" : (selectedAsset ? `Mint ${selectedAsset.ticker}` : "Mint Tokens")}
              </Button>
              <div className="text-xs text-gray-500 text-center">
                Uses your Dinari custodial account balance (faucet USDC minted on mount).
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Right Column - Portfolio, Balances, Positions, Orders */}
      <div className="w-80 space-y-4">
        {/* Portfolio summary */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Portfolio</h3>
            <Badge variant="outline" className="text-xs">
              {loadingPortfolio ? "Loading…" : (portfolio?.updatedAt ? new Date(portfolio.updatedAt).toLocaleTimeString() : "—")}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
            <div>
              <div className="text-gray-500">Total</div>
              <div className="font-semibold">${fmt2(portfolio?.totalValue)}</div>
            </div>
            <div>
              <div className="text-gray-500">Cash</div>
              <div className="font-semibold">${fmt2(portfolio?.cashValue)}</div>
            </div>
            <div>
              <div className="text-gray-500">Positions</div>
              <div className="font-semibold">${fmt2(portfolio?.positionsValue)}</div>
            </div>
          </div>
          <div className="mt-3">
            <Button
              variant="outline"
              className="w-full"
              size="sm"
              onClick={() => Promise.all([refreshPortfolio(), refreshBalances(), refreshPositions(), refreshOrders()])}
              disabled={loadingPortfolio || loadingBalances || loadingOrders || loadingPositions}
            >
              {(loadingPortfolio || loadingBalances || loadingOrders || loadingPositions) ? "Refreshing…" : "Refresh All"}
            </Button>
          </div>
        </Card>

        <Accordion type="multiple" defaultValue={["balances", "positions", "orders"]}>
          {/* Balances */}
          <AccordionItem value="balances">
            <Card className="p-0 overflow-hidden">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center justify-between w-full">
                  <h3 className="font-medium text-gray-900">Cash Balances</h3>
                  <span className="text-xs text-gray-500">
                    {loadingBalances
                      ? "Loading…"
                      : (cashBalances ? `${cashBalances.length} currency${cashBalances.length === 1 ? "" : "ies"}` : "–")}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-0">
                {loadingBalances && <div className="text-sm text-gray-500 mt-2">Loading balances…</div>}
                {!loadingBalances && (cashBalances?.length ?? 0) === 0 && (
                  <div className="text-sm text-gray-500 mt-2">No balances yet.</div>
                )}
                {!loadingBalances && cashBalances && cashBalances.length > 0 && (
                  <div className="space-y-3 mt-2">
                    {cashBalances.map((b, i) => (
                      <div key={`${b.currency}-${i}`} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium">
                            {b.currency.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{fmt4(b.available)} {b.currency}</div>
                            <div className="text-xs text-gray-500">
                              {b.total !== undefined ? `Total: ${fmt4(b.total)}` : ""}
                              {b.pending !== undefined ? ` • Pending: ${fmt4(b.pending)}` : ""}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {b.updatedAt ? new Date(b.updatedAt).toLocaleString() : "Updated"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  size="sm"
                  onClick={refreshBalances}
                  disabled={loadingBalances}
                >
                  {loadingBalances ? "Refreshing…" : "Refresh Balances"}
                </Button>
              </AccordionContent>
            </Card>
          </AccordionItem>

          {/* Positions (holdings) */}
          <AccordionItem value="positions">
            <Card className="p-0 overflow-hidden">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center justify-between w-full">
                  <h3 className="font-medium text-gray-900">Holdings</h3>
                  <span className="text-xs text-gray-500">
                    {loadingPositions ? "Loading…" : (positions ? `${positions.length}` : "–")}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-0">
                {loadingPositions && <div className="text-sm text-gray-500 mt-2">Loading positions…</div>}
                {!loadingPositions && (positions?.length ?? 0) === 0 && (
                  <div className="text-sm text-gray-500 mt-2">No holdings yet.</div>
                )}
                {!loadingPositions && positions && positions.length > 0 && (
                  <div className="space-y-3 mt-2">
                    {positions.map((p, idx) => {
                      const meta = stockIdIndex[p.stockId] || { ticker: p.stockId?.slice(0, 6) || "—", name: "Unknown", icon: "📈" };
                      return (
                        <div key={`${p.stockId}-${idx}`} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm">
                              {meta.icon}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{meta.ticker}</div>
                              <div className="text-xs text-gray-500">{meta.name}</div>
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="font-medium">{fmt4(p.quantity)} {meta.ticker}</div>
                            <div className="text-xs text-gray-500">
                              {p.marketValue !== undefined ? `≈ $${fmt2(p.marketValue)}` : ""}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  size="sm"
                  onClick={refreshPositions}
                  disabled={loadingPositions}
                >
                  {loadingPositions ? "Refreshing…" : "Refresh Holdings"}
                </Button>
              </AccordionContent>
            </Card>
          </AccordionItem>

          {/* Orders */}
          <AccordionItem value="orders">
            <Card className="p-0 overflow-hidden">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center justify-between w-full">
                  <h3 className="font-medium text-gray-900">Orders</h3>
                  <span className="text-xs text-gray-500">
                    {loadingOrders
                      ? "Loading…"
                      : (orders ? `${orders.length} item${orders.length === 1 ? "" : "s"}` : "–")}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-0">
                {loadingOrders && <div className="text-sm text-gray-500 mt-2">Loading orders…</div>}
                {!loadingOrders && (orders?.length ?? 0) === 0 && (
                  <div className="text-sm text-gray-500 mt-2">No orders yet.</div>
                )}
                {!loadingOrders && orders && orders.length > 0 && (
                  <div className="space-y-3 mt-2">
                    {orders.map((o) => {
                      // Map stock_id (arriving in "symbol") -> readable ticker/name/icon
                      const meta = stockIdIndex[o.symbol];
                      const displayTicker = meta?.ticker || (o.symbol ? o.symbol.toUpperCase() : "—");
                      const displayName   = meta?.name   || (o.symbol || "Unknown");
                      const avatar        = meta?.icon   || displayTicker.slice(0, 2).toUpperCase();

                      // Quantity fallback if backend used a different field
                      const qty =
                        (typeof o.quantity === "number" && o.quantity > 0)
                          ? fmt4(o.quantity)
                          // @ts-expect-error tolerate unknown backend fields for display
                          : (o.asset_quantity ? fmt4(o.asset_quantity) : "0.0000");

                      return (
                        <div key={o.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm">
                              {avatar}
                            </div>
                            <div>
                              <div className="font-medium text-sm">
                                {o.side?.toUpperCase()} {qty} {displayTicker}
                              </div>
                              <div className="text-xs text-gray-500">{displayName}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500 mb-1">
                              {o.createdAt ? new Date(o.createdAt).toLocaleString() : "-"}
                            </div>
                            <Badge
                              variant={o.status === "filled" || o.status === "completed" ? "default" : "outline"}
                              className="text-xs"
                            >
                              {o.status}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="w-1/2" size="sm" onClick={refreshOrders} disabled={loadingOrders}>
                    {loadingOrders ? "Refreshing…" : "Refresh Orders"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-1/2"
                    size="sm"
                    onClick={() => Promise.all([refreshPortfolio(), refreshBalances(), refreshPositions(), refreshOrders()])}
                    disabled={loadingPortfolio || loadingBalances || loadingOrders || loadingPositions}
                  >
                    {(loadingPortfolio || loadingBalances || loadingOrders || loadingPositions) ? "Refreshing…" : "Refresh All"}
                  </Button>
                </div>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
