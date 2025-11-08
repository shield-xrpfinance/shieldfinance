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
import Xumm from "xumm-sdk";
import { QRCodeSVG } from "qrcode.react";
import EthereumProvider from "@walletconnect/ethereum-provider";

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
  const [xamanPayload, setXamanPayload] = useState<any>(null);
  const { toast } = useToast();
  const { connect } = useWallet();

  useEffect(() => {
    if (!open) {
      setStep("select");
      setQrCodeUrl("");
      setXamanPayload(null);
      setConnecting(false);
    }
  }, [open]);

  const handleXamanConnect = async () => {
    setConnecting(true);
    setStep("xaman-qr");
    
    try {
      const xumm = new Xumm(import.meta.env.VITE_XUMM_API_KEY || "demo-api-key");
      
      const payload = await xumm.payload?.create({
        TransactionType: "SignIn",
      });

      if (payload?.refs?.qr_png) {
        setQrCodeUrl(payload.refs.qr_png);
        setXamanPayload(payload);

        const subscription = await xumm.payload?.subscribe(payload.uuid);
        
        if (subscription?.websocket) {
          subscription.websocket.onmessage = (message: any) => {
            const data = JSON.parse(message.data.toString());
            
            if (data.signed === true && data.payload_uuidv4 === payload.uuid) {
              xumm.payload?.get(payload.uuid).then((result: any) => {
                if (result?.response?.account) {
                  connect(result.response.account, "xaman");
                  if (onConnect) {
                    onConnect(result.response.account, "xaman");
                  }
                  onOpenChange(false);
                  toast({
                    title: "Wallet Connected",
                    description: `Connected to ${result.response.account.slice(0, 8)}...${result.response.account.slice(-6)}`,
                  });
                  setConnecting(false);
                }
              });
            } else if (data.signed === false) {
              toast({
                title: "Connection Rejected",
                description: "You rejected the sign-in request in Xaman",
                variant: "destructive",
              });
              setStep("select");
              setConnecting(false);
            }
          };
        }
      }
    } catch (error) {
      console.error("Xaman connection error:", error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Xaman wallet. Using demo mode.",
        variant: "destructive",
      });
      
      const mockAddress = "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH";
      setQrCodeUrl("demo");
      
      setTimeout(() => {
        connect(mockAddress, "xaman");
        if (onConnect) {
          onConnect(mockAddress, "xaman");
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

  const handleWalletConnect = async () => {
    setConnecting(true);
    setStep("walletconnect-qr");
    
    try {
      const provider = await EthereumProvider.init({
        projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "demo-project-id",
        chains: [1],
        showQrModal: true,
        qrModalOptions: {
          themeMode: "light",
        },
      });

      provider.on("display_uri", (uri: string) => {
        setQrCodeUrl(uri);
      });

      provider.on("connect", (info: any) => {
        const accounts = provider.accounts;
        if (accounts && accounts.length > 0) {
          connect(accounts[0], "walletconnect");
          if (onConnect) {
            onConnect(accounts[0], "walletconnect");
          }
          onOpenChange(false);
          toast({
            title: "Wallet Connected",
            description: `Connected to ${accounts[0].slice(0, 8)}...${accounts[0].slice(-6)}`,
          });
          setConnecting(false);
        }
      });

      provider.on("disconnect", () => {
        setStep("select");
        setConnecting(false);
      });

      await provider.connect();
    } catch (error) {
      console.error("WalletConnect error:", error);
      toast({
        title: "Connection Failed",
        description: "Failed to initialize WalletConnect. Using demo mode.",
        variant: "destructive",
      });
      
      const mockAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
      const mockUri = "wc:demo@2?relay-protocol=irn&symKey=demo";
      setQrCodeUrl(mockUri);
      
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
    setXamanPayload(null);
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
                    ? "Open Xaman app on your phone and scan the QR code to sign in"
                    : "Scan this QR code with your wallet app to connect"}
                </p>
              </div>
            </div>

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
