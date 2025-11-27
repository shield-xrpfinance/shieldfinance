import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, ExternalLink, Loader2, QrCode, X, Beaker } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { QRCodeSVG } from "qrcode.react";
import UniversalProvider from "@walletconnect/universal-provider";
import { WalletConnectModal } from "@walletconnect/modal";
import { useAppKit, useAppKitAccount, useDisconnect } from "@reown/appkit/react";
import { getTooltipContent } from "@/lib/tooltipCopy";
import xamanIcon from "@assets/xaman-wallet-icon.svg";
import walletConnectLogo from "@assets/walletconnect-logo.svg";

function isXApp(): boolean {
  if (typeof window === "undefined") return false;
  const urlParams = new URLSearchParams(window.location.search);
  const hasXAppToken = !!urlParams.get("xAppToken");
  const hasReactNativeWebView = typeof (window as any).ReactNativeWebView !== "undefined";
  return hasXAppToken || hasReactNativeWebView;
}

interface ConnectWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect?: (address: string, provider: "xaman" | "walletconnect") => void;
}

type ConnectionStep = "select" | "xaman-qr";
type WalletType = "xrpl" | "evm";

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
  const { connect, disconnect, setDisconnectReown } = useWallet();
  const { isTestnet } = useNetwork();
  
  const { open: openReownModal } = useAppKit();
  const { address: reownAddress, isConnected: isReownConnected } = useAppKitAccount();
  const { disconnect: reownDisconnect } = useDisconnect();
  
  useEffect(() => {
    if (reownDisconnect) {
      setDisconnectReown(reownDisconnect);
    }
  }, [reownDisconnect, setDisconnectReown]);
  
  const wcModalRef = useRef<WalletConnectModal | null>(null);
  const wcProviderRef = useRef<UniversalProvider | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("select");
      setQrCodeUrl("");
      setXamanPayloadUuid(null);
      setXamanDeepLink("");
      setConnecting(false);
    }
  }, [open]);

  const prevConnectedRef = useRef(false);
  
  useEffect(() => {
    if (isReownConnected && reownAddress && !prevConnectedRef.current) {
      prevConnectedRef.current = true;
      connect(null, "reown", reownAddress, undefined);
      if (onConnect) {
        onConnect(reownAddress, "walletconnect");
      }
      setConnecting(false);
      toast({
        title: "Wallet Connected",
        description: `Connected to Flare (${isTestnet ? 'Coston2' : 'Mainnet'}): ${reownAddress.slice(0, 6)}...${reownAddress.slice(-4)}`,
      });
    } else if (!isReownConnected && prevConnectedRef.current) {
      prevConnectedRef.current = false;
    }
  }, [isReownConnected, reownAddress, connect, onConnect, toast, isTestnet]);

  // Poll Xaman payload status
  useEffect(() => {
    if (!xamanPayloadUuid || step !== "xaman-qr") return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/wallet/xaman/payload/${xamanPayloadUuid}`);
        const data = await response.json();

        if (data.signed && data.account) {
          clearInterval(pollInterval);
          // Xaman only provides XRPL address, no EVM address
          connect(data.account, "xaman", null, undefined);
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
    
    try {
      // Check if we're running inside Xaman xApp
      if (isXApp()) {
        console.log("Detected xApp environment - attempting direct connection");
        
        // Get the xAppToken from URL
        const urlParams = new URLSearchParams(window.location.search);
        const xAppToken = urlParams.get("xAppToken");
        
        if (xAppToken) {
          // Send OTT to backend for secure verification (API keys stay server-side)
          const authResponse = await fetch("/api/wallet/xaman/xapp-auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ xAppToken }),
          });
          
          const authData = await authResponse.json();
          
          if (authData.success && authData.account) {
            connect(authData.account, "xaman", null, undefined);
            if (onConnect) {
              onConnect(authData.account, "xaman");
            }
            onOpenChange(false);
            toast({
              title: "Wallet Connected",
              description: `Connected via xApp: ${authData.account.slice(0, 8)}...${authData.account.slice(-6)}`,
            });
            setConnecting(false);
            return;
          } else {
            console.log("xApp auth failed, falling back to QR:", authData.error);
          }
        }
      }
      
      // Standard QR code flow for browser
      setStep("xaman-qr");
      
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

  const handleEvmConnect = async () => {
    setConnecting(true);
    onOpenChange(false);
    
    try {
      await openReownModal();
    } catch (error) {
      console.error("Reown AppKit error:", error);
      setConnecting(false);
      toast({
        title: "Connection Failed",
        description: "Failed to open wallet modal. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleWalletConnect = async (walletType: WalletType) => {
    if (walletType === "evm") {
      return handleEvmConnect();
    }

    setConnecting(true);
    
    try {
      const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
      
      if (!projectId || projectId === "demo-project-id") {
        throw new Error("WalletConnect Project ID not configured");
      }

      // XRPL WalletConnect chain IDs: mainnet = xrpl:0, testnet = xrpl:1
      const xrplChainId = isTestnet ? "xrpl:1" : "xrpl:0";

      // Check if there's an existing session - if so, disconnect it first
      if (wcProviderRef.current?.session) {
        await wcProviderRef.current.disconnect();
        wcProviderRef.current = null;
        wcModalRef.current = null;
      }

      // Initialize WalletConnect Modal with the selected chain
      wcModalRef.current = new WalletConnectModal({
        projectId,
        chains: [xrplChainId],
        themeMode: "dark",
      });

      // Initialize Universal Provider
      wcProviderRef.current = await UniversalProvider.init({
        projectId,
        metadata: {
          name: "Shield Finance",
          description: "Earn yield on your XRP with liquid staking",
          url: window.location.origin,
          icons: [window.location.origin + "/favicon.ico"],
        },
      });

      const provider = wcProviderRef.current;

      // Set up display_uri listener
      provider.on("display_uri", (uri: string) => {
        wcModalRef.current?.openModal({ 
          uri,
          standaloneChains: [xrplChainId]
        });
      });

      // Set up session_delete listener
      provider.on("session_delete", () => {
        disconnect();
        setConnecting(false);
        wcProviderRef.current = null;
        wcModalRef.current?.closeModal();
      });

      // Close our shadcn dialog - WalletConnect modal will handle the UI
      onOpenChange(false);

      // XRPL wallet connection (Bifrost, etc.)
      await provider.connect({
        namespaces: {
          xrpl: {
            methods: [
              "xrpl_signTransaction",
              "xrpl_submitTransaction",
              "xrpl_getAccountInfo",
            ],
            chains: [xrplChainId],
            events: ["chainChanged", "accountsChanged"],
          },
        },
      });

      // Close the WalletConnect modal
      wcModalRef.current.closeModal();

      // Get connected XRPL accounts
      const xrplAccounts = provider.session?.namespaces?.xrpl?.accounts || [];
      let xrplAddress: string | null = null;
      
      if (xrplAccounts.length > 0) {
        // Format: "xrpl:1:rAddress..."
        xrplAddress = xrplAccounts[0].split(":")[2];
      }
      
      // Connect if address is available
      if (xrplAddress) {
        connect(xrplAddress, "walletconnect", null, provider);
        if (onConnect) {
          onConnect(xrplAddress, "walletconnect");
        }
        
        toast({
          title: "Wallet Connected",
          description: `Connected to XRPL (${isTestnet ? 'Testnet' : 'Mainnet'}): ${xrplAddress.slice(0, 8)}...${xrplAddress.slice(-6)}`,
        });
        
        setConnecting(false);
      } else {
        console.error("❌ No accounts found in WalletConnect session");
        toast({
          title: "Connection Failed",
          description: "Your wallet did not approve the connection. Please try again.",
          variant: "destructive",
        });
        setConnecting(false);
      }

    } catch (error) {
      console.error("WalletConnect error:", error);
      
      // Clean up on error
      wcModalRef.current?.closeModal();
      setConnecting(false);
      
      toast({
        title: "Connection Failed",
        description: "Failed to connect wallet. Please try again.",
        variant: "destructive",
      });
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
      // Use visibilitychange to detect if app opened successfully
      // This prevents showing a blank screen when the app isn't installed
      let opened = false;
      
      const handleVisibility = () => {
        if (document.visibilityState === 'hidden') {
          opened = true;
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibility);
      
      // Create a hidden link element and click it
      // This is more reliable than window.location.href for custom schemes
      const link = document.createElement('a');
      link.href = xamanDeepLink;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up listener and show toast if app didn't open
      setTimeout(() => {
        document.removeEventListener('visibilitychange', handleVisibility);
        if (!opened) {
          // App may not be installed or deep link failed
          // Don't show error - QR code is still visible for scanning
          console.log('Deep link may not have opened - user can scan QR code instead');
        }
      }, 2500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-connect-wallet">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {step === "select" ? "Connect Wallet" : "Xaman Connection"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "Choose a wallet provider to connect and start earning yield"}
            {step === "xaman-qr" && "Scan the QR code with your Xaman mobile app"}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && isTestnet && (
          <Alert className="border-chart-4 bg-chart-4/10" data-testid="alert-demo-mode">
            <Beaker className="h-4 w-4 text-chart-4" />
            <AlertDescription className="text-sm">
              <strong>Testnet Demo Mode</strong> - {getTooltipContent("demo", "wallet")}
            </AlertDescription>
          </Alert>
        )}

        {step === "select" && (
          <div className="space-y-3 py-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              XRPL Wallets (for XRP deposits)
            </div>
            
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={handleXamanConnect}
              disabled={connecting}
              data-testid="button-connect-xaman"
            >
              <div className="flex items-center gap-3 w-full">
                <div className="h-10 w-10 rounded-lg overflow-hidden flex items-center justify-center">
                  <img src={xamanIcon} alt="Xaman" className="h-10 w-10" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">Xaman (XUMM)</p>
                    <Badge variant="outline" className="text-xs">XRPL</Badge>
                  </div>
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
              onClick={() => handleWalletConnect("xrpl")}
              disabled={connecting}
              data-testid="button-connect-walletconnect-xrpl"
            >
              <div className="flex items-center gap-3 w-full">
                <div className="h-10 w-10 rounded-lg overflow-hidden flex items-center justify-center">
                  <img src={walletConnectLogo} alt="WalletConnect" className="h-10 w-10" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">Other XRPL Wallets</p>
                    <Badge variant="outline" className="text-xs">WalletConnect</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Bifrost, GemWallet, CrossMark & more
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>
            </Button>

            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 mt-4 pt-4 border-t">
              EVM Wallets (for Flare staking & swaps)
            </div>

            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => handleWalletConnect("evm")}
              disabled={connecting}
              data-testid="button-connect-walletconnect-evm"
            >
              <div className="flex items-center gap-3 w-full">
                <div className="h-10 w-10 rounded-lg overflow-hidden flex items-center justify-center">
                  <img src={walletConnectLogo} alt="WalletConnect" className="h-10 w-10" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">EVM Wallets</p>
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary">Flare</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    MetaMask, Trust Wallet, Rabby & more
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>
            </Button>

            <div className="text-xs text-muted-foreground text-center border-t pt-4 mt-2">
              Non-custodial wallet connections only
              {isTestnet && " • Testnet Mode Active"}
            </div>
          </div>
        )}

        {step === "xaman-qr" && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center justify-center space-y-4">
              {qrCodeUrl && qrCodeUrl !== "demo" ? (
                <div className="p-4 bg-white rounded-lg">
                  {qrCodeUrl.startsWith("http") ? (
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
                  Scan the QR code with your Xaman app to confirm
                </p>
              </div>
            </div>

            {xamanDeepLink && (
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
