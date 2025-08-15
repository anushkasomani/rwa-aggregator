import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

export default function Perps() {
  const [selectedVenue, setSelectedVenue] = useState("synthetix");
  const [selectedPair, setSelectedPair] = useState("ETH-PERP");
  const [orderSize, setOrderSize] = useState("");
  const [leverage, setLeverage] = useState([1]);
  const [acceptablePrice, setAcceptablePrice] = useState("");

  const venues = [
    { id: "synthetix", name: "Synthetix", logo: "🔗" },
    { id: "hyperliquid", name: "Hyperliquid", logo: "💧" },
  ];

  const pairs = [
    { symbol: "ETH-PERP", name: "Ethereum Perpetual", price: "$2,385.20", change: "+1.8%", isPositive: true },
    { symbol: "BTC-PERP", name: "Bitcoin Perpetual", price: "$43,180.00", change: "-0.2%", isPositive: false },
    { symbol: "bAAPL-PERP", name: "Apple Perpetual", price: "$178.45", change: "+2.1%", isPositive: true },
    { symbol: "bTSLA-PERP", name: "Tesla Perpetual", price: "$239.50", change: "-1.5%", isPositive: false },
  ];

  const positions = [
    {
      pair: "ETH-PERP",
      side: "Long",
      size: "2.5 ETH",
      entryPrice: "$2,340.50",
      markPrice: "$2,385.20",
      pnl: "+$111.75",
      pnlPercent: "+1.91%",
      margin: "$584.13",
      liqPrice: "$1,872.40",
      isPositive: true,
    },
    {
      pair: "BTC-PERP",
      side: "Short", 
      size: "0.1 BTC",
      entryPrice: "$43,250.00",
      markPrice: "$43,180.00",
      pnl: "+$7.00",
      pnlPercent: "+0.16%",
      margin: "$1,081.25",
      liqPrice: "$51,900.00",
      isPositive: true,
    },
  ];

  const currentPair = pairs.find(p => p.symbol === selectedPair);
  const leverageValue = leverage[0];
  const marginRequired = orderSize ? (parseFloat(orderSize) / leverageValue).toFixed(2) : "0";

  return (
    <div className="flex gap-6 h-full">
      {/* Order Ticket */}
      <div className="w-80">
        <Card className="p-6 space-y-6">
          <div className="space-y-4">
            {/* Venue Toggle */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Trading Venue</label>
              <Tabs value={selectedVenue} onValueChange={setSelectedVenue} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  {venues.map((venue) => (
                    <TabsTrigger key={venue.id} value={venue.id} className="text-xs">
                      <span className="mr-1">{venue.logo}</span>
                      {venue.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/* Pair Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Trading Pair</label>
              <Select value={selectedPair} onValueChange={setSelectedPair}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pairs.map((pair) => (
                    <SelectItem key={pair.symbol} value={pair.symbol}>
                      <div className="flex items-center justify-between w-full">
                        <span>{pair.symbol}</span>
                        <span className={`text-xs ml-2 ${pair.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {pair.change}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {currentPair && (
                <div className="text-sm text-gray-600">
                  Mark Price: <span className="font-medium">{currentPair.price}</span>
                </div>
              )}
            </div>

            {/* Order Size */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Size (USDC)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={orderSize}
                onChange={(e) => setOrderSize(e.target.value)}
                className="text-right"
              />
            </div>

            {/* Leverage Slider */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-gray-700">Leverage</label>
                <span className="text-sm font-medium">{leverageValue}x</span>
              </div>
              <Slider
                value={leverage}
                onValueChange={setLeverage}
                max={10}
                min={1}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>1x</span>
                <span>5x</span>
                <span>10x</span>
              </div>
            </div>

            {/* Margin Required */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Margin Required</span>
                <span className="font-medium">${marginRequired} USDC</span>
              </div>
            </div>

            {/* Acceptable Price */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Acceptable Price</label>
              <Input
                type="number"
                placeholder="Market price"
                value={acceptablePrice}
                onChange={(e) => setAcceptablePrice(e.target.value)}
                className="text-right"
              />
            </div>

            {/* Order Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button 
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={!orderSize || !parseFloat(orderSize)}
              >
                Open Long
              </Button>
              <Button 
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={!orderSize || !parseFloat(orderSize)}
              >
                Open Short
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Price Chart */}
      <div className="flex-1">
        <Card className="h-96 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{selectedPair} Chart</h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline">TradingView</Badge>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
          </div>
          
          {/* Chart Placeholder */}
          <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <div className="text-gray-500 font-medium">TradingView Chart</div>
              <div className="text-sm text-gray-400 mt-1">640 × 400 px</div>
              {currentPair && (
                <div className="mt-4 space-y-1">
                  <div className="text-2xl font-bold text-gray-700">{currentPair.price}</div>
                  <div className={`text-sm ${currentPair.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {currentPair.change} 24h
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Positions Table */}
      <div className="w-80">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Positions</h3>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {positions.map((position, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{position.pair}</div>
                  <Badge variant={position.side === 'Long' ? 'default' : 'destructive'} className="text-xs">
                    {position.side}
                  </Badge>
                </div>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Size</span>
                    <span>{position.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Entry</span>
                    <span>{position.entryPrice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mark</span>
                    <span>{position.markPrice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">P&L</span>
                    <span className={position.isPositive ? 'text-green-600' : 'text-red-600'}>
                      {position.pnl}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Margin</span>
                    <span>{position.margin}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Liq. Price</span>
                    <span className="text-red-600">{position.liqPrice}</span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 text-xs">
                    Close
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-xs">
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {positions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <div className="text-sm">No positions yet</div>
              <div className="text-xs mt-1">Open a position to get started</div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
