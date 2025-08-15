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
import { 
  CalendarDays,
  Search,
  ChevronDown,
  ArrowUpDown,
  Banknote,
  TrendingUp,
  Coins,
  Copy,
  ExternalLink,
  MoreHorizontal
} from "lucide-react";

export default function Activity() {
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("7d");

  const filterOptions = [
    { id: "all", label: "All", count: 45 },
    { id: "mint-swap", label: "Mint/Swap", count: 12 },
    { id: "borrow-lend", label: "Borrow/Lend", count: 8 },
    { id: "perps", label: "Perps", count: 15 },
    { id: "yield", label: "Yield", count: 10 },
  ];

  const activityItems = [
    {
      id: "1",
      type: "swap",
      icon: ArrowUpDown,
      iconColor: "bg-blue-100 text-blue-600",
      primaryLabel: "Swapped 2.5 ETH for 450 bAAPL",
      subLabel: "Rate: 1 ETH = 180 bAAPL",
      timestamp: "2 minutes ago",
      status: "Success",
      statusColor: "bg-green-100 text-green-800",
      txHash: "0x1234...5678",
    },
    {
      id: "2", 
      type: "borrow",
      icon: Banknote,
      iconColor: "bg-orange-100 text-orange-600",
      primaryLabel: "Borrowed 1,200 USDC",
      subLabel: "Health Factor 1.35",
      timestamp: "15 minutes ago",
      status: "Success",
      statusColor: "bg-green-100 text-green-800",
      txHash: "0x2345...6789",
    },
    {
      id: "3",
      type: "perps",
      icon: TrendingUp,
      iconColor: "bg-purple-100 text-purple-600",
      primaryLabel: "Opened Long ETH-PERP",
      subLabel: "Size: 5 ETH, Leverage: 3x",
      timestamp: "1 hour ago", 
      status: "Pending",
      statusColor: "bg-yellow-100 text-yellow-800",
      txHash: "0x3456...7890",
    },
    {
      id: "4",
      type: "yield",
      icon: Coins,
      iconColor: "bg-green-100 text-green-600",
      primaryLabel: "Bought bAAPL Yield Tokens",
      subLabel: "Amount: 100 YT, Maturity: Dec 2024",
      timestamp: "2 hours ago",
      status: "Success",
      statusColor: "bg-green-100 text-green-800",
      txHash: "0x4567...8901",
    },
    {
      id: "5",
      type: "supply",
      icon: Banknote,
      iconColor: "bg-blue-100 text-blue-600",
      primaryLabel: "Supplied 5,000 USDC",
      subLabel: "APY: 4.8%",
      timestamp: "3 hours ago",
      status: "Success", 
      statusColor: "bg-green-100 text-green-800",
      txHash: "0x5678...9012",
    },
    {
      id: "6",
      type: "swap",
      icon: ArrowUpDown,
      iconColor: "bg-blue-100 text-blue-600",
      primaryLabel: "Swap Failed - Slippage too high",
      subLabel: "Attempted: 1 ETH → bTSLA",
      timestamp: "5 hours ago",
      status: "Reverted",
      statusColor: "bg-red-100 text-red-800",
      txHash: "0x6789...0123",
    },
    {
      id: "7",
      type: "perps",
      icon: TrendingUp,
      iconColor: "bg-purple-100 text-purple-600",
      primaryLabel: "Closed Short BTC-PERP",
      subLabel: "P&L: +$245.50 (+2.1%)",
      timestamp: "1 day ago",
      status: "Success",
      statusColor: "bg-green-100 text-green-800", 
      txHash: "0x7890...1234",
    },
    {
      id: "8",
      type: "yield",
      icon: Coins,
      iconColor: "bg-green-100 text-green-600",
      primaryLabel: "Redeemed PT Tokens",
      subLabel: "Asset: bTSLA, Amount: 50 PT",
      timestamp: "2 days ago",
      status: "Success",
      statusColor: "bg-green-100 text-green-800",
      txHash: "0x8901...2345",
    },
  ];

  const filteredItems = activityItems.filter(item => {
    const matchesFilter = selectedFilter === "all" || 
      (selectedFilter === "mint-swap" && item.type === "swap") ||
      (selectedFilter === "borrow-lend" && (item.type === "borrow" || item.type === "supply")) ||
      (selectedFilter === "perps" && item.type === "perps") ||
      (selectedFilter === "yield" && item.type === "yield");
    
    const matchesSearch = !searchTerm || 
      item.primaryLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.txHash.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Sticky Sub-header */}
      <div className="sticky top-0 bg-gray-50 -mx-6 px-6 py-4 border-b border-gray-200 z-10">
        <div className="flex items-center justify-between gap-6">
          {/* Date Range Picker */}
          <div className="flex items-center gap-2 w-60">
            <CalendarDays className="w-4 h-4 text-gray-400" />
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-1 justify-center">
            {filterOptions.map((filter) => (
              <Button
                key={filter.id}
                variant={selectedFilter === filter.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter(filter.id)}
                className="flex items-center gap-1"
              >
                {filter.label}
                {selectedFilter === filter.id ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <span className="bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full ml-1">
                    {filter.count}
                  </span>
                )}
              </Button>
            ))}
          </div>

          {/* Search Field */}
          <div className="relative w-65">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Tx hash or asset"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Timeline List */}
      <div className="space-y-6">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <Card key={item.id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${item.iconColor}`}>
                  <item.icon className="w-6 h-6" />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">
                    {item.primaryLabel}
                  </div>
                  <div className="text-sm text-gray-600">
                    {item.subLabel}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">Tx: {item.txHash}</span>
                    <Button variant="ghost" size="sm" className="p-1 h-auto">
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="p-1 h-auto">
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Right Side */}
                <div className="text-right space-y-2">
                  <div className="text-sm text-gray-500">
                    {item.timestamp}
                  </div>
                  <Badge className={item.statusColor}>
                    {item.status}
                  </Badge>
                  <div>
                    <Button variant="ghost" size="sm" className="p-1">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No activity found</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              {searchTerm 
                ? `No transactions found matching "${searchTerm}"`
                : `No ${selectedFilter === "all" ? "" : filterOptions.find(f => f.id === selectedFilter)?.label.toLowerCase() + " "}activity in the selected time range`
              }
            </p>
          </Card>
        )}

        {/* Infinite Scroll Placeholder */}
        {filteredItems.length > 0 && (
          <div className="text-center py-8">
            <Button variant="outline" className="w-full max-w-sm">
              Load More Activity
            </Button>
            <p className="text-sm text-gray-500 mt-2">
              Showing {filteredItems.length} of {activityItems.length} transactions
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
