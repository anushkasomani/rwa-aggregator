"use client";
import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import IntegrationsRibbon from "@/components/IntegrationsRibbon";
import TemplateGallery from "@/components/TemplateGallery";
import StrategyBuilder from "@/components/StrategyBuilder";
import BacktestResults from "@/components/BacktestResults";
import DocsSpotlight from "@/components/DocsSpotlight";
import VaultHeader from "@/components/VaultHeader";
import VaultCharts from "@/components/VaultCharts";
import RequestsReceipts from "@/components/RequestsReceipts";
import AgentActivity from "@/components/AgentActivity";
import YieldScanner from "@/components/YieldScanner";
import MinimalHero from "@/components/MinimalHero";
import Footer from "@/components/Footer";
import { useToast } from "@/components/toast/ToastProvider";

export default function Home() {
  const [prompt, setPrompt] = useState("equal-weight BTC/ETH, buy only if price > 20D MA, volume strong, sentiment positive");
  const { push } = useToast();

  return (
    <div>
      <Navbar />
      <main className="mx-auto w-[min(1200px,95%)] pb-24">
        <Hero
          value={prompt}
          onChange={setPrompt}
          onStart={() => push({ title: "Prompt captured", description: "You can preview plan or run backtest below.", tone: "success" })}
          onTemplates={() => document.getElementById("templates")?.scrollIntoView({ behavior: "smooth" })}
        />
        <div className="mt-6">
          <HowItWorks />
          <IntegrationsRibbon />
          <TemplateGallery onUse={(p)=> setPrompt(p)} />
          <StrategyBuilder />
          <BacktestResults />
          <DocsSpotlight />
          <VaultHeader />
          <VaultCharts />
          <RequestsReceipts />
          <AgentActivity />
          <YieldScanner />
          <MinimalHero />
        </div>
      </main>
      <Footer />
    </div>
  );
}
