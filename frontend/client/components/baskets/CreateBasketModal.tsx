import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  X, 
  Search, 
  Trash2, 
  Plus,
  BarChart3,
  AlertTriangle,
  Info
} from "lucide-react";

interface Asset {
  id: string;
  ticker: string;
  name: string;
  price: number;
  oracle: string;
  type: 'Equity' | 'Bond' | 'Treasury' | 'RWA';
}

interface SelectedAsset extends Asset {
  weight: number;
}

interface CreateBasketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateBasketModal({ isOpen, onClose }: CreateBasketModalProps) {
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("equities");
  const [autoRebalance, setAutoRebalance] = useState(false);

  const assets: Asset[] = [
    { id: "1", ticker: "bAAPL", name: "Apple Inc.", price: 178.45, oracle: "Chainlink", type: "Equity" },
    { id: "2", ticker: "bTSLA", name: "Tesla Inc.", price: 239.50, oracle: "Chainlink", type: "Equity" },
    { id: "3", ticker: "bGOOGL", name: "Alphabet Inc.", price: 125.80, oracle: "Chainlink", type: "Equity" },
    { id: "4", ticker: "bAMZN", name: "Amazon.com Inc.", price: 142.30, oracle: "Chainlink", type: "Equity" },
    { id: "5", ticker: "bMSFT", name: "Microsoft Corp.", price: 415.20, oracle: "Chainlink", type: "Equity" },
    { id: "6", ticker: "bUST10Y", name: "US Treasury 10Y", price: 98.75, oracle: "Chainlink", type: "Treasury" },
    { id: "7", ticker: "bUST2Y", name: "US Treasury 2Y", price: 99.12, oracle: "Chainlink", type: "Treasury" },
    { id: "8", ticker: "bCORPAAA", name: "Corp Bond AAA", price: 102.45, oracle: "Chainlink", type: "Bond" },
    { id: "9", ticker: "bGOLD", name: "Gold RWA", price: 2045.30, oracle: "Chainlink", type: "RWA" },
    { id: "10", ticker: "bSILVER", name: "Silver RWA", price: 24.85, oracle: "Chainlink", type: "RWA" },
  ];

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === "equities" ? asset.type === "Equity" :
                      activeTab === "bonds" ? asset.type === "Bond" :
                      activeTab === "treasuries" ? asset.type === "Treasury" :
                      asset.type === "RWA";
    return matchesSearch && matchesTab;
  });

  const totalAllocation = selectedAssets.reduce((sum, asset) => sum + asset.weight, 0);
  const isValidAllocation = Math.abs(totalAllocation - 100) < 0.01;

  const addAsset = (asset: Asset) => {
    if (selectedAssets.find(a => a.id === asset.id)) return;
    
    const newWeight = selectedAssets.length === 0 ? 100 : 0;
    setSelectedAssets([...selectedAssets, { ...asset, weight: newWeight }]);
  };

  const removeAsset = (assetId: string) => {
    setSelectedAssets(selectedAssets.filter(a => a.id !== assetId));
  };

  const updateWeight = (assetId: string, newWeight: number) => {
    setSelectedAssets(selectedAssets.map(asset => 
      asset.id === assetId ? { ...asset, weight: newWeight } : asset
    ));
  };

  const calculateProjectedYield = () => {
    // Mock calculation based on asset types
    const avgYield = selectedAssets.reduce((sum, asset) => {
      const baseYield = asset.type === "Treasury" ? 4.5 :
                       asset.type === "Bond" ? 5.2 :
                       asset.type === "Equity" ? 2.1 :
                       3.8;
      return sum + (baseYield * asset.weight / 100);
    }, 0);
    return avgYield.toFixed(2) + "%";
  };

  const calculateProjectedReturn = () => {
    // Mock calculation
    const avgReturn = selectedAssets.reduce((sum, asset) => {
      const baseReturn = asset.type === "Equity" ? 8.5 :
                        asset.type === "Bond" ? 4.2 :
                        asset.type === "Treasury" ? 3.8 :
                        6.1;
      return sum + (baseReturn * asset.weight / 100);
    }, 0);
    return avgReturn.toFixed(2) + "%";
  };

  const calculateVolatility = () => {
    // Mock calculation
    const avgVol = selectedAssets.reduce((sum, asset) => {
      const baseVol = asset.type === "Equity" ? 15.2 :
                     asset.type === "Bond" ? 5.8 :
                     asset.type === "Treasury" ? 3.2 :
                     12.5;
      return sum + (baseVol * asset.weight / 100);
    }, 0);
    return avgVol.toFixed(1) + "%";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-7xl h-full max-h-[640px] bg-white rounded-lg shadow-xl">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Create Custom Basket</h2>
              <p className="text-sm text-gray-600 mt-1">Pick assets and assign weights</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex h-[calc(100%-140px)] overflow-hidden">
          {/* Asset Picker - Left Column */}
          <div className="w-70 border-r border-gray-200 p-6">
            <div className="space-y-4 h-full flex flex-col">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4 text-xs">
                  <TabsTrigger value="equities">Equities</TabsTrigger>
                  <TabsTrigger value="bonds">Bonds</TabsTrigger>
                  <TabsTrigger value="treasuries">Treasuries</TabsTrigger>
                  <TabsTrigger value="rwas">RWAs</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {filteredAssets.map((asset) => {
                  const isSelected = selectedAssets.find(a => a.id === asset.id);
                  return (
                    <div 
                      key={asset.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          checked={!!isSelected}
                          onCheckedChange={() => isSelected ? removeAsset(asset.id) : addAsset(asset)}
                        />
                        <div>
                          <div className="font-medium text-sm">{asset.ticker}</div>
                          <div className="text-xs text-gray-500">{asset.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">${asset.price}</div>
                        <Badge variant="outline" className="text-xs">{asset.oracle}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selected & Weights - Center Column */}
          <div className="w-80 p-6">
            <div className="space-y-4 h-full flex flex-col">
              <h3 className="font-medium text-gray-900">Selected Assets & Weights</h3>
              
              <div className="flex-1 overflow-y-auto space-y-3">
                {selectedAssets.map((asset) => (
                  <div key={asset.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm">{asset.ticker}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeAsset(asset.id)}
                        className="p-1 h-auto text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <Slider
                        value={[asset.weight]}
                        onValueChange={([value]) => updateWeight(asset.id, value)}
                        max={100}
                        step={0.1}
                        className="w-full"
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={asset.weight.toFixed(1)}
                          onChange={(e) => updateWeight(asset.id, parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 text-sm"
                          max={100}
                          min={0}
                          step={0.1}
                        />
                        <span className="text-sm text-gray-500">%</span>
                      </div>
                    </div>
                  </div>
                ))}
                
                {selectedAssets.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Plus className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <div className="text-sm">Select assets to build your basket</div>
                  </div>
                )}
              </div>

              {/* Total Allocation */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Allocation</span>
                  <span className={`font-medium ${isValidAllocation ? 'text-green-600' : 'text-red-600'}`}>
                    {totalAllocation.toFixed(1)}%
                  </span>
                </div>
                <Progress value={totalAllocation} className="h-2" />
                {!isValidAllocation && totalAllocation > 0 && (
                  <div className="flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="w-3 h-3" />
                    Total must equal 100%
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preview & Rules - Right Column */}
          <div className="flex-1 p-6">
            <div className="space-y-6 h-full flex flex-col">
              <h3 className="font-medium text-gray-900">Preview & Rules</h3>
              
              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Projected Yield</div>
                  <div className="text-sm font-medium">{calculateProjectedYield()}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">1Y Return</div>
                  <div className="text-sm font-medium">{calculateProjectedReturn()}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Volatility</div>
                  <div className="text-sm font-medium">{calculateVolatility()}</div>
                </div>
              </div>

              {/* Mini Chart */}
              <Card className="p-4">
                <div className="w-full h-30 bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                    <div className="text-xs text-gray-500">Preview Chart</div>
                    <div className="text-xs text-gray-400">300 × 120px</div>
                  </div>
                </div>
              </Card>

              {/* Rules */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Auto-Rebalance Monthly</span>
                    <Info className="w-3 h-3 text-gray-400" />
                  </div>
                  <Switch checked={autoRebalance} onCheckedChange={setAutoRebalance} />
                </div>

                <div className="bg-yellow-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-yellow-800">
                    <AlertTriangle className="w-4 h-4" />
                    KYC Required for certain assets
                  </div>
                </div>

                <Card className="p-3">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Fee Summary</h4>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Management Fee</span>
                      <span>0.75% annually</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Rebalance Fee</span>
                      <span>0.1% per rebalance</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gas Fees</span>
                      <span>~$5-15</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <div className="flex justify-between">
            <Button variant="outline">Save Draft</Button>
            <div className="flex gap-3">
              <Button variant="outline" disabled={!isValidAllocation}>
                Backtest
              </Button>
              <Button disabled={!isValidAllocation}>
                Create Basket
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
