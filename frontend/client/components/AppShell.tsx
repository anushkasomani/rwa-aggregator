import { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Receipt, Fuel, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppState } from "@/contexts/GlobalStateContext";
import { ReceiptsDrawer } from "./ReceiptsDrawer";

const navItems = [
  { name: "Invest", path: "/invest" },
  { name: "Build", path: "/build" },
  { name: "My Portfolio", path: "/portfolio" },
  { name: "Learn", path: "/learn" },
];

const additionalNavItems = [
  { name: "Mint", path: "/mint" },
  { name: "Swap", path: "/swap" },
  { name: "Baskets", path: "/baskets" },
  { name: "Market", path: "/market" },
  { name: "Lending", path: "/lending" },
  { name: "Perps", path: "/perps" },
  { name: "Yield", path: "/yield" },
  { name: "Activity", path: "/activity" },
  { name: "Settings", path: "/settings" },
];

export function AppShell() {
  const location = useLocation();
  const { receiptsOpen, updateApp } = useAppState();

  const handleReceiptsClick = () => {
    updateApp({ receiptsOpen: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-r from-rwa-blue-500 to-rwa-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">R</span>
              </div>
              <span className="ml-3 text-lg font-semibold text-gray-900">RWA Hub</span>
            </div>

            {/* Main Navigation */}
            <nav className="hidden md:flex space-x-8">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={cn(
                      "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-rwa-blue-100 text-rwa-blue-700"
                        : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                    )}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Right Side Controls */}
            <div className="flex items-center gap-2 md:gap-4">
              {/* Gas Tracker - Hidden on mobile */}
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
                <Fuel className="w-4 h-4" />
                <span>12 gwei</span>
              </div>

              {/* Network Chip */}
              <Badge variant="outline" className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="hidden sm:inline">Base</span>
                <span className="sm:hidden">B</span>
              </Badge>

              {/* Wallet Status */}
              <Badge className="bg-gray-100 text-gray-900 hover:bg-gray-200">
                <Wifi className="w-3 h-3 mr-1 md:mr-2" />
                <span className="hidden sm:inline">0x12a4...88F5</span>
                <span className="sm:hidden">Wallet</span>
              </Badge>

              {/* Receipts Button */}
              <Button 
                variant="outline" 
                size="sm" 
                className="hidden sm:flex items-center gap-2"
                onClick={handleReceiptsClick}
              >
                <Receipt className="w-4 h-4" />
                Receipts
              </Button>

              {/* Bell Icon */}
              <Button variant="ghost" size="sm" className="relative p-2">
                <Bell className="w-4 h-4 md:w-5 md:h-5" />
                <div className="absolute -top-1 -right-1 w-2 h-2 md:w-3 md:h-3 bg-red-500 rounded-full"></div>
              </Button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden border-t border-gray-200 px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={cn(
                    "block px-3 py-2 rounded-md text-base font-medium",
                    isActive
                      ? "bg-rwa-blue-100 text-rwa-blue-700"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
            
            {/* Additional Mobile Navigation */}
            <div className="border-t border-gray-200 mt-3 pt-3">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 px-3">
                More Features
              </div>
              {additionalNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={cn(
                      "block px-3 py-2 rounded-md text-sm font-medium",
                      isActive
                        ? "bg-rwa-blue-100 text-rwa-blue-700"
                        : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                    )}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* Mobile Receipts Button */}
            <Button
              variant="outline"
              size="sm"
              className="ml-3 mt-2 flex items-center gap-2"
              onClick={handleReceiptsClick}
            >
              <Receipt className="w-4 h-4" />
              Receipts
            </Button>
          </div>
        </div>

        {/* Secondary Navigation */}
        <div className="hidden md:block border-t border-gray-100 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-6 py-2">
              {additionalNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={cn(
                      "px-2 py-1 rounded text-xs font-medium transition-colors",
                      isActive
                        ? "bg-rwa-blue-100 text-rwa-blue-700"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    )}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Receipts Drawer */}
      <ReceiptsDrawer />
    </div>
  );
}
