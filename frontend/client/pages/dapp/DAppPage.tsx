import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "react-router-dom";

export default function DAppPage() {
  const location = useLocation();
  const pageName = location.pathname.split('/').pop() || 'page';
  const capitalizedPageName = pageName.charAt(0).toUpperCase() + pageName.slice(1).replace('-', ' & ');

  const getPageDescription = () => {
    switch (pageName) {
      case 'lending':
        return "Borrow against your tokenized assets or lend to earn yield";
      case 'perps':
        return "Trade perpetual futures on tokenized real-world assets";
      case 'yield':
        return "Fix your yield by splitting tokens into Principal and Yield components";
      case 'activity':
        return "View your transaction history and portfolio activity";
      case 'settings':
        return "Manage your account preferences and dApp settings";
      default:
        return "This feature is coming soon to RWA Hub";
    }
  };

  const getPageIcon = () => {
    switch (pageName) {
      case 'lending':
        return "💰";
      case 'perps':
        return "📈";
      case 'yield':
        return "🌾";
      case 'activity':
        return "📊";
      case 'settings':
        return "⚙️";
      default:
        return "🚧";
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl">{getPageIcon()}</span>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          {capitalizedPageName}
        </h1>
        
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
          {getPageDescription()}
        </p>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            We're building this feature! Continue prompting to help us develop the {capitalizedPageName.toLowerCase()} interface.
          </p>
          
          <div className="flex gap-4 justify-center">
            <Button variant="outline">
              Request Feature
            </Button>
            <Button>
              Back to Portfolio
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
