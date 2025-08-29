import { useBuilderState, useAppState } from "@/contexts/GlobalStateContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Code2,
  TrendingUp,
  Shield,
  CheckCircle,
  XCircle,
  Lock,
  Lightbulb,
  Rocket,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";

const examplePrompts = [
  "Create a balanced portfolio of tokenized real estate (40%) and commodities (60%) with monthly rebalancing",
  "Build a momentum strategy that buys trending crypto assets when volume exceeds 2x average",
  "Equal weight BTC and ETH with sentiment gates - exclude assets with negative sentiment scores",
  "Create a yield-focused strategy with 70% stablecoins and 30% yield-bearing tokens"
];

export default function Build() {
  const {
    text,
    loading,
    error,
    plan,
    preview,
    backtest,
    basketName,
    overrides,
    publish,
    publishing,
    updateBuilder
  } = useBuilderState();
  const { updateApp } = useAppState();

  const handleContinue = async () => {
    if (!text.trim()) {
      updateBuilder({ error: 'Describe your strategy' });
      return;
    }

    updateBuilder({ loading: true, error: null });

    try {
      // Parse the strategy text
      const parseResponse = await fetch('/api/strategy/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json();
        throw new Error(errorData.error || 'Parse failed');
      }

      const parsed = await parseResponse.json();

      // Get preview
      const previewResponse = await fetch('/api/strategy/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: parsed.plan })
      });

      if (!previewResponse.ok) {
        const errorData = await previewResponse.json();
        throw new Error(errorData.error || 'Preview failed');
      }

      const previewData = await previewResponse.json();

      updateBuilder({
        plan: parsed.plan,
        preview: previewData,
        backtest: previewData.backtest || null,
        basketName: parsed.suggestedName || 'New Strategy',
        overrides: {
          assets: previewData.assets,
          rebalancing: previewData.rebalancing,
          gates: previewData.gates,
          tradingWindows: previewData.tradingWindows,
          fees: previewData.fees
        },
        loading: false
      });
    } catch (err: any) {
      updateBuilder({ 
        error: err.message, 
        loading: false 
      });
    }
  };

  const handleRecompute = async () => {
    if (!plan || !preview) return;

    updateBuilder({ loading: true });

    try {
      const response = await fetch('/api/strategy/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, overrides })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Preview failed');
      }

      const previewData = await response.json();

      updateBuilder({
        preview: previewData,
        backtest: previewData.backtest || null,
        loading: false
      });
    } catch (err: any) {
      updateBuilder({ 
        error: err.message, 
        loading: false 
      });
    }
  };

  const handlePublish = async () => {
    if (!plan || !preview) {
      updateBuilder({ error: 'Nothing to publish' });
      return;
    }

    updateBuilder({ publishing: true });

    try {
      const response = await fetch('/api/vaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: basketName,
          plan,
          config: overrides,
          publish
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Publish failed');
      }

      const result = await response.json();
      
      updateApp({ 
        toast: { type: 'success', text: 'Vault created' } 
      });
      
      window.location.href = `/vault/${result.vaultId}`;
    } catch (err: any) {
      updateBuilder({ 
        error: err.message || 'Publish failed', 
        publishing: false 
      });
    }
  };

  const isSchemaValid = plan && preview && !error;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Strategy Builder</h1>
        <p className="mt-2 text-gray-600">
          Describe your investment strategy in natural language and we'll build it for you
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Prompt Input */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                Describe Your Strategy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="strategy-text">Strategy Description</Label>
                <Textarea
                  id="strategy-text"
                  placeholder="Describe your investment strategy..."
                  value={text}
                  onChange={(e) => updateBuilder({ text: e.target.value })}
                  className="min-h-[200px] mt-2"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-600">Example prompts:</Label>
                <div className="mt-2 space-y-2">
                  {examplePrompts.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => updateBuilder({ text: example })}
                      className="block w-full text-left p-3 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                </div>
              )}

              <Button 
                onClick={handleContinue}
                disabled={loading || !text.trim()}
                className="w-full"
              >
                {loading ? 'Processing...' : 'Continue'}
              </Button>
            </CardContent>
          </Card>

          {/* Publish Panel */}
          {plan && preview && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="w-5 h-5" />
                  Publish Strategy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="basket-name">Strategy Name</Label>
                  <Input
                    id="basket-name"
                    value={basketName}
                    onChange={(e) => updateBuilder({ basketName: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="chain">Chain</Label>
                    <Select 
                      value={publish.chain}
                      onValueChange={(value) => updateBuilder({ 
                        publish: { ...publish, chain: value } 
                      })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="base">Base</SelectItem>
                        <SelectItem value="ethereum">Ethereum</SelectItem>
                        <SelectItem value="arbitrum">Arbitrum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="asset">Accounting Asset</Label>
                    <Select 
                      value={publish.asset}
                      onValueChange={(value) => updateBuilder({ 
                        publish: { ...publish, asset: value } 
                      })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USDC">USDC</SelectItem>
                        <SelectItem value="USDT">USDT</SelectItem>
                        <SelectItem value="ETH">ETH</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  onClick={handlePublish}
                  disabled={publishing || !basketName.trim()}
                  className="w-full"
                >
                  {publishing ? 'Publishing...' : 'Publish Strategy'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Live Preview */}
        <div className="space-y-6">
          {/* Parsed DSL JSON */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="w-5 h-5" />
                Parsed Strategy
                {isSchemaValid && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : plan ? (
                <pre className="text-xs bg-green-50 p-4 rounded-lg overflow-auto max-h-48">
                  {JSON.stringify(plan, null, 2)}
                </pre>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Code2 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <div>Strategy will appear here</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Backtest Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Backtest Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-48 w-full" />
              ) : backtest ? (
                <div className="space-y-4">
                  <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <div className="text-gray-500">Backtest Chart</div>
                      <div className="text-sm text-gray-400">
                        {backtest.totalReturn ? 
                          `Total Return: ${(backtest.totalReturn * 100).toFixed(1)}%` :
                          'Chart will be rendered here'
                        }
                      </div>
                    </div>
                  </div>
                  
                  {backtest.stats && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">Sharpe Ratio</div>
                        <div className="font-mono font-medium">
                          {backtest.stats.sharpe?.toFixed(2) || 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Max Drawdown</div>
                        <div className="font-mono font-medium text-red-600">
                          {backtest.stats.maxDrawdown ? 
                            `${(backtest.stats.maxDrawdown * 100).toFixed(1)}%` : 
                            'N/A'
                          }
                        </div>
                      </div>
                    </div>
                  )}

                  {preview && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleRecompute}
                      disabled={loading}
                      className="w-full"
                    >
                      Recompute
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <div>Backtest results will appear here</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Guardrails Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Guardrails
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Non-negotiable guardrails */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Lock className="w-3 h-3 text-gray-400" />
                    <span>±5 p.p. drift band</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Lock className="w-3 h-3 text-gray-400" />
                    <span>≤15% turnover per rebalance</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Lock className="w-3 h-3 text-gray-400" />
                    <span>slippage ≤ 80 bps</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Lock className="w-3 h-3 text-gray-400" />
                    <span>max weight 40% (hard cap 50%)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Lock className="w-3 h-3 text-gray-400" />
                    <span>cooldown 6h</span>
                  </div>
                </div>

                {/* Dynamic guardrails from strategy */}
                {preview?.guardrails && (
                  <div className="border-t pt-3 space-y-2">
                    {Object.entries(preview.guardrails).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                        <Badge variant="outline" className="text-xs">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {!preview && (
                  <div className="text-center py-6 text-gray-500">
                    <Shield className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <div className="text-sm">Strategy guardrails will appear here</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
