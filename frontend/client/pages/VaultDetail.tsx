import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useVaultState, useAppState } from "@/contexts/GlobalStateContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  TrendingUp,
  TrendingDown,
  Shield,
  DollarSign,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Lock,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function VaultDetail() {
  const { id } = useParams<{ id: string }>();
  const { 
    data, 
    loading, 
    tabs, 
    depositAmount, 
    estShares, 
    creating,
    updateVault 
  } = useVaultState();
  const { updateApp } = useAppState();

  useEffect(() => {
    if (id) {
      updateVault({ id, loading: true });
      loadVaultData();
    }
  }, [id]);

  const loadVaultData = async () => {
    try {
      const response = await fetch(`/api/vaults/${id}`);
      const vaultData = await response.json();
      updateVault({ 
        data: vaultData, 
        loading: false 
      });
    } catch (error) {
      updateVault({ 
        data: null, 
        loading: false 
      });
      console.error('Failed to load vault data:', error);
    }
  };

  const handlePreview = () => {
    const amt = parseFloat(depositAmount || '0');
    const pps = data?.metrics?.pps || 1;
    updateVault({ 
      estShares: amt > 0 ? (amt / pps) : 0 
    });
  };

  const handleCreateDeposit = async () => {
    const amt = parseFloat(depositAmount || '0');
    if (!amt || amt <= 0) {
      updateApp({ 
        toast: { type: 'error', text: 'Enter amount' } 
      });
      return;
    }

    updateVault({ creating: true });

    try {
      const response = await fetch(`/api/vaults/${id}/deposits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: amt, 
          asset: data?.accountingAsset || 'USDC' 
        })
      });

      const result = await response.json();
      
      updateApp(state => ({
        ...state,
        receipts: [result.receipt, ...state.receipts],
        receiptsOpen: true,
        toast: { type: 'success', text: 'Deposit request created' }
      }));
      
      updateVault({ 
        depositAmount: '',
        estShares: 0
      });
    } catch (error) {
      updateApp({ 
        toast: { 
          type: 'error', 
          text: error.message || 'Failed to create deposit' 
        } 
      });
    } finally {
      updateVault({ creating: false });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACCEPTING':
        return 'bg-green-100 text-green-800';
      case 'PAUSED':
        return 'bg-yellow-100 text-yellow-800';
      case 'TIMELOCK_PENDING':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${(value * 100).toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-4">
            <Skeleton className="h-20 w-48" />
            <Skeleton className="h-20 w-48" />
            <Skeleton className="h-20 w-48" />
            <Skeleton className="h-20 w-32" />
          </div>
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Vault not found</h1>
        <p className="text-gray-600">The requested vault could not be found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-20 bg-gray-50 z-40 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900">{data.title || `Vault ${id}`}</h1>
          <Badge className={cn("text-sm", getStatusColor(data.status))}>
            {data.status || 'UNKNOWN'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-500">NAV</div>
            <div className="text-2xl font-bold">{formatCurrency(data.metrics?.nav || 0)}</div>
          </Card>
          
          <Card className="p-4">
            <div className="text-sm text-gray-500">PPS</div>
            <div className="text-2xl font-bold font-mono">${data.metrics?.pps?.toFixed(3) || '1.000'}</div>
          </Card>
          
          <Card className="p-4">
            <div className="text-sm text-gray-500">Shares Outstanding</div>
            <div className="text-2xl font-bold">{(data.metrics?.shares || 0).toLocaleString()}</div>
          </Card>

          <Sheet>
            <SheetTrigger asChild>
              <Card className="p-4 cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <div className="text-sm text-gray-500">Safety</div>
                </div>
                <div className="text-lg font-semibold text-blue-600">View Details</div>
              </Card>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px]">
              <SheetHeader>
                <SheetTitle>Safety & Governance</SheetTitle>
                <SheetDescription>
                  Security measures and governance controls for this vault
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                {/* Fee Caps */}
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Fee Caps
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Entry: {data.safety?.feeCaps?.entry || '≤1%'}</div>
                    <div>Exit: {data.safety?.feeCaps?.exit || '≤0.5%'}</div>
                    <div>Management: {data.safety?.feeCaps?.mgmt || '≤2% APR'}</div>
                    <div>Performance: {data.safety?.feeCaps?.perf || '≤20% HWM'}</div>
                  </div>
                </div>

                {/* Roles */}
                <div>
                  <h3 className="font-medium mb-3">Allowlisted Contracts</h3>
                  <div className="space-y-2">
                    {data.safety?.roles?.map((role: any, index: number) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg text-sm">
                        <div className="font-medium">{role.contract}</div>
                        <div className="text-gray-600">{role.fn}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Max: {role.slippageBpsMax}bps, ${role.orderMaxUSD?.toLocaleString()}
                        </div>
                      </div>
                    )) || (
                      <div className="text-gray-500 text-sm">No contract roles defined</div>
                    )}
                  </div>
                </div>

                {/* Timelock */}
                <div>
                  <h3 className="font-medium mb-3">Timelock (48h)</h3>
                  {data.safety?.timelock?.pending?.length > 0 ? (
                    <div className="space-y-2">
                      {data.safety.timelock.pending.map((item: any, index: number) => (
                        <div key={index} className="p-3 bg-yellow-50 rounded-lg text-sm">
                          <div className="font-medium">{item.action}</div>
                          <div className="text-gray-600">Executes: {item.executeAt}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-500 text-sm">No pending timelock actions</div>
                  )}
                </div>

                {/* Guardian */}
                <div>
                  <h3 className="font-medium mb-3">Guardian Status</h3>
                  <div className={cn(
                    "p-3 rounded-lg text-sm",
                    data.safety?.guardian?.paused 
                      ? "bg-red-50 text-red-800" 
                      : "bg-green-50 text-green-800"
                  )}>
                    {data.safety?.guardian?.paused ? 'Paused by Guardian' : 'Active'}
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts and Analysis */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance & Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={tabs} onValueChange={(value) => updateVault({ tabs: value })}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="equity">Equity & Drawdown</TabsTrigger>
                  <TabsTrigger value="allocation">Allocation</TabsTrigger>
                  <TabsTrigger value="turnover">Turnover</TabsTrigger>
                </TabsList>
                
                <TabsContent value="equity" className="space-y-4">
                  <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <div className="text-gray-500">Equity Chart</div>
                      <div className="text-sm text-gray-400">Chart will be rendered here</div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="allocation" className="space-y-4">
                  <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <div className="text-gray-500">Allocation Over Time</div>
                      <div className="text-sm text-gray-400">Chart will be rendered here</div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="turnover" className="space-y-4">
                  <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Clock className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <div className="text-gray-500">Turnover vs Band Hits</div>
                      <div className="text-sm text-gray-400">Chart will be rendered here</div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Explain Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Asset Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.explain?.map((asset: any, index: number) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-lg">{asset.asset}</span>
                      {asset.excluded && (
                        <Badge className="bg-red-100 text-red-800 text-xs">
                          Excluded today: failed {asset.failedGate}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        {asset.trend ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span>Trend (20D SMA)</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {asset.volume ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span>Volume &gt; 1.2×avg</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-4 h-4 rounded-full",
                          asset.sentiment > 0 ? "bg-green-500" :
                          asset.sentiment < 0 ? "bg-red-500" : "bg-gray-400"
                        )} />
                        <span>Sentiment: {asset.sentiment?.toFixed(2) || 'N/A'}</span>
                      </div>
                      
                      <div>
                        <span>Weight: {(asset.current * 100).toFixed(1)}% / {(asset.target * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-8 text-gray-500">
                    No asset breakdown available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Deposit Box */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Deposit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Amount ({data.accountingAsset || 'USDC'})
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => updateVault({ depositAmount: e.target.value })}
                  className="mt-1"
                />
              </div>

              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handlePreview}
                disabled={!depositAmount || parseFloat(depositAmount) <= 0}
              >
                Preview
              </Button>

              {estShares > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-800">
                    <div className="font-medium">Estimated Shares</div>
                    <div className="text-lg font-bold">{estShares.toFixed(6)}</div>
                    <div className="text-xs mt-1 text-blue-600">
                      * Final shares determined at settlement after batched execution
                    </div>
                  </div>
                </div>
              )}

              <Button 
                className="w-full" 
                onClick={handleCreateDeposit}
                disabled={creating || !depositAmount || parseFloat(depositAmount) <= 0}
              >
                {creating ? 'Creating...' : 'Create Deposit'}
              </Button>

              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>Deposits are processed asynchronously via ERC-7540</span>
                </div>
                <div>• Request created immediately</div>
                <div>• Shares allocated at next rebalance</div>
                <div>• Settlement typically within 24-48 hours</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
