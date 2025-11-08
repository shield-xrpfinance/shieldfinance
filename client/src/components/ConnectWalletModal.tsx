import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/lib/walletContext";

interface ConnectWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect?: (address: string, provider: "xaman" | "walletconnect") => void;
}

export default function ConnectWalletModal({
  open,
  onOpenChange,
  onConnect,
}: ConnectWalletModalProps) {
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();
  const { connect } = useWallet();

  const handleXamanConnect = async () => {
    setConnecting(true);
    try {
      const mockAddress = "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH";
      
      toast({
        title: "Xaman Connection",
        description: "Opening Xaman wallet for approval...",
      });

      setTimeout(() => {
        connect(mockAddress, "xaman");
        if (onConnect) {
          onConnect(mockAddress, "xaman");
        }
        onOpenChange(false);
        toast({
          title: "Wallet Connected",
          description: `Connected to ${mockAddress.slice(0, 8)}...${mockAddress.slice(-6)}`,
        });
        setConnecting(false);
      }, 1500);
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Xaman wallet",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const handleWalletConnect = async () => {
    setConnecting(true);
    try {
      const mockAddress = "rP9jPyP5kyvFRb6ZiRghAGw5u8SGAmU4bd";
      
      toast({
        title: "WalletConnect",
        description: "Scan QR code with your wallet...",
      });

      setTimeout(() => {
        connect(mockAddress, "walletconnect");
        if (onConnect) {
          onConnect(mockAddress, "walletconnect");
        }
        onOpenChange(false);
        toast({
          title: "Wallet Connected",
          description: `Connected to ${mockAddress.slice(0, 8)}...${mockAddress.slice(-6)}`,
        });
        setConnecting(false);
      }, 1500);
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect via WalletConnect",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-connect-wallet">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Connect Wallet
          </DialogTitle>
          <DialogDescription>
            Choose a wallet provider to connect and start earning yield
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={handleXamanConnect}
            disabled={connecting}
            data-testid="button-connect-xaman"
          >
            <div className="flex items-center gap-3 w-full">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold">Xaman (XUMM)</p>
                <p className="text-xs text-muted-foreground">
                  Connect with Xaman mobile wallet
                </p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={handleWalletConnect}
            disabled={connecting}
            data-testid="button-connect-walletconnect"
          >
            <div className="flex items-center gap-3 w-full">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold">WalletConnect</p>
                <p className="text-xs text-muted-foreground">
                  Scan QR code with any compatible wallet
                </p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </div>
          </Button>
        </div>

        <div className="text-xs text-muted-foreground text-center border-t pt-4">
          By connecting your wallet, you agree to our Terms of Service
        </div>
      </DialogContent>
    </Dialog>
  );
}
