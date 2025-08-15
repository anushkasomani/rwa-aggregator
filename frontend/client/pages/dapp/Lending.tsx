import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, DollarSign, Activity, X } from "lucide-react";

export default function Lending() {
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [modalAction, setModalAction] = useState<'supply' | 'borrow' | null>(null);

  const supplyAssets = [
    {
      asset: "ETH",
      name: "Ethereum",
      icon: "⚪",
      variableAPY: "3.2%",
      totalSupplied: "$2.8B",
      yourSupply: "$1,250.00",
      canBeCollateral: true,
    },
    {
      asset: "USDC",
      name: "USD Coin", 
      icon: "💙",
      variableAPY: "4.8%",
      totalSupplied: "$1.2B",
      yourSupply: "$0.00",
      canBeCollateral: true,
    },
    {
      asset: "bAAPL",
      name: "Apple Inc. Token",
      icon: "🍎",
      variableAPY: "2.1%",
      totalSupplied: "$45M",
      yourSupply: "$0.00",
      canBeCollateral: true,
    },
    {
      asset: "bTSLA",
      name: "Tesla Inc. Token",
      icon: "⚡",
      variableAPY: "1.8%",
      totalSupplied: "$23M",
      yourSupply: "$0.00",
      canBeCollateral: false,
    },
  ];

  const borrowAssets = [
    {
      asset: "USDC",
      name: "USD Coin",
      icon: "💙",
      variableAPY: "5.2%",
      totalBorrowed: "$900M",
      yourBorrow: "$500.00",
      available: "$125.30",
    },
    {
      asset: "ETH",
      name: "Ethereum",
      icon: "⚪",
      variableAPY: "4.1%",
      totalBorrowed: "$1.5B",
      yourBorrow: "$0.00",
      available: "$0.75",
    },
    {
      asset: "DAI",
      name: "Dai Stablecoin",
      icon: "🟡",
      variableAPY: "5.8%",
      totalBorrowed: "$450M",
      yourBorrow: "$0.00",
      available: "$89.45",
    },
  ];

  const openModal = (asset: any, action: 'supply' | 'borrow') => {
    setSelectedAsset(asset);
    setModalAction(action);
  };

  const closeModal = () => {
    setSelectedAsset(null);
    setModalAction(null);
  };

  const SupplyBorrowModal = () => {
    if (!selectedAsset || !modalAction) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-50">
        <div className="w-96 bg-white h-full shadow-xl animate-in slide-in-from-right">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold capitalize">{modalAction} {selectedAsset.asset}</h3>
              <Button variant="ghost" size="sm" onClick={closeModal}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Asset Info */}
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedAsset.icon}</span>
              <div>
                <div className="font-medium">{selectedAsset.asset}</div>
                <div className="text-sm text-gray-500">{selectedAsset.name}</div>
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Amount</label>
              <div className="relative">
                <Input 
                  type="number" 
                  placeholder="0.0" 
                  className="text-right pr-16 h-12 text-lg"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <span className="text-sm text-gray-500">{selectedAsset.asset}</span>
                </div>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Available: {modalAction === 'supply' ? '10.5' : selectedAsset.available}</span>
                <Button variant="link" className="h-auto p-0 text-xs">MAX</Button>
              </div>
            </div>

            {/* Transaction Overview */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">Transaction Overview</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{modalAction === 'supply' ? 'Supply' : 'Borrow'} APY</span>
                  <span className="font-medium">{selectedAsset.variableAPY}</span>
                </div>
                {modalAction === 'borrow' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Health Factor</span>
                      <span className="text-orange-600">1.42 → 1.28</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Liquidation Risk</span>
                      <Badge variant="outline" className="text-orange-600">Medium</Badge>
                    </div>
                  </>
                )}
              </div>
            </div>

            {modalAction === 'supply' && (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="collateral" className="rounded" defaultChecked={selectedAsset.canBeCollateral} />
                <label htmlFor="collateral" className="text-sm text-gray-700">
                  Use as collateral
                </label>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button className="w-full h-12 text-base">
                {modalAction === 'supply' ? 'Supply' : 'Borrow'} {selectedAsset.asset}
              </Button>
              <Button variant="outline" className="w-full" onClick={closeModal}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6">
        <Tabs defaultValue="supply" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="supply">Supply</TabsTrigger>
            <TabsTrigger value="borrow">Borrow</TabsTrigger>
          </TabsList>

          <TabsContent value="supply" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {supplyAssets.map((asset, index) => (
                <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="space-y-4">
                    {/* Asset Header */}
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{asset.icon}</span>
                      <div>
                        <div className="font-medium text-gray-900">{asset.asset}</div>
                        <div className="text-sm text-gray-500">{asset.name}</div>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Variable APY</span>
                        <span className="font-medium text-green-600">{asset.variableAPY}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Supplied</span>
                        <span className="font-medium">{asset.totalSupplied}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Your Supply</span>
                        <span className="font-medium">{asset.yourSupply}</span>
                      </div>
                    </div>

                    {/* Collateral Badge */}
                    {asset.canBeCollateral && (
                      <Badge variant="outline" className="text-xs">
                        Can be used as collateral
                      </Badge>
                    )}

                    {/* Action Button */}
                    <Button 
                      className="w-full"
                      onClick={() => openModal(asset, 'supply')}
                    >
                      Supply {asset.asset}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="borrow" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {borrowAssets.map((asset, index) => (
                <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="space-y-4">
                    {/* Asset Header */}
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{asset.icon}</span>
                      <div>
                        <div className="font-medium text-gray-900">{asset.asset}</div>
                        <div className="text-sm text-gray-500">{asset.name}</div>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Variable APY</span>
                        <span className="font-medium text-red-600">{asset.variableAPY}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Borrowed</span>
                        <span className="font-medium">{asset.totalBorrowed}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Your Borrow</span>
                        <span className="font-medium">{asset.yourBorrow}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Available</span>
                        <span className="font-medium text-blue-600">{asset.available} {asset.asset}</span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <Button 
                      className="w-full"
                      onClick={() => openModal(asset, 'borrow')}
                      disabled={parseFloat(asset.available) === 0}
                    >
                      {parseFloat(asset.available) === 0 ? 'No Collateral' : `Borrow ${asset.asset}`}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Your Positions Summary */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Positions</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">$1,750.00</div>
              <div className="text-sm text-gray-500">Total Supplied</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">$500.00</div>
              <div className="text-sm text-gray-500">Total Borrowed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">1.85</div>
              <div className="text-sm text-gray-500">Health Factor</div>
            </div>
          </div>
        </Card>
      </div>

      <SupplyBorrowModal />
    </>
  );
}
