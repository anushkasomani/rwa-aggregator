import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Copy,
  Check,
  Shield,
  Smartphone,
  Monitor,
  Globe,
  Trash2,
  LogOut,
  Bell,
  Mail,
  MessageCircle,
  Settings as SettingsIcon,
  User,
  Lock,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("profile");
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    telegram: false,
    push: true,
  });

  const walletAddress = "0x12a4567890abcdef1234567890abcdef12345678";
  const ensName = "rwahub.eth";

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const activeSessions = [
    {
      id: 1,
      device: "Desktop",
      icon: Monitor,
      location: "New York, US",
      lastSeen: "Active now",
      isCurrent: true,
    },
    {
      id: 2,
      device: "Mobile",
      icon: Smartphone, 
      location: "New York, US",
      lastSeen: "2 hours ago",
      isCurrent: false,
    },
    {
      id: 3,
      device: "Desktop",
      icon: Monitor,
      location: "London, UK",
      lastSeen: "2 days ago", 
      isCurrent: false,
    },
  ];

  const tabItems = [
    { id: "profile", label: "Profile", icon: User },
    { id: "preferences", label: "Preferences", icon: SettingsIcon },
    { id: "security", label: "Security", icon: Shield },
    { id: "advanced", label: "Advanced", icon: Lock },
  ];

  return (
    <div className="flex gap-6 h-full">
      {/* Left Column - Vertical Tabs */}
      <div className="w-70">
        <Card className="p-1">
          <div className="space-y-1">
            {tabItems.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors",
                  activeTab === tab.id
                    ? "bg-rwa-blue-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Right Column - Tab Content */}
      <div className="flex-1 space-y-6">
        {activeTab === "profile" && (
          <>
            {/* Account Info */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Account Info</h3>
              
              <div className="space-y-6">
                {/* Wallet Address */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Wallet Address
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2 font-mono text-sm">
                      {walletAddress}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyAddress}
                      className="flex items-center gap-2"
                    >
                      {copiedAddress ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {copiedAddress ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                </div>

                {/* ENS Name */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    ENS Name
                  </label>
                  <Input
                    value={ensName}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>

                {/* KYC Status */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    KYC Status
                  </label>
                  <Badge className="bg-green-100 text-green-800">
                    <Check className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Notifications */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Notifications</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900">Email</div>
                      <div className="text-sm text-gray-500">Receive email updates about your account</div>
                    </div>
                  </div>
                  <Switch
                    checked={notifications.email}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, email: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900">Telegram</div>
                      <div className="text-sm text-gray-500">Get notifications via Telegram bot</div>
                    </div>
                  </div>
                  <Switch
                    checked={notifications.telegram}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, telegram: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900">Push</div>
                      <div className="text-sm text-gray-500">Browser push notifications</div>
                    </div>
                  </div>
                  <Switch
                    checked={notifications.push}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, push: checked })
                    }
                  />
                </div>
              </div>
            </Card>
          </>
        )}

        {activeTab === "security" && (
          <>
            {/* Session Management */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Session Management</h3>
              
              <div className="space-y-4">
                {activeSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <session.icon className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{session.device}</span>
                          {session.isCurrent && (
                            <Badge variant="outline" className="text-xs">Current</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{session.location}</div>
                        <div className="text-xs text-gray-400">Last seen: {session.lastSeen}</div>
                      </div>
                    </div>
                    
                    {!session.isCurrent && (
                      <Button variant="outline" size="sm" className="text-red-600 border-red-600 hover:bg-red-50">
                        Terminate
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Two-factor Authentication */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Two-factor Authentication</h3>
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 mb-1">Authenticator App</div>
                  <div className="text-sm text-gray-500">Secure your account with TOTP authentication</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-red-600">
                    Not Enabled
                  </Badge>
                  <Button>Setup 2FA</Button>
                </div>
              </div>
            </Card>

            {/* Danger Zone */}
            <Card className="p-6 border-red-200">
              <div className="flex items-center gap-2 mb-6">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-semibold text-red-900">Danger Zone</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                  <div>
                    <div className="font-medium text-red-900 mb-1">Disconnect Wallet</div>
                    <div className="text-sm text-red-700">This will log you out and disconnect your wallet</div>
                  </div>
                  <Button variant="outline" className="text-red-600 border-red-600 hover:bg-red-50">
                    <LogOut className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                  <div>
                    <div className="font-medium text-red-900 mb-1">Delete Smart Account</div>
                    <div className="text-sm text-red-700">Permanently delete your smart account and all associated data</div>
                  </div>
                  <Button variant="outline" className="text-red-600 border-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                </div>
              </div>
            </Card>
          </>
        )}

        {activeTab === "preferences" && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Preferences</h3>
            <div className="text-center py-12 text-gray-500">
              <SettingsIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <div className="font-medium mb-2">Preferences Coming Soon</div>
              <div className="text-sm">Theme, language, and display settings will be available here</div>
            </div>
          </Card>
        )}

        {activeTab === "advanced" && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Advanced Settings</h3>
            <div className="text-center py-12 text-gray-500">
              <Lock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <div className="font-medium mb-2">Advanced Settings Coming Soon</div>
              <div className="text-sm">Developer tools and advanced configuration options</div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
