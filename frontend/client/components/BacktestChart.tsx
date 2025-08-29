import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BacktestChartProps {
  backtest?: {
    equityCurve?: Array<{
      t: string;
      equity: number;
    }>;
    drawdown?: Array<{
      t: string;
      value: number;
    }>;
    stats?: {
      totalReturn?: number;
      sharpe?: number;
      maxDrawdown?: number;
      volatility?: number;
    };
  } | null;
  loading?: boolean;
  className?: string;
  showTitle?: boolean;
}

export function BacktestChart({ 
  backtest, 
  loading = false, 
  className,
  showTitle = true 
}: BacktestChartProps) {
  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${(value * 100).toFixed(1)}%`;
  };

  const formatRatio = (value: number) => {
    return value?.toFixed(2) || 'N/A';
  };

  if (loading) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Backtest Results
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!backtest) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Backtest Results
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <div>Backtest results will appear here</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Backtest Results
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-6">
          {/* Main Chart Area */}
          <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center relative overflow-hidden">
            {backtest.equityCurve && backtest.equityCurve.length > 0 ? (
              <div className="w-full h-full p-4">
                {/* Simple mock chart visualization */}
                <div className="relative w-full h-full">
                  <div className="absolute inset-0 flex items-end justify-between">
                    {backtest.equityCurve.slice(0, 20).map((point, index) => {
                      const height = Math.max(10, (point.equity / 2) * 100);
                      return (
                        <div
                          key={index}
                          className="bg-blue-500 rounded-t-sm"
                          style={{
                            height: `${height}%`,
                            width: `${100 / 20}%`,
                            marginRight: index < 19 ? '2px' : '0'
                          }}
                        />
                      );
                    })}
                  </div>
                  
                  {/* Chart overlay */}
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-2 text-sm">
                    <div className="flex items-center gap-1 text-green-600">
                      <TrendingUp className="w-3 h-3" />
                      <span className="font-medium">
                        {formatPercentage(backtest.stats?.totalReturn || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <div className="text-gray-500">Equity Chart</div>
                <div className="text-sm text-gray-400">
                  {backtest.stats?.totalReturn 
                    ? `Total Return: ${formatPercentage(backtest.stats.totalReturn)}`
                    : 'Chart will be rendered here'
                  }
                </div>
              </div>
            )}
          </div>

          {/* Drawdown Track */}
          {backtest.drawdown && backtest.drawdown.length > 0 && (
            <div className="h-16 bg-red-50 rounded-lg p-2">
              <div className="text-xs text-red-600 mb-1">Drawdown</div>
              <div className="relative w-full h-8">
                <div className="absolute inset-0 flex items-end justify-between">
                  {backtest.drawdown.slice(0, 20).map((point, index) => {
                    const height = Math.abs(point.value) * 100;
                    return (
                      <div
                        key={index}
                        className="bg-red-400 rounded-t-sm"
                        style={{
                          height: `${Math.min(height, 100)}%`,
                          width: `${100 / 20}%`,
                          marginRight: index < 19 ? '1px' : '0'
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          {backtest.stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-gray-500 text-xs">Total Return</div>
                <div className={cn(
                  "font-mono font-medium text-lg",
                  (backtest.stats.totalReturn || 0) >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {formatPercentage(backtest.stats.totalReturn || 0)}
                </div>
              </div>
              
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-gray-500 text-xs">Sharpe Ratio</div>
                <div className="font-mono font-medium text-lg">
                  {formatRatio(backtest.stats.sharpe || 0)}
                </div>
              </div>
              
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-gray-500 text-xs">Max Drawdown</div>
                <div className="font-mono font-medium text-lg text-red-600">
                  {formatPercentage(backtest.stats.maxDrawdown || 0)}
                </div>
              </div>
              
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-gray-500 text-xs">Volatility</div>
                <div className="font-mono font-medium text-lg">
                  {formatPercentage(backtest.stats.volatility || 0)}
                </div>
              </div>
            </div>
          )}

          {/* Chart Notes */}
          <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
              <div>
                <div className="font-medium text-blue-900 mb-1">Backtest Methodology</div>
                <div className="text-blue-800">
                  Performance is simulated based on historical data with realistic transaction costs, 
                  slippage, and rebalancing delays. Past performance does not guarantee future results.
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
