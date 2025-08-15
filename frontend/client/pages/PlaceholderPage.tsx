import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export default function PlaceholderPage() {
  const location = useLocation();
  const pageName = location.pathname.replace('/', '').replace('-', ' ') || 'page';
  const capitalizedPageName = pageName.charAt(0).toUpperCase() + pageName.slice(1);

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      <div className="flex items-center justify-center min-h-[calc(100vh-80px-200px)] px-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl">🚧</span>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {capitalizedPageName} Coming Soon
          </h1>
          
          <p className="text-gray-600 mb-8">
            This {pageName} is under construction. We're working hard to bring you amazing features.
          </p>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Want to help us build this page? Continue prompting to add content here!
            </p>
            
            <Link to="/">
              <Button className="w-full">
                <ArrowLeft className="mr-2 w-4 h-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
