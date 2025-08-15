import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, BarChart3, Download, ShoppingCart } from "lucide-react";

interface BasketDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  basketId: string | null;
}

export function BasketDetailsDrawer({ isOpen, onClose, basketId }: BasketDetailsDrawerProps) {
  if (!isOpen || !basketId) return null;

  // Mock data - in real app would fetch based on basketId
  const basketData = {
    name: "US Tech Bluechip",
    tags: ["Equity", "Monthly Rebalance", "KYC Required"],
    oneYearReturn: "+12.4%",
    threeYearCAGR: "+8.9%",
    volatility: "13.2%",
    yield: "3.1%",
    sharpe: "1.2",
    description: "A curated basket of mega-cap technology companies providing exposure to the most established tech giants. This basket focuses on companies with strong fundamentals, consistent growth, and market leadership positions.",
    holdings: [
      { asset: "Apple Inc.", ticker: "bAAPL", weight: "22.5%", type: "Equity", oracle: "Chainlink" },
      { asset: "Microsoft Corp.", ticker: "bMSFT", weight: "20.1%", type: "Equity", oracle: "Chainlink" },
      { asset: "Alphabet Inc.", ticker: "bGOOGL", weight: "15.8%", type: "Equity", oracle: "Chainlink" },
      { asset: "Amazon.com Inc.", ticker: "bAMZN", weight: "12.3%", type: "Equity", oracle: "Chainlink" },
      { asset: "Tesla Inc.", ticker: "bTSLA", weight: "10.2%", type: "Equity", oracle: "Chainlink" },
      { asset: "Meta Platforms", ticker: "bMETA", weight: "8.4%", type: "Equity", oracle: "Chainlink" },
      { asset: "NVIDIA Corp.", ticker: "bNVDA", weight: "6.7%", type: "Equity", oracle: "Chainlink" },
      { asset: "Netflix Inc.", ticker: "bNFLX", weight: "4.0%", type: "Equity", oracle: "Chainlink" },
    ],
    fees: {
      managementFee: "0.75%",
      entryFee: "0.1%",
      exitFee: "0.1%",
      rebalanceSchedule: "Monthly",
      nextRebalance: "Dec 1, 2024",
    },
    risks: [
      "Market risk from equity price volatility",
      "Oracle divergence from real-world asset prices",
      "Liquidity risk during high volatility periods",
      "Concentration risk in technology sector",
      "Regulatory risk affecting tokenized securities"
    ]
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-50">
      <div className="w-[480px] bg-white h-full shadow-xl animate-in slide-in-from-right overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{basketData.name}</h2>
              <div className="flex gap-2 mt-2">
                {basketData.tags.map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-6">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 text-xs">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="holdings">Holdings</TabsTrigger>
              <TabsTrigger value="backtest">Backtest</TabsTrigger>
              <TabsTrigger value="fees">Fees</TabsTrigger>
              <TabsTrigger value="risks">Risks</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* KPI Chips */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">1Y Return</div>
                  <div className="text-sm font-medium text-green-600">{basketData.oneYearReturn}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">3Y CAGR</div>
                  <div className="text-sm font-medium">{basketData.threeYearCAGR}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Volatility</div>
                  <div className="text-sm font-medium">{basketData.volatility}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Yield</div>
                  <div className="text-sm font-medium">{basketData.yield}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Sharpe</div>
                  <div className="text-sm font-medium">{basketData.sharpe}</div>
                </div>
              </div>

              {/* Chart Placeholder */}
              <Card className="p-6">
                <div className="w-full h-50 bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <div className="text-sm text-gray-500">Performance Chart</div>
                    <div className="text-xs text-gray-400">440 × 200px</div>
                  </div>
                </div>
              </Card>

              {/* Description */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {basketData.description}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="holdings" className="space-y-4">
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticker</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weight</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Oracle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {basketData.holdings.map((holding, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {holding.asset}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {holding.ticker}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {holding.weight}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs">
                              {holding.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {holding.oracle}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="backtest" className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">CAGR</div>
                  <div className="text-sm font-medium">8.9%</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Max DD</div>
                  <div className="text-sm font-medium text-red-600">-12.3%</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Win %</div>
                  <div className="text-sm font-medium">68%</div>
                </div>
              </div>

              <Card className="p-6">
                <div className="w-full h-50 bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <div className="text-sm text-gray-500">Backtest Chart</div>
                    <div className="text-xs text-gray-400">440 × 200px</div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="fees" className="space-y-4">
              <Card className="p-6 space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Management Fee</span>
                  <span className="text-sm font-medium">{basketData.fees.managementFee} annually</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Entry Fee</span>
                  <span className="text-sm font-medium">{basketData.fees.entryFee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Exit Fee</span>
                  <span className="text-sm font-medium">{basketData.fees.exitFee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Rebalance Schedule</span>
                  <Badge variant="outline">{basketData.fees.rebalanceSchedule}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Next Rebalance</span>
                  <span className="text-sm font-medium">{basketData.fees.nextRebalance}</span>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="risks" className="space-y-4">
              <Card className="p-6">
                <ul className="space-y-3">
                  {basketData.risks.map((risk, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
                      {risk}
                    </li>
                  ))}
                </ul>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6">
          <div className="flex gap-3">
            <Button className="flex-1">
              Invest
            </Button>
            <Button variant="outline" className="flex-1">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Add to Cart
            </Button>
            <Button variant="ghost">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
