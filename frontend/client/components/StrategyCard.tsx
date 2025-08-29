import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StrategyCardProps {
  vault: {
    id: string;
    title: string;
    subtitle: string;
    badges?: string[];
    risk: string;
    stats?: {
      pps?: number;
      d30?: number;
      ytd?: number;
      maxDD?: number;
      fees?: {
        mgmt?: string;
        perf?: string;
      };
    };
  };
  onClick?: (vault: StrategyCardProps['vault']) => void;
}

export function StrategyCard({ vault, onClick }: StrategyCardProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(vault);
    } else {
      window.location.href = `/vault/${vault.id}`;
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${(value * 100).toFixed(1)}%`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
      onClick={handleClick}
    >
      <CardHeader className="pb-4">
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">{vault.title}</h3>
          <p className="text-sm text-gray-600">{vault.subtitle}</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {vault.badges?.map((badge: string, index: number) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {badge}
            </Badge>
          ))}
          <Badge className={cn("text-xs", getRiskColor(vault.risk))}>
            {vault.risk} Risk
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-3">
            <div>
              <div className="text-gray-500 text-xs">PPS</div>
              <div className="font-mono font-medium">
                {formatCurrency(vault.stats?.pps || 1)}
              </div>
            </div>
            
            <div>
              <div className="text-gray-500 text-xs">YTD</div>
              <div className={cn(
                "font-mono font-medium flex items-center gap-1",
                (vault.stats?.ytd || 0) >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {(vault.stats?.ytd || 0) >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {formatPercentage(vault.stats?.ytd || 0)}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-gray-500 text-xs">30D</div>
              <div className={cn(
                "font-mono font-medium",
                (vault.stats?.d30 || 0) >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {formatPercentage(vault.stats?.d30 || 0)}
              </div>
            </div>
            
            <div>
              <div className="text-gray-500 text-xs">Max DD</div>
              <div className="font-mono font-medium text-red-600">
                {formatPercentage(vault.stats?.maxDD || 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t text-xs text-gray-500">
          <div className="flex justify-between">
            <span>Mgmt: {vault.stats?.fees?.mgmt || 'N/A'}</span>
            <span>Perf: {vault.stats?.fees?.perf || 'N/A'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
