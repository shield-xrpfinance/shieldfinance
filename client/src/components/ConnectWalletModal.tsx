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
import { Wallet, ExternalLink, Loader2, QrCode, X, Mail, Beaker, Info } from "lucide-react";
import { SiGoogle, SiFacebook, SiX, SiDiscord } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { QRCodeSVG } from "qrcode.react";
import UniversalProvider from "@walletconnect/universal-provider";
import { WalletConnectModal } from "@walletconnect/modal";
import { initWeb3Auth, loginWithWeb3Auth } from "@/lib/web3auth";
import { getTooltipContent } from "@/lib/tooltipCopy";

interface ConnectWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect?: (address: string, provider: "xaman" | "walletconnect" | "web3auth") => void;
}

type ConnectionStep = "select" | "xaman-qr";

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
  const { connect, disconnect } = useWallet();
  const { isTestnet } = useNetwork();
  
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
    
    try {
      const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
      
      if (!projectId || projectId === "demo-project-id") {
        throw new Error("WalletConnect Project ID not configured");
      }

      // XRPL WalletConnect chain IDs: mainnet = xrpl:0, testnet = xrpl:1
      const chainId = isTestnet ? "xrpl:1" : "xrpl:0";

      // Check if there's an existing session - if so, disconnect it first
      if (wcProviderRef.current?.session) {
        console.log("Disconnecting existing WalletConnect session");
        await wcProviderRef.current.disconnect();
        wcProviderRef.current = null;
        wcModalRef.current = null;
      }

      // Initialize WalletConnect Modal
      wcModalRef.current = new WalletConnectModal({
        projectId,
        chains: [chainId],
        themeMode: "light",
      });

      // Initialize Universal Provider
      wcProviderRef.current = await UniversalProvider.init({
        projectId,
        metadata: {
          name: "XRP Liquid Staking Protocol",
          description: "Earn yield on your XRP, RLUSD, and USDC",
          url: window.location.origin,
          icons: [window.location.origin + "/favicon.ico"],
        },
      });

      const provider = wcProviderRef.current;

      // Set up display_uri listener
      provider.on("display_uri", (uri: string) => {
        console.log("WalletConnect URI:", uri);
        // Show the WalletConnect modal with all wallet options (desktop, mobile, etc.)
        wcModalRef.current?.openModal({ 
          uri,
          standaloneChains: [chainId]
        });
      });

      // Set up session_delete listener
      provider.on("session_delete", () => {
        console.log("WalletConnect session deleted");
        disconnect();
        setConnecting(false);
        // Clean up refs
        wcProviderRef.current = null;
        wcModalRef.current?.closeModal();
      });

      // Close our shadcn dialog - WalletConnect modal will handle the UI
      onOpenChange(false);

      // Connect to BOTH XRPL and EVM (Flare Network) namespaces
      // This enables multi-chain wallets like Bifrost to connect to both networks
      const evmChainId = isTestnet ? "eip155:114" : "eip155:14"; // Coston2 testnet : Flare mainnet
      
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
          eip155: {
            methods: [
              "eth_sendTransaction",
              "eth_signTransaction",
              "eth_sign",
              "personal_sign",
              "eth_signTypedData",
            ],
            chains: [evmChainId],
            events: ["chainChanged", "accountsChanged"],
          },
        },
      });

      // Close the WalletConnect modal
      wcModalRef.current.closeModal();

      // Get connected accounts from BOTH namespaces
      const xrplAccounts = provider.session?.namespaces?.xrpl?.accounts || [];
      const evmAccounts = provider.session?.namespaces?.eip155?.accounts || [];
      
      console.log("WalletConnect connection complete:", {
        xrplAccounts,
        evmAccounts,
      });
      
      // Extract addresses from CAIP-10 format
      let xrplAddress: string | null = null;
      let evmAddress: string | null = null;
      
      if (xrplAccounts.length > 0) {
        // Format: "xrpl:0:rAddress..." or "xrpl:1:rAddress..."
        xrplAddress = xrplAccounts[0].split(":")[2];
      }
      
      if (evmAccounts.length > 0) {
        // Format: "eip155:14:0x..." or "eip155:114:0x..."
        evmAddress = evmAccounts[0].split(":")[2];
      }
      
      console.log("Extracted addresses:", {
        xrpl: xrplAddress,
        evm: evmAddress,
      });
      
      // Connect if at least one address is available
      if (xrplAddress || evmAddress) {
        // Store both addresses in the wallet context
        connect(xrplAddress, "walletconnect", evmAddress, provider);
        if (onConnect) {
          onConnect(xrplAddress || evmAddress || "", "walletconnect");
        }
        
        // Show connection success toast
        const addressDisplay = xrplAddress 
          ? `${xrplAddress.slice(0, 8)}...${xrplAddress.slice(-6)}`
          : evmAddress
          ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}`
          : "Unknown";
        
        const connectedChains = [];
        if (xrplAddress) connectedChains.push("XRPL");
        if (evmAddress) connectedChains.push("Flare");
        
        toast({
          title: "Wallet Connected",
          description: `Connected to ${addressDisplay} on ${connectedChains.join(" + ")} (${isTestnet ? 'Testnet' : 'Mainnet'})`,
        });
        setConnecting(false);
      } else {
        console.error("No accounts found in WalletConnect session");
        toast({
          title: "Connection Failed",
          description: "No accounts found. Please try again.",
          variant: "destructive",
        });
        setConnecting(false);
      }

    } catch (error) {
      console.error("WalletConnect error:", error);
      
      // Clean up on error
      wcModalRef.current?.closeModal();
      setConnecting(false);
      
      // Demo mode fallback - use XRP Ledger address format
      const mockAddress = "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH";
      
      toast({
        title: "Demo Mode",
        description: "WalletConnect not configured for XRPL. Using demo connection.",
      });

      setTimeout(() => {
        // Note: Demo mode doesn't have a real provider instance, so pass null
        // This means auto-payment won't work in demo mode (expected behavior)
        connect(mockAddress, "walletconnect", null, undefined);
        if (onConnect) {
          onConnect(mockAddress, "walletconnect");
        }
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

  const handleWeb3Auth = async () => {
    setConnecting(true);
    
    try {
      const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID;
      
      if (!clientId) {
        throw new Error("Web3Auth Client ID not configured");
      }

      // Note: Web3Auth Client ID is currently configured for testnet
      // Always pass "testnet" to match the Web3Auth project configuration
      await initWeb3Auth({
        clientId,
        network: "testnet",
      });

      // Close the ConnectWallet modal before opening Web3Auth modal
      // This prevents the dialog overlay from blocking Web3Auth interactions
      onOpenChange(false);
      
      // Give the dialog time to actually close before opening Web3Auth
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await loginWithWeb3Auth();

      if (result) {
        // Web3Auth provides XRPL address only, no EVM address
        connect(result.address, "web3auth", null, undefined);
        if (onConnect) {
          onConnect(result.address, "web3auth");
        }
        toast({
          title: "Wallet Connected",
          description: `Connected to ${result.address.slice(0, 8)}...${result.address.slice(-6)}`,
        });
        setConnecting(false);
      } else {
        throw new Error("Login cancelled or failed");
      }
    } catch (error) {
      console.error("Web3Auth error:", error);
      setConnecting(false);
      
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect with Web3Auth",
        variant: "destructive",
      });
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
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">Xaman (XUMM)</p>
                    {isTestnet && (
                      <Badge variant="outline" className="text-xs bg-chart-4/10 text-chart-4 border-chart-4">
                        Demo
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isTestnet 
                      ? "Testnet wallet connection - no real assets at risk"
                      : "Connect with Xaman mobile wallet"}
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
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">WalletConnect</p>
                    {isTestnet && (
                      <Badge variant="outline" className="text-xs bg-chart-4/10 text-chart-4 border-chart-4">
                        Demo
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isTestnet
                      ? "Demo mode - connects with testnet-compatible wallets"
                      : "Scan QR code with any compatible wallet"}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>
            </Button>

            <div className="relative flex items-center justify-center py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-muted" />
              </div>
              <div className="relative bg-background px-3">
                <span className="text-xs text-muted-foreground">OR</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={handleWeb3Auth}
              disabled={connecting}
              data-testid="button-connect-web3auth"
            >
              <div className="flex items-center gap-3 w-full">
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <SiGoogle className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">Social Login</p>
                    {isTestnet && (
                      <Badge variant="outline" className="text-xs bg-chart-4/10 text-chart-4 border-chart-4">
                        Demo
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isTestnet
                      ? "Demo wallet via social login - safe to test"
                      : "Sign in with Google, Facebook, Twitter, or Email"}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>
            </Button>

            <div className="text-xs text-muted-foreground text-center border-t pt-4">
              Self-custody wallet via Web3Auth • Non-custodial
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
