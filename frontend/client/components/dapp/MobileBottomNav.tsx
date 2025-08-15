import { Link, useLocation } from "react-router-dom";
import {
  PieChart,
  ArrowLeftRight,
  Banknote,
  TrendingUp,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Portfolio", icon: PieChart, path: "/app/portfolio", short: "Portfolio" },
  { name: "Market", icon: ArrowLeftRight, path: "/app/market", short: "Market" },
  { name: "Lending", icon: Banknote, path: "/app/lending", short: "Lend" },
  { name: "Perps", icon: TrendingUp, path: "/app/perps", short: "Perps" },
  { name: "Yield", icon: Coins, path: "/app/yield", short: "Yield" },
];

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="grid grid-cols-5 h-14">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
                          (item.path === "/app/portfolio" && location.pathname === "/app");
          
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center text-xs transition-colors",
                isActive 
                  ? "text-rwa-blue-600 bg-rwa-blue-50" 
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 mb-1",
                isActive ? "text-rwa-blue-600" : "text-gray-400"
              )} />
              <span className="text-xs font-medium">{item.short}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
