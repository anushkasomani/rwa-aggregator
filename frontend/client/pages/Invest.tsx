import { useEffect } from "react";
import { useExploreState } from "@/contexts/GlobalStateContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Invest() {
  const {
    filters,
    sort,
    items,
    loading,
    updateExplore
  } = useExploreState();

  useEffect(() => {
    loadVaults();
  }, [filters, sort]);

  const loadVaults = async () => {
    updateExplore({ loading: true });
    
    try {
      const qs = new URLSearchParams({
        theme: filters.theme,
        risk: filters.risk,
        chain: filters.chain,
        manager: filters.manager,
        yield: filters.yield,
        sort
      });
      
      const response = await fetch(`/api/vaults?${qs.toString()}`);
      const data = await response.json();
      
      updateExplore({ 
        items: data.items || [],
        loading: false 
      });
    } catch (error) {
      updateExplore({ 
        items: [],
        loading: false 
      });
      console.error('Failed to load vaults:', error);
    }
  };

  const handleCardClick = (vault: any) => {
    window.location.href = `/vault/${vault.id}`;
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Explore Strategies</h1>
        <p className="mt-2 text-gray-600">
          Discover and invest in tokenized real-world asset strategies
        </p>
      </div>

      {/* Filter Bar */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search strategies..."
                className="pl-10"
              />
            </div>
          </div>
          
          <Select 
            value={filters.theme} 
            onValueChange={(value) => updateExplore({ 
              filters: { ...filters, theme: value } 
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Themes</SelectItem>
              <SelectItem value="real-estate">Real Estate</SelectItem>
              <SelectItem value="commodities">Commodities</SelectItem>
              <SelectItem value="private-credit">Private Credit</SelectItem>
              <SelectItem value="infrastructure">Infrastructure</SelectItem>
            </SelectContent>
          </Select>

          <Select 
            value={filters.risk} 
            onValueChange={(value) => updateExplore({ 
              filters: { ...filters, risk: value } 
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risk</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>

          <Select 
            value={filters.chain} 
            onValueChange={(value) => updateExplore({ 
              filters: { ...filters, chain: value } 
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Chain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Chains</SelectItem>
              <SelectItem value="base">Base</SelectItem>
              <SelectItem value="ethereum">Ethereum</SelectItem>
              <SelectItem value="arbitrum">Arbitrum</SelectItem>
            </SelectContent>
          </Select>

          <Select 
            value={sort} 
            onValueChange={(value) => updateExplore({ sort: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ytd">YTD Return</SelectItem>
              <SelectItem value="d30">30D Return</SelectItem>
              <SelectItem value="aum">AUM</SelectItem>
              <SelectItem value="risk">Risk Level</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Strategy Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No strategies found</h3>
          <p className="text-gray-500">No strategies match your current filters</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => updateExplore({ 
              filters: {
                theme: 'all',
                risk: 'all',
                gates: [],
                yield: 'all',
                chain: 'all',
                manager: 'all'
              }
            })}
          >
            Clear Filters
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((vault: any) => (
            <Card 
              key={vault.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
              onClick={() => handleCardClick(vault)}
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
          ))}
        </div>
      )}
    </div>
  );
}
