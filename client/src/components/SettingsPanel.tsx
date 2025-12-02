import { useState, useMemo } from "react";
import {
  Settings,
  Wallet,
  Globe,
  Coins,
  Copy,
  ExternalLink,
  Key,
  Plus,
  Pencil,
  ChevronDown,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  NetworkId,
  BridgeTokenId,
  NETWORKS,
  BRIDGE_TOKENS,
} from "@shared/bridgeConfig";
import { useSettings } from "@/lib/settingsContext";
import { useWallet } from "@/lib/walletContext";
import { useToast } from "@/hooks/use-toast";

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NETWORK_ICONS: Record<NetworkId, typeof Globe> = {
  ethereum: Globe,
  base: Globe,
  optimism: Globe,
  arbitrum: Globe,
  polygon: Globe,
  flare: Globe,
  hyperevm: Globe,
  plasma: Globe,
  xrpl: Globe,
};

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const { toast } = useToast();
  const { address: xrplAddress, evmAddress, isConnected } = useWallet();
  const {
    wallets,
    enabledNetworks,
    enabledTokens,
    toggleNetwork,
    toggleToken,
    addWallet,
    removeWallet,
    updateWalletLabel,
    isLoading,
  } = useSettings();
  
  const [expandedTokenNetworks, setExpandedTokenNetworks] = useState<string[]>([]);
  const [togglingNetwork, setTogglingNetwork] = useState<string | null>(null);
  const [togglingToken, setTogglingToken] = useState<string | null>(null);
  
  const [addWalletDialogOpen, setAddWalletDialogOpen] = useState(false);
  const [editWalletDialogOpen, setEditWalletDialogOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<{ id: string; label: string } | null>(null);
  const [newWalletForm, setNewWalletForm] = useState({ walletType: "evm" as "evm" | "xrpl", address: "", label: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast({
      title: "Address copied",
      description: "The address has been copied to your clipboard.",
    });
  };

  const handleToggleNetwork = async (networkId: NetworkId) => {
    const isCurrentlyEnabled = enabledNetworks.includes(networkId);
    setTogglingNetwork(networkId);
    try {
      await toggleNetwork(networkId, !isCurrentlyEnabled);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update network preference.",
        variant: "destructive",
      });
    } finally {
      setTogglingNetwork(null);
    }
  };

  const handleToggleToken = async (networkId: NetworkId, tokenId: BridgeTokenId) => {
    const networkTokens = enabledTokens[networkId] || [];
    const isCurrentlyEnabled = networkTokens.includes(tokenId);
    const key = `${networkId}-${tokenId}`;
    setTogglingToken(key);
    try {
      await toggleToken(networkId, tokenId, !isCurrentlyEnabled);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update token preference.",
        variant: "destructive",
      });
    } finally {
      setTogglingToken(null);
    }
  };

  const toggleTokenNetwork = (networkId: string) => {
    setExpandedTokenNetworks((prev) => {
      if (prev.includes(networkId)) {
        return prev.filter((id) => id !== networkId);
      }
      return [...prev, networkId];
    });
  };

  const enabledNetworkCount = enabledNetworks.length;
  const enabledTokenCount = Object.values(enabledTokens).reduce(
    (acc, tokens) => acc + tokens.length,
    0
  );

  const truncateAddress = (address: string, chars = 6) =>
    `${address.slice(0, chars)}...${address.slice(-4)}`;

  const displayWallets = useMemo(() => {
    if (!isConnected) return [];
    
    const connectedAddresses = new Set<string>();
    const result: Array<{
      id: string;
      label: string;
      isActive: boolean;
      isConnected: boolean;
      evmAddress?: string;
      xrpAddress?: string;
    }> = [];
    
    if (evmAddress) connectedAddresses.add(evmAddress.toLowerCase());
    if (xrplAddress) connectedAddresses.add(xrplAddress.toLowerCase());
    
    if (evmAddress || xrplAddress) {
      result.push({
        id: "connected",
        label: "Connected Wallet",
        isActive: true,
        isConnected: true,
        evmAddress: evmAddress || undefined,
        xrpAddress: xrplAddress || undefined,
      });
    }
    
    wallets.forEach((w) => {
      const walletAddr = w.address.toLowerCase();
      if (!connectedAddresses.has(walletAddr)) {
        result.push({
          id: w.id,
          label: w.label || "Wallet",
          isActive: w.isPrimary,
          isConnected: false,
          evmAddress: w.walletType === "evm" ? w.address : undefined,
          xrpAddress: w.walletType === "xrpl" ? w.address : undefined,
        });
      }
    });
    
    return result;
  }, [isConnected, evmAddress, xrplAddress, wallets]);

  const handleAddWallet = async () => {
    if (!newWalletForm.address.trim()) {
      toast({
        title: "Error",
        description: "Please enter a wallet address.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await addWallet({
        walletType: newWalletForm.walletType,
        address: newWalletForm.address.trim(),
        label: newWalletForm.label.trim() || undefined,
      });
      toast({
        title: "Wallet added",
        description: "The wallet has been added successfully.",
      });
      setAddWalletDialogOpen(false);
      setNewWalletForm({ walletType: "evm", address: "", label: "" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add wallet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditWallet = (walletId: string, currentLabel: string) => {
    setEditingWallet({ id: walletId, label: currentLabel || "" });
    setEditWalletDialogOpen(true);
  };

  const handleSaveWalletLabel = async () => {
    if (!editingWallet) return;
    
    setIsSubmitting(true);
    try {
      await updateWalletLabel(editingWallet.id, editingWallet.label);
      toast({
        title: "Wallet updated",
        description: "The wallet label has been updated successfully.",
      });
      setEditWalletDialogOpen(false);
      setEditingWallet(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update wallet label. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveWallet = async (walletId: string) => {
    try {
      await removeWallet(walletId);
      toast({
        title: "Wallet removed",
        description: "The wallet has been removed successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove wallet. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto"
        data-testid="settings-panel"
      >
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </SheetTitle>
          <SheetDescription>
            Manage your wallets, networks, and tokens
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8" data-testid="settings-loading">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isConnected && !isLoading && (
          <div className="text-center py-8 text-muted-foreground" data-testid="settings-not-connected">
            Connect your wallet to manage settings
          </div>
        )}

        <Accordion
          type="multiple"
          defaultValue={["wallets", "networks", "tokens"]}
          className="w-full"
        >
          <AccordionItem value="wallets" data-testid="accordion-wallets">
            <AccordionTrigger
              className="hover:no-underline"
              data-testid="accordion-trigger-wallets"
            >
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                <span>Wallets</span>
                <Badge variant="secondary" className="ml-2">
                  {displayWallets.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                {displayWallets.map((wallet) => (
                  <div
                    key={wallet.id}
                    className="rounded-lg border p-3 space-y-3"
                    data-testid={`wallet-item-${wallet.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{wallet.label}</span>
                        {!wallet.isConnected && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleEditWallet(wallet.id, wallet.label)}
                            data-testid={`button-edit-wallet-${wallet.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {wallet.isConnected && (
                          <Badge
                            variant="default"
                            data-testid={`badge-connected-${wallet.id}`}
                          >
                            Connected
                          </Badge>
                        )}
                        {wallet.isActive && !wallet.isConnected && (
                          <Badge
                            variant="secondary"
                            data-testid={`badge-active-${wallet.id}`}
                          >
                            Primary
                          </Badge>
                        )}
                        {!wallet.isConnected && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveWallet(wallet.id)}
                            data-testid={`button-remove-wallet-${wallet.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {wallet.evmAddress && (
                      <div className="flex items-center justify-between py-2 px-3 rounded bg-muted/50">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-medium">
                            EVM
                          </span>
                          <span className="text-sm font-mono">
                            {truncateAddress(wallet.evmAddress)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleCopyAddress(wallet.evmAddress!)}
                            data-testid={`button-copy-evm-${wallet.id}`}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            data-testid={`button-external-evm-${wallet.id}`}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {wallet.xrpAddress && (
                      <div className="flex items-center justify-between py-2 px-3 rounded bg-muted/50">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-medium">
                            XRP
                          </span>
                          <span className="text-sm font-mono">
                            {truncateAddress(wallet.xrpAddress)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleCopyAddress(wallet.xrpAddress!)}
                            data-testid={`button-copy-xrp-${wallet.id}`}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            data-testid={`button-external-xrp-${wallet.id}`}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setAddWalletDialogOpen(true)}
                  data-testid="button-add-wallet"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Wallet
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="networks" data-testid="accordion-networks">
            <AccordionTrigger
              className="hover:no-underline"
              data-testid="accordion-trigger-networks"
            >
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>Networks</span>
                <Badge variant="secondary" className="ml-2">
                  {enabledNetworkCount}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {Object.values(NETWORKS)
                  .filter((network) => network.isMainnetReady)
                  .map((network) => {
                    const NetworkIcon = NETWORK_ICONS[network.id];
                    const isEnabled = enabledNetworks.includes(network.id);

                    return (
                      <div
                        key={network.id}
                        className="flex items-center justify-between py-2 px-3 rounded border"
                        data-testid={`network-item-${network.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: `${network.color}20` }}
                          >
                            <NetworkIcon
                              className="h-4 w-4"
                              style={{ color: network.color }}
                            />
                          </div>
                          <div>
                            <span className="font-medium">{network.name}</span>
                            <span className="text-xs text-muted-foreground block">
                              {network.shortName}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            data-testid={`button-edit-network-${network.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={() =>
                              handleToggleNetwork(network.id)
                            }
                            data-testid={`switch-network-${network.id}`}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="tokens" data-testid="accordion-tokens">
            <AccordionTrigger
              className="hover:no-underline"
              data-testid="accordion-trigger-tokens"
            >
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4" />
                <span>Tokens</span>
                <Badge variant="secondary" className="ml-2">
                  {enabledTokenCount}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {Object.values(NETWORKS)
                  .filter((network) => network.isMainnetReady)
                  .map((network) => {
                    const networkTokens = Object.values(BRIDGE_TOKENS).filter(
                      (token) => token.addresses[network.id] !== undefined
                    );

                    if (networkTokens.length === 0) return null;

                    const isExpanded = expandedTokenNetworks.includes(
                      network.id
                    );
                    const enabledCount = (
                      enabledTokens[network.id] || []
                    ).length;

                    return (
                      <Collapsible
                        key={network.id}
                        open={isExpanded}
                        onOpenChange={() => toggleTokenNetwork(network.id)}
                      >
                        <CollapsibleTrigger
                          className="flex items-center justify-between w-full py-2 px-3 rounded border hover-elevate"
                          data-testid={`collapsible-trigger-tokens-${network.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: `${network.color}20` }}
                            >
                              <Globe
                                className="h-3 w-3"
                                style={{ color: network.color }}
                              />
                            </div>
                            <span className="font-medium text-sm">
                              {network.name}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {enabledCount}/{networkTokens.length}
                            </Badge>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 ml-4 space-y-1">
                            {networkTokens.map((token) => {
                              const isTokenEnabled = (
                                enabledTokens[network.id] || []
                              ).includes(token.id);

                              return (
                                <div
                                  key={token.id}
                                  className="flex items-center justify-between py-2 px-3 rounded bg-muted/30"
                                  data-testid={`token-item-${network.id}-${token.id}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-6 h-6 rounded-full flex items-center justify-center"
                                      style={{
                                        backgroundColor: `${token.color}20`,
                                      }}
                                    >
                                      <Coins
                                        className="h-3 w-3"
                                        style={{ color: token.color }}
                                      />
                                    </div>
                                    <span className="text-sm font-medium">
                                      {token.symbol}
                                    </span>
                                  </div>
                                  <Switch
                                    checked={isTokenEnabled}
                                    onCheckedChange={() =>
                                      handleToggleToken(network.id, token.id)
                                    }
                                    data-testid={`switch-token-${network.id}-${token.id}`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SheetContent>

      <Dialog open={addWalletDialogOpen} onOpenChange={setAddWalletDialogOpen}>
        <DialogContent data-testid="dialog-add-wallet">
          <DialogHeader>
            <DialogTitle>Add Wallet</DialogTitle>
            <DialogDescription>
              Add a wallet address to track and manage
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="wallet-type">Wallet Type</Label>
              <Select
                value={newWalletForm.walletType}
                onValueChange={(value: "evm" | "xrpl") => 
                  setNewWalletForm(prev => ({ ...prev, walletType: value }))
                }
              >
                <SelectTrigger id="wallet-type" data-testid="select-wallet-type">
                  <SelectValue placeholder="Select wallet type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="evm">EVM (Ethereum, Flare, etc.)</SelectItem>
                  <SelectItem value="xrpl">XRP Ledger</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wallet-address">Wallet Address</Label>
              <Input
                id="wallet-address"
                placeholder={newWalletForm.walletType === "evm" ? "0x..." : "r..."}
                value={newWalletForm.address}
                onChange={(e) => setNewWalletForm(prev => ({ ...prev, address: e.target.value }))}
                data-testid="input-wallet-address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wallet-label">Label (optional)</Label>
              <Input
                id="wallet-label"
                placeholder="e.g., My Trading Wallet"
                value={newWalletForm.label}
                onChange={(e) => setNewWalletForm(prev => ({ ...prev, label: e.target.value }))}
                data-testid="input-wallet-label"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddWalletDialogOpen(false);
                setNewWalletForm({ walletType: "evm", address: "", label: "" });
              }}
              data-testid="button-cancel-add-wallet"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddWallet}
              disabled={isSubmitting}
              data-testid="button-confirm-add-wallet"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Wallet"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editWalletDialogOpen} onOpenChange={setEditWalletDialogOpen}>
        <DialogContent data-testid="dialog-edit-wallet">
          <DialogHeader>
            <DialogTitle>Edit Wallet Label</DialogTitle>
            <DialogDescription>
              Update the label for this wallet
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-wallet-label">Label</Label>
              <Input
                id="edit-wallet-label"
                placeholder="e.g., My Trading Wallet"
                value={editingWallet?.label || ""}
                onChange={(e) => setEditingWallet(prev => prev ? { ...prev, label: e.target.value } : null)}
                data-testid="input-edit-wallet-label"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditWalletDialogOpen(false);
                setEditingWallet(null);
              }}
              data-testid="button-cancel-edit-wallet"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveWalletLabel}
              disabled={isSubmitting}
              data-testid="button-save-wallet-label"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
