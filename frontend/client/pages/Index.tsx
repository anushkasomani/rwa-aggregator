import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Globe, 
  Apple,
  Coins,
  BarChart3,
  Split,
  ChevronRight,
  Github,
  ExternalLink
} from "lucide-react";

export default function Index() {
  const metrics = [
    { label: "Total TVL", value: "$2.4B", icon: DollarSign },
    { label: "Active Users", value: "45.2K", icon: Users },
    { label: "Supported Chains", value: "8", icon: Globe },
    { label: "Yield Fixed", value: "$180M", icon: TrendingUp },
  ];

  const chains = [
    { name: "Polygon", logo: "P" },
    { name: "Base", logo: "B" },
    { name: "Arbitrum", logo: "A" },
    { name: "Ethereum", logo: "E" },
    { name: "Optimism", logo: "O" },
    { name: "Avalanche", logo: "AV" },
  ];

  const features = [
    {
      title: "Mint & Buy",
      description: "Tokenize real-world assets like stocks and bonds on-chain",
      icon: Apple,
    },
    {
      title: "Borrow & Lend",
      description: "Use your tokenized assets as collateral for DeFi lending",
      icon: Coins,
    },
    {
      title: "Trade Perps",
      description: "Trade perpetual futures on your favorite tokenized assets",
      icon: BarChart3,
    },
    {
      title: "Fix Yield",
      description: "Split tokens into Principal and Yield components",
      icon: Split,
    },
  ];

  const walkthrough = [
    "Mint tokenized Apple stock (AAPL-T)",
    "Deposit into smart account",
    "Borrow against your position",
    "Trade perps for additional exposure",
    "Fix yield with PT/YT splitting"
  ];

  const partners = [
    { name: "Foundry", logo: "F" },
    { name: "Next.js", logo: "N" },
    { name: "Chainlink", logo: "C" },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-rwa-dark-800 to-rwa-dark-900 text-white overflow-hidden">
        {/* Polygon Pattern Background */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%" viewBox="0 0 400 400" className="absolute inset-0">
            <defs>
              <pattern id="polygon-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <polygon points="20,5 35,15 35,25 20,35 5,25 5,15" fill="currentColor" fillOpacity="0.1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#polygon-pattern)" />
          </svg>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
              One dashboard for every{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                tokenized stock & bond
              </span>
            </h1>
            <p className="text-xl lg:text-2xl text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">
              Access real-world assets on-chain. Trade, lend, and earn yield on tokenized stocks, bonds, and commodities across multiple blockchains.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link to="/app">
                <Button size="lg" className="bg-rwa-blue-600 hover:bg-rwa-blue-700 text-white px-8 py-4 text-lg">
                  Launch dApp
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="border-gray-600 text-white hover:bg-white hover:text-gray-900 px-8 py-4 text-lg">
                Learn how it works <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </div>

            {/* Metrics Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {metrics.map((metric, index) => (
                <Card key={index} className="bg-white/10 backdrop-blur-sm border-white/20 p-6 text-center">
                  <metric.icon className="w-8 h-8 mx-auto mb-3 text-blue-400" />
                  <div className="text-2xl font-bold mb-1">{metric.value}</div>
                  <div className="text-sm text-gray-300">{metric.label}</div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Supported Chains Carousel */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <h2 className="text-center text-2xl font-semibold text-gray-900 mb-12">
            Supported Across Multiple Chains
          </h2>
          <div className="flex justify-center items-center gap-8 overflow-x-auto pb-4">
            {chains.map((chain, index) => (
              <div
                key={index}
                className="flex-shrink-0 w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center text-xl font-bold text-gray-700 hover:bg-gray-300 transition-colors"
              >
                {chain.logo}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What You Can Do Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              What You Can Do
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Unlock the full potential of real-world assets in DeFi
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="p-8 text-center hover:shadow-lg transition-shadow">
                <feature.icon className="w-12 h-12 mx-auto mb-6 text-rwa-blue-600" />
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Product Walkthrough Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 lg:p-12 text-white">
                <div className="bg-gray-700 rounded-lg p-6 mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-4 bg-gray-600 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-600 rounded w-1/2"></div>
                    <div className="h-8 bg-rwa-blue-600 rounded w-full"></div>
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">Smart Account Dashboard</h3>
                <p className="text-gray-300">Manage all your tokenized assets in one place</p>
              </div>
            </div>
            
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-8">
                From Token to Yield in 5 Steps
              </h2>
              <div className="space-y-6">
                {walkthrough.map((step, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-rwa-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                      {index + 1}
                    </div>
                    <p className="text-lg text-gray-700 pt-2">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Developer Section */}
      <section className="py-20 bg-rwa-dark-700 text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-5xl font-bold mb-8">
            Build on RWA Hub
          </h2>
          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
            Integrate tokenized real-world assets into your DeFi protocol with our developer tools
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button size="lg" variant="outline" className="border-gray-500 text-white hover:bg-white hover:text-gray-900">
              <ExternalLink className="mr-2 w-5 h-5" />
              Open Dev Docs
            </Button>
            <Button size="lg" variant="outline" className="border-gray-500 text-white hover:bg-white hover:text-gray-900">
              <Github className="mr-2 w-5 h-5" />
              View GitHub
            </Button>
          </div>

          <div className="flex justify-center items-center gap-12">
            {partners.map((partner, index) => (
              <div
                key={index}
                className="w-16 h-16 bg-gray-600 rounded-lg flex items-center justify-center text-xl font-bold text-white"
              >
                {partner.logo}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners/Backers Carousel */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <h2 className="text-center text-2xl font-semibold text-gray-900 mb-12">
            Trusted by Leading VCs and Partners
          </h2>
          <div className="flex justify-center items-center gap-12 overflow-x-auto pb-4">
            {['A16Z', 'Paradigm', 'USV', 'Coinbase', 'Binance'].map((partner, index) => (
              <div
                key={index}
                className="flex-shrink-0 w-32 h-16 bg-gray-100 rounded-lg flex items-center justify-center font-semibold text-gray-700"
              >
                {partner}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
