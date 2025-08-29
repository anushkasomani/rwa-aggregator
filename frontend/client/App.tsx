import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GlobalStateProvider } from "@/contexts/GlobalStateContext";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PlaceholderPage from "./pages/PlaceholderPage";
import { AppShell } from "./components/AppShell";
import { DAppLayout } from "./components/dapp/DAppLayout";
import Portfolio from "./pages/dapp/Portfolio";
import Market from "./pages/dapp/Market";
import Lending from "./pages/dapp/Lending";
import Perps from "./pages/dapp/Perps";
import Yield from "./pages/dapp/Yield";
import Activity from "./pages/dapp/Activity";
import Settings from "./pages/dapp/Settings";
import Swap from "./pages/dapp/Swap";
import Mint from "./pages/dapp/Mint";
import Baskets from "./pages/dapp/Baskets";
import DAppPage from "./pages/dapp/DAppPage";
import Invest from "./pages/Invest";
import Build from "./pages/Build";
import MyPortfolio from "./pages/MyPortfolio";
import Learn from "./pages/Learn";
import VaultDetail from "./pages/VaultDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <GlobalStateProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
          {/* Main App Routes with AppShell */}
          <Route path="/" element={<AppShell />}>
            <Route index element={<Invest />} />
            <Route path="invest" element={<Invest />} />
            <Route path="build" element={<Build />} />
            <Route path="portfolio" element={<MyPortfolio />} />
            <Route path="learn" element={<Learn />} />
            <Route path="vault/:id" element={<VaultDetail />} />
            {/* Additional dApp pages */}
            <Route path="mint" element={<Mint />} />
            <Route path="swap" element={<Swap />} />
            <Route path="baskets" element={<Baskets />} />
            <Route path="market" element={<Market />} />
            <Route path="lending" element={<Lending />} />
            <Route path="perps" element={<Perps />} />
            <Route path="yield" element={<Yield />} />
            <Route path="activity" element={<Activity />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Legacy dApp Routes */}
          <Route path="/app" element={<DAppLayout />}>
            <Route index element={<Portfolio />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="market" element={<Market />} />
            <Route path="mint" element={<Mint />} />
            <Route path="swap" element={<Swap />} />
            <Route path="baskets" element={<Baskets />} />
            <Route path="lending" element={<Lending />} />
            <Route path="perps" element={<Perps />} />
            <Route path="yield" element={<Yield />} />
            <Route path="activity" element={<Activity />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Legacy Index Page */}
          <Route path="/home" element={<Index />} />

          {/* Marketing Site Routes */}
          <Route path="/docs" element={<PlaceholderPage />} />
          <Route path="/blog" element={<PlaceholderPage />} />
          <Route path="/governance" element={<PlaceholderPage />} />
          <Route path="/mint" element={<PlaceholderPage />} />
          <Route path="/trade" element={<PlaceholderPage />} />
          <Route path="/lend" element={<PlaceholderPage />} />
          <Route path="/yield" element={<PlaceholderPage />} />
          <Route path="/proposals" element={<PlaceholderPage />} />
          <Route path="/voting" element={<PlaceholderPage />} />
          <Route path="/forum" element={<PlaceholderPage />} />
          <Route path="/audits" element={<PlaceholderPage />} />
          <Route path="/bug-bounty" element={<PlaceholderPage />} />
          <Route path="/security" element={<PlaceholderPage />} />
          <Route path="/discord" element={<PlaceholderPage />} />
          <Route path="/telegram" element={<PlaceholderPage />} />
          <Route path="/twitter" element={<PlaceholderPage />} />
          <Route path="/api" element={<PlaceholderPage />} />
          <Route path="/sdk" element={<PlaceholderPage />} />
          <Route path="/github" element={<PlaceholderPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </GlobalStateProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
