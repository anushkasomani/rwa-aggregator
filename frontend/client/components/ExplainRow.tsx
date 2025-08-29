import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExplainRowProps {
  asset: {
    asset: string;
    trend: boolean;
    volume: boolean;
    sentiment: number;
    current: number;
    target: number;
    excluded?: boolean;
    failedGate?: string;
  };
}

export function ExplainRow({ asset }: ExplainRowProps) {
  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 0.1) return "bg-green-500";
    if (sentiment < -0.1) return "bg-red-500";
    return "bg-gray-400";
  };

  const formatWeight = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getDrift = () => {
    return Math.abs(asset.current - asset.target);
  };

  const getDriftColor = (drift: number) => {
    if (drift > 0.05) return "text-red-600"; // High drift (>5%)
    if (drift > 0.02) return "text-yellow-600"; // Medium drift (>2%)
    return "text-green-600"; // Low drift
  };

  const drift = getDrift();

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-lg">{asset.asset}</span>
        {asset.excluded && (
          <Badge className="bg-red-100 text-red-800 text-xs">
            Excluded today: failed {asset.failedGate}
          </Badge>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        {/* Trend Gate */}
        <div className="flex items-center gap-2">
          {asset.trend ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )}
          <span>Trend (20D SMA)</span>
        </div>
        
        {/* Volume Gate */}
        <div className="flex items-center gap-2">
          {asset.volume ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )}
          <span>Volume &gt; 1.2×avg</span>
        </div>
        
        {/* Sentiment */}
        <div className="flex items-center gap-2">
          <div 
            className={cn(
              "w-4 h-4 rounded-full flex-shrink-0",
              getSentimentColor(asset.sentiment)
            )} 
          />
          <span>
            Sentiment: {asset.sentiment?.toFixed(2) || 'N/A'}
          </span>
        </div>
        
        {/* Weights */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span>Current/Target:</span>
            <span className="font-mono">
              {formatWeight(asset.current)} / {formatWeight(asset.target)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>Drift:</span>
            <span className={cn("font-mono", getDriftColor(drift))}>
              {formatWeight(drift)}
            </span>
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="mt-3 pt-3 border-t text-xs text-gray-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="font-medium">Next Rebalance Policy:</span>
            <span className="ml-2">
              {drift > 0.05 
                ? "Immediate (high drift)" 
                : drift > 0.02 
                ? "Next window (moderate drift)" 
                : "Scheduled (low drift)"
              }
            </span>
          </div>
          
          <div>
            <span className="font-medium">Gate Status:</span>
            <span className="ml-2">
              {asset.trend && asset.volume 
                ? "All gates passed" 
                : "Some gates failed"
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
