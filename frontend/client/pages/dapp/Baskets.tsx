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
import { BasketCard } from "@/components/baskets/BasketCard";
import { BasketDetailsDrawer } from "@/components/baskets/BasketDetailsDrawer";
import { CreateBasketModal } from "@/components/baskets/CreateBasketModal";
import { 
  Plus,
  Search,
  Filter,
  TrendingUp,
  BarChart3
} from "lucide-react";

export default function Baskets() {
  const [basketFilter, setBasketFilter] = useState("trending");
  const [basketSort, setBasketSort] = useState("1y-return");
  const [basketSearch, setBasketSearch] = useState("");
  const [comparedBaskets, setComparedBaskets] = useState<string[]>([]);
  const [selectedBasketId, setSelectedBasketId] = useState<string | null>(null);
  const [showBasketDetails, setShowBasketDetails] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
    {
      id: "emerging-markets",
      name: "Emerging Markets",
      subtitle: "Diversified exposure to developing economies",
      tags: ["Global", "Emerging", "High Growth"],
      oneYearReturn: "+14.2%",
      threeYearCAGR: "+11.5%",
      volatility: "18.9%",
      yield: "2.4%",
      minInvest: "300 USDC",
      isPositive: true,
      category: "high-growth"
    },
    {
      id: "dividend-aristocrats",
      name: "Dividend Aristocrats",
      subtitle: "Companies with 25+ years of dividend increases",
      tags: ["Income", "Dividend", "Conservative"],
      oneYearReturn: "+7.8%",
      threeYearCAGR: "+6.2%",
      volatility: "9.1%",
      yield: "3.9%",
      minInvest: "200 USDC",
      isPositive: true,
      category: "income"
    },
    {
      id: "crypto-miners",
      name: "Crypto Miners",
      subtitle: "Bitcoin mining and crypto infrastructure",
      tags: ["Thematic", "Crypto", "High Volatility"],
      oneYearReturn: "+45.6%",
      threeYearCAGR: "+22.3%",
      volatility: "35.2%",
      yield: "0.8%",
      minInvest: "500 USDC",
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

  const totalBaskets = baskets.length;
  const totalTVL = "$2.8B";
  const avgReturn = "+9.7%";
  const totalInvestors = "12.4K";

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Baskets</h1>
          <p className="text-lg text-gray-600 mt-2">
            Curated baskets of RWAs (equities, bonds, treasuries). Invest in a theme in one click.
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Custom Basket
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 text-center">
          <div className="text-2xl font-bold text-gray-900 mb-1">{totalBaskets}</div>
          <div className="text-sm text-gray-600">Available Baskets</div>
        </Card>
        <Card className="p-6 text-center">
          <div className="text-2xl font-bold text-gray-900 mb-1">{totalTVL}</div>
          <div className="text-sm text-gray-600">Total Value Locked</div>
        </Card>
        <Card className="p-6 text-center">
          <div className="text-2xl font-bold text-green-600 mb-1">{avgReturn}</div>
          <div className="text-sm text-gray-600">Average 1Y Return</div>
        </Card>
        <Card className="p-6 text-center">
          <div className="text-2xl font-bold text-gray-900 mb-1">{totalInvestors}</div>
          <div className="text-sm text-gray-600">Active Investors</div>
        </Card>
      </div>

      {/* Filters Row */}
      <Card className="p-6">
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
      </Card>

      {/* Featured Baskets */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-rwa-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Featured Baskets</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBaskets.slice(0, 3).map((basket) => (
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
      </div>

      {/* All Baskets */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              All Baskets ({filteredBaskets.length})
            </h2>
          </div>
          
          <div className="text-sm text-gray-500">
            Showing {filteredBaskets.length} of {totalBaskets} baskets
          </div>
        </div>

        {filteredBaskets.length > 0 ? (
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
        ) : (
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
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => {
                setBasketSearch("");
                setBasketFilter("trending");
              }}
            >
              Clear Filters
            </Button>
          </Card>
        )}
      </div>

      {/* How It Works */}
      <Card className="p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">How Baskets Work</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-rwa-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-lg font-bold text-rwa-blue-600">1</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Choose a Basket</h3>
            <p className="text-sm text-gray-600">
              Browse curated baskets or create your own custom allocation of tokenized assets.
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-rwa-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-lg font-bold text-rwa-blue-600">2</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Invest in One Click</h3>
            <p className="text-sm text-gray-600">
              Invest with a single transaction and get exposure to multiple assets automatically.
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-rwa-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-lg font-bold text-rwa-blue-600">3</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Earn & Rebalance</h3>
            <p className="text-sm text-gray-600">
              Earn yield from underlying assets while baskets automatically rebalance to maintain target allocations.
            </p>
          </div>
        </div>
      </Card>

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
