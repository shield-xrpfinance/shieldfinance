import { useState } from "react";
import { Wallet } from "lucide-react";
import { useWallet } from "@/lib/walletContext";
import EmptyState from "@/components/EmptyState";
import ConnectWalletModal from "@/components/ConnectWalletModal";

export default function ConnectWalletEmptyState() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <EmptyState
        icon={Wallet}
        title="Connect Wallet to View Vaults"
        description="Connect your wallet to deposit assets, track positions, and earn yield on your crypto."
        actionButton={{
          label: "Connect Wallet",
          onClick: () => setIsModalOpen(true),
          testId: "button-connect-wallet"
        }}
        testId="connect-wallet-empty-state"
      />
      <ConnectWalletModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
}
