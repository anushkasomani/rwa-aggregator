import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BasketCard } from "@/components/baskets/BasketCard";
import { BasketDetailsDrawer } from "@/components/baskets/BasketDetailsDrawer";
import { CreateBasketModal } from "@/components/baskets/CreateBasketModal";
import { 
  ArrowUpDown, 
  Settings,
  TrendingUp, 
  TrendingDown,
  Search,
  Star,
  Plus,
  Filter
} from "lucide-react";

export default function Market() {
  const [fromToken, setFromToken] = useState("ETH");
  const [toToken, setToToken] = useState("bAAPL");
  const [fromAmount, setFromAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5%");
  
  // Basket states
  const [basketFilter, setBasketFilter] = useState("trending");
  const [basketSort, setBasketSort] = useState("1y-return");
  const [basketSearch, setBasketSearch] = useState("");
  const [comparedBaskets, setComparedBaskets] = useState<string[]>([]);
  const [selectedBasketId, setSelectedBasketId] = useState<string | null>(null);
  const [showBasketDetails, setShowBasketDetails] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const tokens = [
    { symbol: "ETH", name: "Ethereum", balance: "2.45" },
    { symbol: "USDC", name: "USD Coin", balance: "1,245.60" },
    { symbol: "USDT", name: "Tether USD", balance: "890.30" },
    { symbol: "DAI", name: "Dai Stablecoin", balance: "456.78" },
  ];

  const rwAssets = [
    { symbol: "bAAPL", name: "Apple Inc.", balance: "0.00" },
    { symbol: "bTSLA", name: "Tesla Inc.", balance: "0.00" },
    { symbol: "bGOOGL", name: "Alphabet Inc.", balance: "0.00" },
    { symbol: "bAMZN", name: "Amazon.com Inc.", balance: "0.00" },
    { symbol: "bBOND", name: "US Treasury Bond", balance: "0.00" },
  ];

  const marketAssets = [
    {
      symbol: "bAAPL",
      name: "Apple Inc.",
      icon: "🍎",
      price: "$178.45",
      change: "+2.34%",
      isPositive: true,
      marketCap: "$2.8T",
      volume24h: "$45.2M",
      favorite: false,
    },
    {
      symbol: "bTSLA",
      name: "Tesla Inc.",
      icon: "⚡",
      price: "$239.50",
      change: "-1.12%",
      isPositive: false,
      marketCap: "$760B",
      volume24h: "$23.7M",
      favorite: true,
    },
    {
      symbol: "bGOOGL",
      name: "Alphabet Inc.",
      icon: "🔍",
      price: "$125.80",
      change: "+0.89%",
      isPositive: true,
      marketCap: "$1.6T",
      volume24h: "$18.9M",
      favorite: false,
    },
    {
      symbol: "bAMZN",
      name: "Amazon.com Inc.",
      icon: "📦",
      price: "$142.30",
      change: "+1.56%",
      isPositive: true,
      marketCap: "$1.5T",
      volume24h: "$31.4M",
      favorite: false,
    },
    {
      symbol: "bBOND",
      name: "US Treasury Bond",
      icon: "🏦",
      price: "$98.75",
      change: "+0.12%",
      isPositive: true,
      marketCap: "$50T",
      volume24h: "$12.1M",
      favorite: false,
    },
  ];

  const baskets = [
    {
      id: "us-tech-bluechip",
      name: "US Tech Bluechip",
      subtitle: "Mega-cap equities exposure",
      tags: ["Equity", "Monthly Rebalance", "KYC Required"],
      oneYearReturn: "+12.4%",
      threeYearCAGR: "+8.9%",
      volatility: "13.2%",
      yield: "3.1%",
      minInvest: "200 USDC",
      isPositive: true,
      category: "trending"
    },
    {
      id: "dynamic-growth", 
      name: "Dynamic Growth",
      subtitle: "High-growth technology & innovation stocks",
      tags: ["Equity", "Weekly Rebalance", "High Risk"],
      oneYearReturn: "+18.7%",
      threeYearCAGR: "+15.2%",
      volatility: "22.1%",
      yield: "1.8%",
      minInvest: "500 USDC",
      isPositive: true,
      category: "high-growth"
    },
    {
      id: "income-tbills",
      name: "Income & T-Bills", 
      subtitle: "Conservative income-focused portfolio",
      tags: ["Treasury", "Fixed Income", "Low Risk"],
      oneYearReturn: "+4.2%",
      threeYearCAGR: "+3.8%",
      volatility: "2.1%",
      yield: "4.8%",
      minInvest: "100 USDC",
      isPositive: true,
      category: "conservative"
    },
    {
      id: "global-quality",
      name: "Global Quality",
      subtitle: "Diversified global blue-chip stocks",
      tags: ["Equity", "Global", "Monthly Rebalance"],
      oneYearReturn: "+9.1%",
      threeYearCAGR: "+7.3%",
      volatility: "11.8%",
      yield: "2.9%",
      minInvest: "300 USDC",
      isPositive: true,
      category: "trending"
    },
    {
      id: "rwa-balanced",
      name: "RWA Balanced",
      subtitle: "Mixed real-world asset exposure",
      tags: ["RWA-Only", "Balanced", "KYC Required"],
      oneYearReturn: "+6.8%",
      threeYearCAGR: "+5.9%",
      volatility: "8.4%",
      yield: "3.7%",
      minInvest: "250 USDC",
      isPositive: true,
      category: "thematic"
    },
    {
      id: "thematic-ai-chips",
      name: "Thematic AI+Chips",
      subtitle: "Artificial intelligence & semiconductor exposure",
      tags: ["Thematic", "AI/Tech", "High Volatility"],
      oneYearReturn: "+25.3%",
      threeYearCAGR: "+19.7%",
      volatility: "28.5%",
      yield: "1.2%",
      minInvest: "400 USDC",
      isPositive: true,
      category: "thematic"
    },
  ];

  const filterOptions = [
    { id: "trending", label: "Trending" },
    { id: "conservative", label: "Conservative" },
    { id: "high-growth", label: "High Growth" },
    { id: "income", label: "Income" },
    { id: "thematic", label: "Thematic" },
    { id: "rwa-only", label: "RWA-Only" },
  ];

  const sortOptions = [
    { id: "1y-return", label: "1Y Return" },
    { id: "3y-cagr", label: "3Y CAGR" },
    { id: "volatility", label: "Volatility" },
    { id: "yield", label: "Yield" },
    { id: "tvl", label: "TVL" },
  ];

  const filteredBaskets = baskets.filter(basket => {
    const matchesFilter = basketFilter === "trending" || basket.category === basketFilter;
    const matchesSearch = !basketSearch || 
      basket.name.toLowerCase().includes(basketSearch.toLowerCase()) ||
      basket.subtitle.toLowerCase().includes(basketSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const swapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  const calculateToAmount = () => {
    if (!fromAmount || !parseFloat(fromAmount)) return "0.0";
    const rate = fromToken === "ETH" ? 0.072 : 13.89;
    return (parseFloat(fromAmount) * rate).toFixed(6);
  };

  const handleCompareChange = (basketId: string, checked: boolean) => {
    if (checked && comparedBaskets.length < 3) {
      setComparedBaskets([...comparedBaskets, basketId]);
    } else if (!checked) {
      setComparedBaskets(comparedBaskets.filter(id => id !== basketId));
    }
  };

  const handleViewDetails = (basketId: string) => {
    setSelectedBasketId(basketId);
    setShowBasketDetails(true);
  };

  const handleInvest = (basketId: string) => {
    // Handle investment logic
    console.log("Invest in basket:", basketId);
  };

  return (
    <div className="space-y-12">
      {/* Existing Swap Section */}
      <div className="flex gap-6">
        {/* Main Swap Widget */}
        <div className="flex-1 flex justify-center">
          <Card className="w-full max-w-md h-fit">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Swap</h2>
                <Button variant="ghost" size="sm" className="p-2">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* From Token */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>From</span>
                    <span>Balance: {tokens.find(t => t.symbol === fromToken)?.balance || "0.00"}</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        type="number"
                        placeholder="0.0"
                        value={fromAmount}
                        onChange={(e) => setFromAmount(e.target.value)}
                        className="text-right text-lg h-12"
                      />
                    </div>
                    
                    <Select value={fromToken} onValueChange={setFromToken}>
                      <SelectTrigger className="w-32 h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tokens.map((token) => (
                          <SelectItem key={token.symbol} value={token.symbol}>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs">
                                {token.symbol.slice(0, 2)}
                              </div>
                              {token.symbol}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Swap Arrow */}
                <div className="flex justify-center">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={swapTokens}
                    className="rounded-full p-2"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </Button>
                </div>

                {/* To Token */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>To</span>
                    <span>Balance: {rwAssets.find(t => t.symbol === toToken)?.balance || "0.00"}</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="0.0"
                        value={calculateToAmount()}
                        readOnly
                        className="text-right text-lg h-12 bg-gray-50"
                      />
                    </div>
                    
                    <Select value={toToken} onValueChange={setToToken}>
                      <SelectTrigger className="w-32 h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {rwAssets.map((token) => (
                          <SelectItem key={token.symbol} value={token.symbol}>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-rwa-blue-100 rounded-full flex items-center justify-center text-xs">
                                {token.symbol.slice(1, 3)}
                              </div>
                              {token.symbol}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Swap Details */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Exchange Rate</span>
                    <span>1 ETH = 13.89 bAAPL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Slippage Tolerance</span>
                    <span>{slippage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Network Fee</span>
                    <span>~$2.50</span>
                  </div>
                </div>

                {/* Swap Button */}
                <Button 
                  className="w-full h-12 text-base"
                  disabled={!fromAmount || !parseFloat(fromAmount)}
                >
                  {!fromAmount || !parseFloat(fromAmount) ? "Enter an amount" : "Swap"}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Asset List Panel */}
        <div className="w-80 space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-4 h-4 text-gray-400" />
              <Input placeholder="Search assets..." className="border-0 p-0 focus-visible:ring-0" />
            </div>
            
            <div className="space-y-2">
              {marketAssets.map((asset, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer group"
                  onClick={() => setToToken(asset.symbol)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{asset.icon}</span>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{asset.symbol}</div>
                      <div className="text-xs text-gray-500">{asset.name}</div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-medium text-sm">{asset.price}</div>
                    <div className={`text-xs flex items-center gap-1 ${asset.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {asset.isPositive ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {asset.change}
                    </div>
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="opacity-0 group-hover:opacity-100 p-1"
                  >
                    <Star className={`w-4 h-4 ${asset.favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          {/* Market Stats */}
          <Card className="p-4">
            <h3 className="font-medium text-gray-900 mb-3">Market Stats</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Market Cap</span>
                <span className="font-medium">$8.2T</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">24h Volume</span>
                <span className="font-medium">$131.3M</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Active Assets</span>
                <span className="font-medium">247</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Top Gainer</span>
                <span className="font-medium text-green-600">bNVDA +5.2%</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Baskets Section */}
      <div className="space-y-6">
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Baskets</h2>
            <p className="text-sm text-gray-600 mt-1">
              Curated baskets of RWAs (equities, bonds, treasuries). Invest in a theme in one click.
            </p>
          </div>
          <Button 
            variant="ghost" 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Custom Basket
          </Button>
        </div>

        {/* Filters Row */}
        <div className="flex items-center justify-between gap-4">
          {/* Category Pills */}
          <div className="flex items-center gap-3">
            {filterOptions.map((filter) => (
              <Button
                key={filter.id}
                variant={basketFilter === filter.id ? "default" : "outline"}
                size="sm"
                onClick={() => setBasketFilter(filter.id)}
              >
                {filter.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {/* Sort Select */}
            <Select value={basketSort} onValueChange={setBasketSort}>
              <SelectTrigger className="w-50">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative w-65">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search baskets or themes"
                value={basketSearch}
                onChange={(e) => setBasketSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Basket Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBaskets.map((basket) => (
            <BasketCard
              key={basket.id}
              basket={basket}
              onViewDetails={handleViewDetails}
              onInvest={handleInvest}
              onCompareChange={handleCompareChange}
              isCompared={comparedBaskets.includes(basket.id)}
            />
          ))}
        </div>

        {filteredBaskets.length === 0 && (
          <Card className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Filter className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No baskets found</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              {basketSearch 
                ? `No baskets found matching "${basketSearch}"`
                : `No baskets found in the ${filterOptions.find(f => f.id === basketFilter)?.label.toLowerCase()} category`
              }
            </p>
          </Card>
        )}
      </div>

      {/* Sticky Compare Bar */}
      {comparedBaskets.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="font-medium text-gray-900">
                  Compare ({comparedBaskets.length}/3)
                </span>
                <div className="flex gap-2">
                  {comparedBaskets.map((basketId) => {
                    const basket = baskets.find(b => b.id === basketId);
                    return (
                      <Badge key={basketId} variant="outline" className="flex items-center gap-1">
                        {basket?.name}
                        <button 
                          onClick={() => handleCompareChange(basketId, false)}
                          className="ml-1 hover:text-red-600"
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <Button disabled={comparedBaskets.length < 2}>
                Compare Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Basket Details Drawer */}
      <BasketDetailsDrawer
        isOpen={showBasketDetails}
        onClose={() => setShowBasketDetails(false)}
        basketId={selectedBasketId}
      />

      {/* Create Basket Modal */}
      <CreateBasketModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
