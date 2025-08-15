import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HealthFactorGauge } from "@/components/HealthFactorGauge";
import { TrendingUp, TrendingDown, DollarSign, Activity, Clock } from "lucide-react";

export default function Portfolio() {
  const headerMetrics = [
    {
      title: "Portfolio Value",
      value: "$12,450.89",
      change: "+5.67%",
      isPositive: true,
      icon: DollarSign,
    },
    {
      title: "Net Borrowed",
      value: "$2,100.00",
      change: "-0.12%",
      isPositive: false,
      icon: TrendingDown,
    },
    {
      title: "Health Factor",
      value: "1.85",
      isGauge: true,
      icon: Activity,
    },
    {
      title: "Pending Yield",
      value: "$145.20",
      change: "+12.4%",
      isPositive: true,
      icon: Clock,
    },
  ];

  const positions = [
    {
      asset: "AAPL-T",
      name: "Apple Inc. Token",
      icon: "🍎",
      supplied: "$5,240.50",
      variableAPY: "4.2%",
      collateral: "$4,716.45",
      borrowed: "$800.00",
      status: "healthy",
    },
    {
      asset: "TSLA-T", 
      name: "Tesla Inc. Token",
      icon: "⚡",
      supplied: "$3,150.30",
      variableAPY: "6.8%",
      collateral: "$2,520.24",
      borrowed: "$1,200.00",
      status: "warning",
    },
    {
      asset: "SPY-T",
      name: "SPDR S&P 500 ETF Token",
      icon: "📈",
      supplied: "$4,060.09",
      variableAPY: "3.5%",
      collateral: "$3,654.08",
      borrowed: "$100.00",
      status: "healthy",
    },
  ];

  const perpPositions = [
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

  return (
    <div className="space-y-6">
      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {headerMetrics.map((metric, index) => (
          <Card key={index} className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-600">{metric.title}</h3>
              <metric.icon className="w-4 h-4 text-gray-400" />
            </div>
            
            {metric.isGauge ? (
              <div className="flex justify-center">
                <HealthFactorGauge value={parseFloat(metric.value)} />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-gray-900 mb-2">{metric.value}</div>
                {metric.change && (
                  <div className="flex items-center">
                    {metric.isPositive ? (
                      <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                    )}
                    <span className={`text-sm font-medium ${metric.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {metric.change}
                    </span>
                  </div>
                )}
              </>
            )}
          </Card>
        ))}
      </div>

      {/* Positions Table */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Lending Positions</h2>
        
        <Accordion type="multiple" className="space-y-2">
          {positions.map((position, index) => (
            <AccordionItem key={index} value={`position-${index}`} className="border border-gray-200 rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{position.icon}</span>
                    <div className="text-left">
                      <div className="font-medium text-gray-900">{position.asset}</div>
                      <div className="text-sm text-gray-500">{position.name}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-8 flex-1 max-w-2xl text-center">
                    <div>
                      <div className="text-sm text-gray-500">Supplied</div>
                      <div className="font-medium">{position.supplied}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Variable APY</div>
                      <div className="font-medium text-green-600">{position.variableAPY}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Collateral</div>
                      <div className="font-medium">{position.collateral}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Borrowed</div>
                      <div className="font-medium">{position.borrowed}</div>
                    </div>
                  </div>
                  
                  <Badge variant={position.status === 'healthy' ? 'default' : 'destructive'} className="mr-4">
                    {position.status}
                  </Badge>
                </div>
              </AccordionTrigger>
              
              <AccordionContent className="px-4 pb-4">
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Current Price</div>
                      <div className="font-medium">$178.45</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Liquidation Price</div>
                      <div className="font-medium text-red-600">$142.76</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Available to Borrow</div>
                      <div className="font-medium">$2,358.23</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Earned Interest</div>
                      <div className="font-medium text-green-600">+$45.20</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">Supply More</Button>
                    <Button size="sm" variant="outline">Withdraw</Button>
                    <Button size="sm" variant="outline">Borrow</Button>
                    <Button size="sm">Manage</Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>

      {/* Perp Positions Table */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Perpetual Positions</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200">
              <tr className="text-left">
                <th className="pb-3 text-sm font-medium text-gray-600">Pair</th>
                <th className="pb-3 text-sm font-medium text-gray-600">Side</th>
                <th className="pb-3 text-sm font-medium text-gray-600">Size</th>
                <th className="pb-3 text-sm font-medium text-gray-600">Entry Price</th>
                <th className="pb-3 text-sm font-medium text-gray-600">Mark Price</th>
                <th className="pb-3 text-sm font-medium text-gray-600">P&L</th>
                <th className="pb-3 text-sm font-medium text-gray-600">Margin</th>
                <th className="pb-3 text-sm font-medium text-gray-600">Liq. Price</th>
                <th className="pb-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {perpPositions.map((position, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="py-4 font-medium text-gray-900">{position.pair}</td>
                  <td className="py-4">
                    <Badge variant={position.side === 'Long' ? 'default' : 'destructive'}>
                      {position.side}
                    </Badge>
                  </td>
                  <td className="py-4 text-gray-600">{position.size}</td>
                  <td className="py-4 text-gray-600">{position.entryPrice}</td>
                  <td className="py-4 text-gray-600">{position.markPrice}</td>
                  <td className="py-4">
                    <div className={position.isPositive ? 'text-green-600' : 'text-red-600'}>
                      <div className="font-medium">{position.pnl}</div>
                      <div className="text-sm">{position.pnlPercent}</div>
                    </div>
                  </td>
                  <td className="py-4 text-gray-600">{position.margin}</td>
                  <td className="py-4 text-red-600">{position.liqPrice}</td>
                  <td className="py-4">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">Close</Button>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {perpPositions.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No perpetual positions found. <Button variant="link" className="p-0">Open a position</Button> to get started.
          </div>
        )}
      </Card>
    </div>
  );
}
