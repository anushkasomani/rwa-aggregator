import { useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Clock, AlertCircle, X } from "lucide-react";
import { useAppState } from "@/contexts/GlobalStateContext";
import { cn } from "@/lib/utils";

export function ReceiptsDrawer() {
  const { receiptsOpen, receipts, loadingReceipts, updateApp } = useAppState();

  useEffect(() => {
    if (receiptsOpen && !receipts.length && !loadingReceipts) {
      updateApp({ loadingReceipts: true });
      
      fetch('/api/me/receipts')
        .then(r => r.json())
        .then(j => {
          updateApp({ 
            receipts: j.items || [],
            loadingReceipts: false 
          });
        })
        .catch(e => { 
          updateApp({ 
            toast: { 
              type: 'error', 
              text: e.message || 'Failed to load receipts' 
            },
            loadingReceipts: false
          });
        });
    }
  }, [receiptsOpen, receipts.length, loadingReceipts, updateApp]);

  const handleClose = () => {
    updateApp({ receiptsOpen: false });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'IN_SETTLEMENT':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'CLAIMABLE':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'SETTLED':
        return <CheckCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'IN_SETTLEMENT':
        return 'bg-blue-100 text-blue-800';
      case 'CLAIMABLE':
        return 'bg-green-100 text-green-800';
      case 'SETTLED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const handleClaim = (vaultId: string, receiptId: string) => {
    fetch(`/api/vaults/${vaultId}/receipts/${receiptId}/claim`, { 
      method: 'POST' 
    })
      .then(r => r.json())
      .then(_ => {
        updateApp({ 
          toast: { type: 'success', text: 'Receipt claimed' }
        });
        // Refresh receipts
        return fetch('/api/me/receipts')
          .then(r => r.json())
          .then(j => {
            updateApp({ receipts: j.items || [] });
          });
      })
      .catch(e => { 
        updateApp({ 
          toast: { 
            type: 'error', 
            text: e.message || 'Claim failed' 
          }
        });
      });
  };

  return (
    <Sheet open={receiptsOpen} onOpenChange={handleClose}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            Receipts
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </SheetTitle>
          <SheetDescription>
            Track your deposit and withdrawal receipts
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {loadingReceipts ? (
            // Loading skeletons
            <>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </>
          ) : receipts.length === 0 ? (
            // Empty state
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No receipts yet</h3>
              <p className="text-gray-500">Your deposit and withdrawal receipts will appear here</p>
            </div>
          ) : (
            // Receipts list
            receipts.map((receipt: any) => (
              <div key={receipt.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(receipt.status)}
                    <span className="font-medium">{receipt.type}</span>
                  </div>
                  <Badge className={cn("text-xs", getStatusColor(receipt.status))}>
                    {receipt.status}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <div className="text-sm text-gray-600">
                    {receipt.vaultName || `Vault ${receipt.vaultId}`}
                  </div>
                  <div className="text-lg font-medium">
                    {receipt.amount} {receipt.asset}
                  </div>
                  {receipt.estimatedShares && (
                    <div className="text-sm text-gray-500">
                      Est. {receipt.estimatedShares} shares
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{new Date(receipt.createdAt).toLocaleDateString()}</span>
                  {receipt.status === 'CLAIMABLE' && (
                    <Button 
                      size="sm" 
                      onClick={() => handleClaim(receipt.vaultId, receipt.id)}
                    >
                      Claim
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
