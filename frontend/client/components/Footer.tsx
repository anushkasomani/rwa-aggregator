import { Link } from "react-router-dom";
import { Twitter, MessageCircle, MessageSquare } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
        {/* Newsletter Banner */}
        <div className="bg-white rounded-xl p-8 mb-16 text-center border border-gray-200">
          <h3 className="text-2xl font-semibold text-gray-900 mb-4">
            Stay updated with RWA Hub
          </h3>
          <div className="flex justify-center gap-4 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 h-12 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rwa-blue-500"
            />
            <button className="w-28 h-12 bg-rwa-blue-600 hover:bg-rwa-blue-700 text-white rounded-lg font-medium">
              Subscribe
            </button>
          </div>
        </div>

        {/* Footer Links */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Applications</h4>
            <div className="space-y-3">
              <Link to="/mint" className="block text-gray-600 hover:text-gray-900">Mint Tokens</Link>
              <Link to="/trade" className="block text-gray-600 hover:text-gray-900">Trade</Link>
              <Link to="/lend" className="block text-gray-600 hover:text-gray-900">Lend</Link>
              <Link to="/yield" className="block text-gray-600 hover:text-gray-900">Fix Yield</Link>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Developers</h4>
            <div className="space-y-3">
              <Link to="/docs" className="block text-gray-600 hover:text-gray-900">Documentation</Link>
              <Link to="/github" className="block text-gray-600 hover:text-gray-900">GitHub</Link>
              <Link to="/api" className="block text-gray-600 hover:text-gray-900">API Reference</Link>
              <Link to="/sdk" className="block text-gray-600 hover:text-gray-900">SDK</Link>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Governance</h4>
            <div className="space-y-3">
              <Link to="/proposals" className="block text-gray-600 hover:text-gray-900">Proposals</Link>
              <Link to="/voting" className="block text-gray-600 hover:text-gray-900">Voting</Link>
              <Link to="/forum" className="block text-gray-600 hover:text-gray-900">Forum</Link>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Security</h4>
            <div className="space-y-3">
              <Link to="/audits" className="block text-gray-600 hover:text-gray-900">Audits</Link>
              <Link to="/bug-bounty" className="block text-gray-600 hover:text-gray-900">Bug Bounty</Link>
              <Link to="/security" className="block text-gray-600 hover:text-gray-900">Security</Link>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Community</h4>
            <div className="space-y-3">
              <Link to="/discord" className="block text-gray-600 hover:text-gray-900">Discord</Link>
              <Link to="/telegram" className="block text-gray-600 hover:text-gray-900">Telegram</Link>
              <Link to="/twitter" className="block text-gray-600 hover:text-gray-900">Twitter</Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-gray-200">
          <div className="flex items-center gap-6 mb-4 md:mb-0">
            <span className="text-gray-600">© 2024 RWA Hub</span>
            <span className="text-gray-600">rwahub.eth</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="text-gray-400 hover:text-gray-600">
              <Twitter className="w-5 h-5" />
            </a>
            <a href="#" className="text-gray-400 hover:text-gray-600">
              <MessageCircle className="w-5 h-5" />
            </a>
            <a href="#" className="text-gray-400 hover:text-gray-600">
              <MessageSquare className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
