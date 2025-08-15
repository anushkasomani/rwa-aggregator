import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { Link } from "react-router-dom";

export function Navigation() {
  return (
    <nav className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-6 lg:px-12">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-r from-rwa-blue-500 to-rwa-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-lg">R</span>
        </div>
        <span className="text-xl font-semibold text-gray-900">RWA Hub</span>
      </div>

      {/* Center Menu */}
      <div className="hidden md:flex items-center gap-5">
        <Link to="/" className="text-gray-700 hover:text-gray-900 font-medium">
          Home
        </Link>
        <Link to="/docs" className="text-gray-700 hover:text-gray-900 font-medium">
          Docs
        </Link>
        <Link to="/blog" className="text-gray-700 hover:text-gray-900 font-medium">
          Blog
        </Link>
        <Link to="/governance" className="text-gray-700 hover:text-gray-900 font-medium">
          Governance
        </Link>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-4">
        <Link to="/app">
          <Button
            className="w-30 h-10 bg-rwa-blue-600 hover:bg-rwa-blue-700 text-white"
            size="sm"
          >
            Launch dApp
          </Button>
        </Link>
        <Button variant="ghost" size="sm" className="p-2">
          <Wallet className="w-5 h-5" />
        </Button>
      </div>
    </nav>
  );
}
