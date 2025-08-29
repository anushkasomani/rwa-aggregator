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
  ArrowUpDown, 
  Settings,
  TrendingUp, 
  TrendingDown,
  ArrowRight,
  ExternalLink,
  Clock,
  AlertCircle
} from "lucide-react";

export default function Swap() {
  const [fromToken, setFromToken] = useState("ETH");
  const [toToken, setToToken] = useState("bAAPL");
  const [fromAmount, setFromAmount] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [showSlippageModal, setShowSlippageModal] = useState(false);

  const tokens = [
    { symbol: "ETH", name: "Ethereum", balance: "2.45", price: "$2,385.20" },
    { symbol: "USDC", name: "USD Coin", balance: "1,245.60", price: "$1.00" },
    { symbol: "USDT", name: "Tether USD", balance: "890.30", price: "$1.00" },
    { symbol: "DAI", name: "Dai Stablecoin", balance: "456.78", price: "$1.00" },
  ];

  const rwAssets = [
    { symbol: "bAAPL", name: "Apple Inc.", balance: "0.00", price: "$178.45" },
    { symbol: "bTSLA", name: "Tesla Inc.", balance: "0.00", price: "$239.50" },
    { symbol: "bGOOGL", name: "Alphabet Inc.", balance: "0.00", price: "$125.80" },
    { symbol: "bAMZN", name: "Amazon.com Inc.", balance: "0.00", price: "$142.30" },
    { symbol: "bBOND", name: "US Treasury Bond", balance: "0.00", price: "$98.75" },
  ];

  const allTokens = [...tokens, ...rwAssets];

  const marketAssets = [
    {
      symbol: "bAAPL",
      name: "Apple Inc.",
      icon: "🍎",
      price: "$178.45",
      change: "+2.34%",
      isPositive: true,
    },
    {
      symbol: "bTSLA",
      name: "Tesla Inc.",
      icon: "⚡",
      price: "$239.50",
      change: "-1.12%",
      isPositive: false,
    },
    {
      symbol: "bGOOGL",
      name: "Alphabet Inc.",
      icon: "🔍",
      price: "$125.80",
      change: "+0.89%",
      isPositive: true,
    },
    {
      symbol: "bAMZN",
      name: "Amazon.com Inc.",
      icon: "📦",
      price: "$142.30",
      change: "+1.56%",
      isPositive: true,
    },
  ];

  const recentSwaps = [
    {
      id: 1,
      from: "ETH",
      to: "bAAPL",
      fromAmount: "2.5",
      toAmount: "34.7",
      timestamp: "2 min ago",
      status: "Success",
    },
    {
      id: 2,
      from: "USDC",
      to: "bTSLA",
      fromAmount: "1,200",
      toAmount: "5.0",
      timestamp: "15 min ago",
      status: "Success",
    },
    {
      id: 3,
      from: "ETH",
      to: "bGOOGL",
      fromAmount: "1.0",
      toAmount: "18.9",
      timestamp: "1 hour ago",
      status: "Failed",
    },
  ];

  const route = {
    path: ["Uniswap V3", "1inch", "RWA Bridge"],
    totalFees: "$4.25",
    gasFee: "$2.50",
    protocolFee: "$1.75",
    priceImpact: "0.12%",
    expectedOutput: "34.72 bAAPL",
    minimumReceived: "34.68 bAAPL",
  };

  const swapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  const calculateToAmount = () => {
    if (!fromAmount || !parseFloat(fromAmount)) return "0.0";
    const rate = fromToken === "ETH" ? 13.89 : 1.0;
    return (parseFloat(fromAmount) * rate).toFixed(4);
  };

  const getPriceImpact = () => {
    if (!fromAmount || parseFloat(fromAmount) < 1) return "< 0.01%";
    return route.priceImpact;
  };

  const SlippageModal = () => {
    if (!showSlippageModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-96 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Slippage Settings</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowSlippageModal(false)}>
              ×
            </Button>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[0.1, 0.5, 1.0].map((value) => (
                <Button
                  key={value}
                  variant={slippage === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSlippage(value)}
                >
                  {value}%
                </Button>
              ))}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Custom</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(parseFloat(e.target.value) || 0.5)}
                  className="flex-1"
                  step={0.1}
                  min={0.1}
                  max={50}
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </div>
            
            <Button onClick={() => setShowSlippageModal(false)} className="w-full">
              Save
            </Button>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Left Side - Markets List */}
      <div className="w-80 space-y-4">
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-4">Markets</h3>
          <div className="space-y-2">
            {marketAssets.map((asset, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-200"
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
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Center - Swap Widget */}
      <div className="flex-1 flex justify-center">
        <Card className="w-full max-w-md h-fit">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Swap</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-2"
                onClick={() => setShowSlippageModal(true)}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* From Token */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>From</span>
                  <span>Balance: {allTokens.find(t => t.symbol === fromToken)?.balance || "0.00"}</span>
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
                      {allTokens.map((token) => (
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
                  <span>Balance: {allTokens.find(t => t.symbol === toToken)?.balance || "0.00"}</span>
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
                      {allTokens.map((token) => (
                        <SelectItem key={token.symbol} value={token.symbol}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-rwa-blue-100 rounded-full flex items-center justify-center text-xs">
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

              {/* Route Preview */}
              {fromAmount && parseFloat(fromAmount) > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Route</span>
                    <div className="flex items-center gap-1">
                      {route.path.map((step, index) => (
                        <div key={index} className="flex items-center">
                          <span className="text-xs bg-white px-2 py-1 rounded">{step}</span>
                          {index < route.path.length - 1 && <ArrowRight className="w-3 h-3 mx-1 text-gray-400" />}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Price Impact</span>
                    <span className={`${parseFloat(getPriceImpact()) > 1 ? 'text-red-600' : 'text-green-600'}`}>
                      {getPriceImpact()}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Minimum Received</span>
                    <span>{route.minimumReceived}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Slippage Tolerance</span>
                    <span>{slippage}%</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button 
                  className="w-full h-12 text-base"
                  disabled={!fromAmount || !parseFloat(fromAmount)}
                >
                  {!fromAmount || !parseFloat(fromAmount) ? "Enter an amount" : "Review Swap"}
                </Button>
                
                {fromAmount && parseFloat(fromAmount) > 0 && (
                  <Button variant="outline" className="w-full">
                    Confirm Swap
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Right Side - Quotes & Route Panel + Recent Swaps */}
      <div className="w-80 space-y-4">
        {/* Quotes & Route Panel */}
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-4">Best Route</h3>
          
          {fromAmount && parseFloat(fromAmount) > 0 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Expected Output</span>
                  <span className="font-medium">{route.expectedOutput}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Gas Fee</span>
                  <span>{route.gasFee}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Protocol Fee</span>
                  <span>{route.protocolFee}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>Total Fees</span>
                  <span>{route.totalFees}</span>
                </div>
              </div>
              
              <div className="border-t pt-3">
                <div className="text-xs text-gray-500 mb-2">Route Path</div>
                <div className="flex items-center gap-1">
                  {route.path.map((step, index) => (
                    <div key={index} className="flex items-center">
                      <Badge variant="outline" className="text-xs">{step}</Badge>
                      {index < route.path.length - 1 && <ArrowRight className="w-3 h-3 mx-1 text-gray-400" />}
                    </div>
                  ))}
                </div>
              </div>
              
              {parseFloat(getPriceImpact()) > 1 && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  High price impact warning
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-sm">Enter an amount to see the best route</div>
            </div>
          )}
        </Card>

        {/* Recent Swaps */}
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-4">Recent Swaps</h3>
          
          <div className="space-y-2">
            {recentSwaps.map((swap) => (
              <div key={swap.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">{swap.fromAmount} {swap.from}</span>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    <span className="text-sm font-medium">{swap.toAmount} {swap.to}</span>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {swap.timestamp}
                  </div>
                  <Badge 
                    variant={swap.status === "Success" ? "default" : "destructive"} 
                    className="text-xs"
                  >
                    {swap.status}
                  </Badge>
                </div>
                
                <Button variant="ghost" size="sm" className="p-1">
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
          
          <Button variant="outline" className="w-full mt-4" size="sm">
            View All Swaps
          </Button>
        </Card>
      </div>

      {/* Slippage Modal */}
      <SlippageModal />
    </div>
  );
}
