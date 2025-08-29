import { useEffect } from "react";
import { usePortfolioState, useAppState } from "@/contexts/GlobalStateContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Activity,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function MyPortfolio() {
  const { loading, positions, receipts, updatePortfolio } = usePortfolioState();
  const { updateApp } = useAppState();

  useEffect(() => {
    loadPortfolioData();
  }, []);

  const loadPortfolioData = async () => {
    updatePortfolio({ loading: true });

    try {
      const [positionsResponse, receiptsResponse] = await Promise.all([
        fetch('/api/me/positions').then(r => r.json()),
        fetch('/api/me/receipts').then(r => r.json())
      ]);

      updatePortfolio({
        positions: positionsResponse.items || [],
        receipts: receiptsResponse.items || [],
        loading: false
      });
    } catch (error) {
      updatePortfolio({
        positions: [],
        receipts: [],
        loading: false
      });
      console.error('Failed to load portfolio data:', error);
    }
  };

  const handleClaim = async (vaultId: string, receiptId: string) => {
    try {
      const response = await fetch(`/api/vaults/${vaultId}/receipts/${receiptId}/claim`, { 
        method: 'POST' 
      });
      
      if (!response.ok) {
        throw new Error('Claim failed');
      }

      updateApp({ 
        toast: { type: 'success', text: 'Receipt claimed' }
      });

      // Refresh receipts
      const receiptsResponse = await fetch('/api/me/receipts');
      const receiptsData = await receiptsResponse.json();
      updatePortfolio({ receipts: receiptsData.items || [] });
    } catch (error: any) {
      updateApp({ 
        toast: { 
          type: 'error', 
          text: error.message || 'Claim failed' 
        }
      });
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'IN_SETTLEMENT':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'CLAIMABLE':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'SETTLED':
        return <CheckCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'IN_SETTLEMENT':
        return 'bg-blue-100 text-blue-800';
      case 'CLAIMABLE':
        return 'bg-green-100 text-green-800';
      case 'SETTLED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const totalValue = positions.reduce((sum, pos) => sum + (pos.value || 0), 0);
  const totalPnL = positions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);
  const totalPnLPercent = totalValue > 0 ? (totalPnL / (totalValue - totalPnL)) : 0;

  const claimableReceipts = receipts.filter(r => r.status === 'CLAIMABLE');
  const pendingReceipts = receipts.filter(r => ['PENDING', 'IN_SETTLEMENT'].includes(r.status));

  return (
    <div className="space-y-6">
      {/* Header with Portfolio Summary */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Portfolio</h1>
        <p className="mt-2 text-gray-600">
          Track your positions and manage your investment receipts
        </p>
      </div>

      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <div className="text-sm text-gray-500">Total Value</div>
          </div>
          <div className="text-2xl font-bold mt-1">
            {loading ? <Skeleton className="h-8 w-24" /> : formatCurrency(totalValue)}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            {totalPnL >= 0 ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )}
            <div className="text-sm text-gray-500">Total P&L</div>
          </div>
          <div className={cn(
            "text-2xl font-bold mt-1",
            totalPnL >= 0 ? "text-green-600" : "text-red-600"
          )}>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                {formatCurrency(totalPnL)}
                <span className="text-lg ml-2">
                  ({formatPercentage(totalPnLPercent)})
                </span>
              </>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            <div className="text-sm text-gray-500">Claimable</div>
          </div>
          <div className="text-2xl font-bold mt-1">
            {loading ? <Skeleton className="h-8 w-12" /> : claimableReceipts.length}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <div className="text-sm text-gray-500">Pending</div>
          </div>
          <div className="text-2xl font-bold mt-1">
            {loading ? <Skeleton className="h-8 w-12" /> : pendingReceipts.length}
          </div>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="positions" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Positions Tab */}
        <TabsContent value="positions" className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                    <div className="text-right space-y-2">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : positions.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No positions yet</h3>
              <p className="text-gray-500 mb-4">Start investing to see your positions here</p>
              <Button onClick={() => window.location.href = '/invest'}>
                Explore Strategies
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {positions.map((position: any) => (
                <Card 
                  key={position.id} 
                  className="p-6 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => window.location.href = `/vault/${position.vaultId}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <h3 className="font-semibold text-lg">{position.vaultName}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{position.shares?.toLocaleString()} shares</span>
                        <span>PPS: ${position.pps?.toFixed(3)}</span>
                        <span>Last action: {position.lastAction}</span>
                      </div>
                    </div>
                    
                    <div className="text-right space-y-2">
                      <div className="text-2xl font-bold">
                        {formatCurrency(position.value || 0)}
                      </div>
                      <div className={cn(
                        "text-lg font-medium flex items-center gap-1",
                        (position.pnl || 0) >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {(position.pnl || 0) >= 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        {formatCurrency(position.pnl || 0)}
                        <span className="text-sm ml-1">
                          ({formatPercentage(position.pnlPercent || 0)})
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Receipts Tab */}
        <TabsContent value="receipts" className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                </Card>
              ))}
            </div>
          ) : receipts.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Receipt className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No receipts yet</h3>
              <p className="text-gray-500">Your deposit and withdrawal receipts will appear here</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {receipts.map((receipt: any) => (
                <Card key={receipt.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(receipt.status)}
                        <span className="font-medium">{receipt.type}</span>
                        <Badge className={cn("text-xs", getStatusColor(receipt.status))}>
                          {receipt.status}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="text-sm text-gray-600">
                          {receipt.vaultName || `Vault ${receipt.vaultId}`}
                        </div>
                        <div className="font-medium">
                          {receipt.amount} {receipt.asset}
                          {receipt.estimatedShares && (
                            <span className="text-sm text-gray-500 ml-2">
                              → {receipt.estimatedShares} shares
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm text-gray-500">
                        {new Date(receipt.createdAt).toLocaleDateString()}
                      </div>
                      
                      {receipt.status === 'CLAIMABLE' && (
                        <Button 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClaim(receipt.vaultId, receipt.id);
                          }}
                        >
                          Claim
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mock activity data - in real app this would come from API */}
              {[
                {
                  id: 1,
                  type: 'DEPOSIT',
                  description: 'Deposited 1,000 USDC to EW BTC/ETH Strategy',
                  amount: '$1,000',
                  timestamp: '2 hours ago',
                  icon: ArrowUpRight
                },
                {
                  id: 2,
                  type: 'REBALANCE',
                  description: 'Portfolio rebalanced - BTC 52% → 50%',
                  amount: '',
                  timestamp: '1 day ago',
                  icon: Activity
                },
                {
                  id: 3,
                  type: 'WITHDRAWAL',
                  description: 'Withdrew 500 USDC from Real Estate Strategy',
                  amount: '$500',
                  timestamp: '3 days ago',
                  icon: ArrowDownRight
                },
              ].map((activity) => (
                <Card key={activity.id} className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <activity.icon className="w-5 h-5 text-gray-600" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="font-medium">{activity.description}</div>
                      <div className="text-sm text-gray-500">{activity.timestamp}</div>
                    </div>
                    
                    {activity.amount && (
                      <div className="font-medium">{activity.amount}</div>
                    )}
                  </div>
                </Card>
              ))}
              
              <Card className="p-8 text-center">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <div className="text-gray-500">End of activity history</div>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
