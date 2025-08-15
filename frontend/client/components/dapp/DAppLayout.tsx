import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileBottomNav } from "./MobileBottomNav";
import { cn } from "@/lib/utils";

const pageTitle: Record<string, string> = {
  "/app/portfolio": "Portfolio",
  "/app/market": "Market",
  "/app/lending": "Borrow / Lend",
  "/app/perps": "Perpetuals",
  "/app/yield": "Yield Market",
  "/app/activity": "Activity",
  "/app/settings": "Settings",
  "/app": "Dashboard",
};

export function DAppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  const currentTitle = pageTitle[location.pathname] || "Dashboard";

  return (
    <div className="h-screen bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Top Bar */}
      <TopBar
        sidebarCollapsed={sidebarCollapsed}
        pageTitle={currentTitle}
      />

      {/* Main Content */}
      <main
        className={cn(
          "pt-16 h-full overflow-auto transition-all duration-300",
          // Desktop margins
          "md:ml-60",
          sidebarCollapsed && "md:ml-16",
          // Mobile margins
          "pb-14 md:pb-0"
        )}
      >
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
