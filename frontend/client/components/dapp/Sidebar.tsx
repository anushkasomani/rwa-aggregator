import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  PieChart,
  ArrowLeftRight,
  Banknote,
  TrendingUp,
  Coins,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Portfolio", icon: PieChart, path: "/app/portfolio" },
  { name: "Market", icon: ArrowLeftRight, path: "/app/market", subtitle: "Mint / Swap" },
  { name: "Borrow / Lend", icon: Banknote, path: "/app/lending" },
  { name: "Perps", icon: TrendingUp, path: "/app/perps" },
  { name: "Yield Market", icon: Coins, path: "/app/yield" },
  { name: "Activity", icon: Activity, path: "/app/activity" },
  { name: "Settings", icon: Settings, path: "/app/settings" },
];

const chains = [
  { name: "Base", active: true },
  { name: "ETH", active: false },
  { name: "Arbitrum", active: false },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();

  return (
    <div className={cn(
      "fixed left-0 top-0 h-full bg-white border-r border-gray-200 flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-gray-200">
        <div className="w-8 h-8 bg-gradient-to-r from-rwa-blue-500 to-rwa-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">R</span>
        </div>
        {!collapsed && (
          <span className="ml-3 text-lg font-semibold text-gray-900">RWA Hub</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex items-center h-14 px-3 rounded-lg transition-colors group",
                isActive 
                  ? "bg-rwa-blue-50 text-rwa-blue-700" 
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 flex-shrink-0",
                isActive ? "text-rwa-blue-700" : "text-gray-500"
              )} />
              {!collapsed && (
                <div className="ml-3 flex-1">
                  <div className="text-sm font-medium">{item.name}</div>
                  {item.subtitle && (
                    <div className="text-xs text-gray-500">{item.subtitle}</div>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Chain Selector */}
      <div className="p-4 border-t border-gray-200">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Network
            </div>
            <div className="flex flex-wrap gap-2">
              {chains.map((chain) => (
                <Button
                  key={chain.name}
                  variant={chain.active ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "text-xs h-7",
                    chain.active 
                      ? "bg-rwa-blue-600 hover:bg-rwa-blue-700" 
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {chain.name}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-8 h-8 bg-rwa-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">B</span>
            </div>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <div className="p-4 border-t border-gray-200">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="w-full justify-center p-2"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
