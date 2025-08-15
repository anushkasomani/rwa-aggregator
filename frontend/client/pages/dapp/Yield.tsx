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
import { ArrowUpDown, Clock, DollarSign, TrendingUp, Calendar } from "lucide-react";

export default function Yield() {
  const [selectedAction, setSelectedAction] = useState("buy-yield");
  const [fromAmount, setFromAmount] = useState("");
  const [selectedMarket, setSelectedMarket] = useState("bAAPL-DEC24");

  const yieldMarkets = [
    {
      underlying: "bAAPL",
      name: "Apple Inc. Token",
      icon: "🍎",
      variableAPY: "4.2%",
      ptPrice: "$172.45",
      ytPrice: "$6.00",
      maturity: "Dec 2024",
      tvl: "$12.5M",
      daysToMaturity: 95,
    },
    {
      underlying: "bTSLA", 
      name: "Tesla Inc. Token",
      icon: "⚡",
      variableAPY: "6.8%",
      ptPrice: "$225.30",
      ytPrice: "$14.20",
      maturity: "Mar 2025",
      tvl: "$8.7M",
      daysToMaturity: 180,
    },
    {
      underlying: "bGOOGL",
      name: "Alphabet Inc. Token", 
      icon: "🔍",
      variableAPY: "3.1%",
      ptPrice: "$121.20",
      ytPrice: "$4.60",
      maturity: "Jun 2025",
      tvl: "$15.2M",
      daysToMaturity: 275,
    },
    {
      underlying: "ETH",
      name: "Ethereum",
      icon: "⚪",
      variableAPY: "3.8%",
      ptPrice: "$2,310.50",
      ytPrice: "$74.70",
      maturity: "Dec 2024",
      tvl: "$45.8M",
      daysToMaturity: 95,
    },
  ];

  const currentMarket = yieldMarkets.find(m => `${m.underlying}-${m.maturity.replace(' ', '').toUpperCase()}` === selectedMarket);

  const getYieldAPY = () => {
    if (!currentMarket || !fromAmount) return "0.00%";
    // Mock calculation - in real app would use actual yield calculations
    const baseYield = parseFloat(currentMarket.variableAPY);
    const multiplier = selectedAction === "buy-yield" ? 1.2 : 0.8;
    return (baseYield * multiplier).toFixed(2) + "%";
  };

  const calculateOutputAmount = () => {
    if (!fromAmount || !currentMarket) return "0.0";
    const input = parseFloat(fromAmount);
    
    switch(selectedAction) {
      case "buy-yield":
        return (input / parseFloat(currentMarket.ytPrice)).toFixed(4);
      case "sell-yield":
        return (input * parseFloat(currentMarket.ytPrice)).toFixed(2);
      case "redeem-pt":
        return input.toFixed(4);
      default:
        return "0.0";
    }
  };

  const getActionLabel = () => {
    switch(selectedAction) {
      case "buy-yield": return "Buy Yield Tokens (YT)";
      case "sell-yield": return "Sell Yield";
      case "redeem-pt": return "Redeem Principal Tokens (PT)";
      default: return "";
    }
  };

  return (
    <div className="flex gap-6 h-full">
      {/* AMM Swap Widget */}
      <div className="flex-1 flex justify-center">
        <Card className="w-full max-w-md h-fit">
          <div className="p-6">
            {/* Switch Bar */}
            <Tabs value={selectedAction} onValueChange={setSelectedAction} className="mb-6">
              <TabsList className="grid w-full grid-cols-3 text-xs">
                <TabsTrigger value="buy-yield">Buy Yield</TabsTrigger>
                <TabsTrigger value="sell-yield">Sell Yield</TabsTrigger>
                <TabsTrigger value="redeem-pt">Redeem PT</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-4">
              {/* Market Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Market</label>
                <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yieldMarkets.map((market) => (
                      <SelectItem 
                        key={`${market.underlying}-${market.maturity.replace(' ', '').toUpperCase()}`} 
                        value={`${market.underlying}-${market.maturity.replace(' ', '').toUpperCase()}`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{market.icon}</span>
                          <span>{market.underlying} - {market.maturity}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* From Token */}
              <div className="space-y-2">
                <label className="text-sm text-gray-600">
                  {selectedAction === "buy-yield" ? "Pay with" : selectedAction === "sell-yield" ? "Sell" : "Redeem"}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    className="text-right text-lg h-12"
                  />
                  <div className="w-24 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-medium">
                    {selectedAction === "buy-yield" ? currentMarket?.underlying : 
                     selectedAction === "sell-yield" ? `${currentMarket?.underlying}-YT` :
                     `${currentMarket?.underlying}-PT`}
                  </div>
                </div>
              </div>

              {/* To Token */}
              <div className="space-y-2">
                <label className="text-sm text-gray-600">
                  {selectedAction === "buy-yield" ? "Receive" : selectedAction === "sell-yield" ? "Receive" : "Receive"}
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="0.0"
                    value={calculateOutputAmount()}
                    readOnly
                    className="text-right text-lg h-12 bg-gray-50"
                  />
                  <div className="w-24 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-medium">
                    {selectedAction === "buy-yield" ? `${currentMarket?.underlying}-YT` :
                     selectedAction === "sell-yield" ? currentMarket?.underlying :
                     currentMarket?.underlying}
                  </div>
                </div>
              </div>

              {/* Yield Information */}
              {currentMarket && (
                <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
                    <TrendingUp className="w-4 h-4" />
                    Yield Information
                  </div>
                  
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Variable APY</span>
                      <span className="font-medium text-blue-900">{currentMarket.variableAPY}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Expected Yield APY</span>
                      <span className="font-medium text-blue-900">{getYieldAPY()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Days to Maturity</span>
                      <span className="font-medium text-blue-900">{currentMarket.daysToMaturity} days</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <Button 
                className="w-full h-12 text-base"
                disabled={!fromAmount || !parseFloat(fromAmount)}
              >
                {!fromAmount || !parseFloat(fromAmount) ? "Enter an amount" : getActionLabel()}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Market List Table */}
      <div className="flex-1">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Yield Markets</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200">
                <tr className="text-left">
                  <th className="pb-3 text-sm font-medium text-gray-600">Underlying</th>
                  <th className="pb-3 text-sm font-medium text-gray-600">Variable APY</th>
                  <th className="pb-3 text-sm font-medium text-gray-600">PT Price</th>
                  <th className="pb-3 text-sm font-medium text-gray-600">YT Price</th>
                  <th className="pb-3 text-sm font-medium text-gray-600">Maturity</th>
                  <th className="pb-3 text-sm font-medium text-gray-600">TVL</th>
                  <th className="pb-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {yieldMarkets.map((market, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{market.icon}</span>
                        <div>
                          <div className="font-medium text-gray-900">{market.underlying}</div>
                          <div className="text-sm text-gray-500">{market.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <Badge className="bg-green-100 text-green-800">
                        {market.variableAPY}
                      </Badge>
                    </td>
                    <td className="py-4 font-medium text-gray-900">{market.ptPrice}</td>
                    <td className="py-4 font-medium text-gray-900">{market.ytPrice}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{market.maturity}</span>
                      </div>
                      <div className="text-xs text-gray-500">{market.daysToMaturity} days</div>
                    </td>
                    <td className="py-4 font-medium text-gray-900">{market.tvl}</td>
                    <td className="py-4">
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setSelectedMarket(`${market.underlying}-${market.maturity.replace(' ', '').toUpperCase()}`)}
                        >
                          Trade
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Your Yield Positions */}
        <Card className="p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Yield Positions</h3>
          
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <div className="font-medium mb-2">No yield positions yet</div>
            <div className="text-sm">Buy yield tokens to start earning fixed yield</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
