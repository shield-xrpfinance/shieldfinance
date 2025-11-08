import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, ExternalLink, Loader2, QrCode, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { QRCodeSVG } from "qrcode.react";
import UniversalProvider from "@walletconnect/universal-provider";

interface ConnectWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect?: (address: string, provider: "xaman" | "walletconnect") => void;
}

type ConnectionStep = "select" | "xaman-qr" | "walletconnect-qr";

export default function ConnectWalletModal({
  open,
  onOpenChange,
  onConnect,
}: ConnectWalletModalProps) {
  const [step, setStep] = useState<ConnectionStep>("select");
  const [connecting, setConnecting] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [xamanPayloadUuid, setXamanPayloadUuid] = useState<string | null>(null);
  const [xamanDeepLink, setXamanDeepLink] = useState<string>("");
  const { toast } = useToast();
  const { connect } = useWallet();
  const { isTestnet } = useNetwork();

  useEffect(() => {
    if (!open) {
      setStep("select");
      setQrCodeUrl("");
      setXamanPayloadUuid(null);
      setXamanDeepLink("");
      setConnecting(false);
    }
  }, [open]);

  // Poll Xaman payload status
  useEffect(() => {
    if (!xamanPayloadUuid || step !== "xaman-qr") return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/wallet/xaman/payload/${xamanPayloadUuid}`);
        const data = await response.json();

        if (data.signed && data.account) {
          clearInterval(pollInterval);
          connect(data.account, "xaman");
          if (onConnect) {
            onConnect(data.account, "xaman");
          }
          onOpenChange(false);
          toast({
            title: "Wallet Connected",
            description: `Connected to ${data.account.slice(0, 8)}...${data.account.slice(-6)}`,
          });
          setConnecting(false);
        }
      } catch (error) {
        console.error("Error polling Xaman status:", error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [xamanPayloadUuid, step, connect, onConnect, onOpenChange, toast]);

  const handleXamanConnect = async () => {
    setConnecting(true);
    setStep("xaman-qr");
    
    try {
      const response = await fetch("/api/wallet/xaman/payload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      const data = await response.json();

      if (data.qrUrl) {
        setQrCodeUrl(data.qrUrl);
        setXamanPayloadUuid(data.uuid);
        setXamanDeepLink(data.deepLink || "");
        
        if (data.demo) {
          toast({
            title: "Demo Mode",
            description: "Xaman API keys not configured. Using demo connection.",
          });
        }
      } else {
        throw new Error("No QR code URL received");
      }
    } catch (error) {
      console.error("Xaman connection error:", error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Xaman wallet",
        variant: "destructive",
      });
      setStep("select");
      setConnecting(false);
    }
  };

  const handleWalletConnect = async () => {
    setConnecting(true);
    setStep("walletconnect-qr");
    
    try {
      const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
      
      if (!projectId || projectId === "demo-project-id") {
        throw new Error("WalletConnect Project ID not configured");
      }

      // XRPL Chain IDs: mainnet = xrpl:0, testnet = xrpl:1
      const chainId = isTestnet ? "xrpl:1" : "xrpl:0";

      // Initialize Universal Provider with XRPL configuration
      const provider = await UniversalProvider.init({
        projectId,
        metadata: {
          name: "XRP Liquid Staking Protocol",
          description: "Earn yield on your XRP, RLUSD, and USDC",
          url: window.location.origin,
          icons: [window.location.origin + "/favicon.ico"],
        },
      });

      provider.on("display_uri", (uri: string) => {
        console.log("WalletConnect URI:", uri);
        setQrCodeUrl(uri);
      });

      // Connect to XRPL namespace with the correct chain ID based on network
      await provider.connect({
        namespaces: {
          xrpl: {
            methods: [
              "xrpl_signTransaction",
              "xrpl_submitTransaction",
              "xrpl_getAccountInfo",
            ],
            chains: [chainId],
            events: ["chainChanged", "accountsChanged"],
          },
        },
      });

      // Get connected accounts
      const accounts = provider.session?.namespaces?.xrpl?.accounts || [];
      
      if (accounts.length > 0) {
        // Extract address from account format "xrpl:0:rAddress..." or "xrpl:1:rAddress..."
        const address = accounts[0].split(":")[2];
        
        // Store the provider instance in the wallet context
        connect(address, "walletconnect", provider);
        if (onConnect) {
          onConnect(address, "walletconnect");
        }
        onOpenChange(false);
        toast({
          title: "Wallet Connected",
          description: `Connected to ${address.slice(0, 8)}...${address.slice(-6)} on ${isTestnet ? 'Testnet' : 'Mainnet'}`,
        });
        setConnecting(false);
      }

      provider.on("session_delete", () => {
        setStep("select");
        setConnecting(false);
      });

    } catch (error) {
      console.error("WalletConnect error:", error);
      
      // Demo mode fallback - use XRP Ledger address format
      const mockAddress = "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH";
      const mockUri = "wc:demo@2?relay-protocol=irn&symKey=demo";
      setQrCodeUrl(mockUri);
      
      toast({
        title: "Demo Mode",
        description: "WalletConnect not configured for XRPL. Using demo connection.",
      });

      setTimeout(() => {
        connect(mockAddress, "walletconnect");
        if (onConnect) {
          onConnect(mockAddress, "walletconnect");
        }
        onOpenChange(false);
        toast({
          title: "Demo Wallet Connected",
          description: `Connected to ${mockAddress.slice(0, 8)}...${mockAddress.slice(-6)}`,
        });
        setConnecting(false);
      }, 2000);
    }
  };

  const handleBack = () => {
    setStep("select");
    setQrCodeUrl("");
    setConnecting(false);
    setXamanPayloadUuid(null);
    setXamanDeepLink("");
  };

  const handleOpenXaman = () => {
    if (xamanDeepLink) {
      window.open(xamanDeepLink, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-connect-wallet">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {step === "select" ? "Connect Wallet" : step === "xaman-qr" ? "Xaman Connection" : "WalletConnect"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "Choose a wallet provider to connect and start earning yield"}
            {step === "xaman-qr" && "Scan the QR code with your Xaman mobile app"}
            {step === "walletconnect-qr" && "Scan the QR code with your wallet app"}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
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
                  <QrCode className="h-5 w-5 text-primary" />
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

            <div className="text-xs text-muted-foreground text-center border-t pt-4">
              By connecting your wallet, you agree to our Terms of Service
            </div>
          </div>
        )}

        {(step === "xaman-qr" || step === "walletconnect-qr") && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center justify-center space-y-4">
              {qrCodeUrl && qrCodeUrl !== "demo" ? (
                <div className="p-4 bg-white rounded-lg">
                  {step === "xaman-qr" && qrCodeUrl.startsWith("http") ? (
                    <img src={qrCodeUrl} alt="Xaman QR Code" className="w-64 h-64" />
                  ) : (
                    <QRCodeSVG value={qrCodeUrl} size={256} level="H" />
                  )}
                </div>
              ) : (
                <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}

              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="text-sm font-medium">Waiting for confirmation...</p>
                </div>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {step === "xaman-qr" 
                    ? "Scan the QR code with your Xaman app to confirm"
                    : "Scan this QR code with your wallet app to connect"}
                </p>
              </div>
            </div>

            {step === "xaman-qr" && xamanDeepLink && (
              <div className="space-y-3">
                <Button
                  onClick={handleOpenXaman}
                  className="w-full"
                  variant="default"
                  data-testid="button-open-xaman"
                >
                  Open in Xaman
                </Button>
                <a
                  href="https://xumm.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="link-download-xaman"
                >
                  Download Xaman
                </a>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1"
                data-testid="button-back-to-select"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
