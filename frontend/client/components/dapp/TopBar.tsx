import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Fuel, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopBarProps {
  sidebarCollapsed: boolean;
  pageTitle: string;
}

export function TopBar({ sidebarCollapsed, pageTitle }: TopBarProps) {
  return (
    <div
      className={cn(
        "fixed top-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 transition-all duration-300",
        // Desktop positioning
        "md:left-60",
        sidebarCollapsed && "md:left-16",
        // Mobile positioning
        "left-0 md:left-auto"
      )}
    >
      {/* Page Title */}
      <h1 className="text-xl font-semibold text-gray-900">
        {pageTitle}
      </h1>

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

        {/* Alerts Bell */}
        <Button variant="ghost" size="sm" className="relative p-2">
          <Bell className="w-4 h-4 md:w-5 md:h-5" />
          <div className="absolute -top-1 -right-1 w-2 h-2 md:w-3 md:h-3 bg-red-500 rounded-full"></div>
        </Button>
      </div>
    </div>
  );
}
