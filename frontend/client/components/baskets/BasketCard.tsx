import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Info, TrendingUp } from "lucide-react";

interface BasketCardProps {
  basket: {
    id: string;
    name: string;
    subtitle: string;
    tags: string[];
    oneYearReturn: string;
    threeYearCAGR: string;
    volatility: string;
    yield: string;
    minInvest: string;
    isPositive: boolean;
  };
  onViewDetails: (basketId: string) => void;
  onInvest: (basketId: string) => void;
  onCompareChange: (basketId: string, checked: boolean) => void;
  isCompared: boolean;
}

export function BasketCard({ 
  basket, 
  onViewDetails, 
  onInvest, 
  onCompareChange, 
  isCompared 
}: BasketCardProps) {
  return (
    <Card className="p-5 h-fit hover:shadow-lg transition-shadow">
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {basket.name}
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            {basket.subtitle}
          </p>
          
          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {basket.tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">1Y Return</div>
            <div className={`text-sm font-medium ${basket.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {basket.oneYearReturn}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">3Y CAGR</div>
            <div className="text-sm font-medium text-gray-900">
              {basket.threeYearCAGR}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">Volatility</div>
            <div className="text-sm font-medium text-gray-900">
              {basket.volatility}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">Yield</div>
            <div className="text-sm font-medium text-gray-900">
              {basket.yield}
            </div>
          </div>
        </div>

        {/* Mini Sparkline Placeholder */}
        <div className="flex justify-end">
          <div className="w-30 h-10 bg-gray-100 rounded flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Min Invest */}
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <span>Min Invest: {basket.minInvest}</span>
          <Info className="w-3 h-3" />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`compare-${basket.id}`}
              checked={isCompared}
              onCheckedChange={(checked) => onCompareChange(basket.id, !!checked)}
            />
            <label 
              htmlFor={`compare-${basket.id}`}
              className="text-sm text-gray-600 cursor-pointer"
            >
              Compare
            </label>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onViewDetails(basket.id)}
            >
              View details
            </Button>
            <Button 
              size="sm"
              onClick={() => onInvest(basket.id)}
            >
              Invest
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
