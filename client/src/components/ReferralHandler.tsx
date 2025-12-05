import { useEffect, useRef } from "react";
import { useWallet } from "@/lib/walletContext";
import { useReferral, captureReferralFromUrl, getPendingReferral } from "@/hooks/useReferral";

/**
 * Component that handles referral tracking:
 * 1. Captures referral code from URL on mount
 * 2. Auto-applies referral when wallet connects
 * 
 * Should be placed inside WalletProvider in the component tree.
 */
export function ReferralHandler() {
  const { address, evmAddress, isConnected } = useWallet();
  const { applyPendingReferral } = useReferral();
  const hasTriedApplyRef = useRef(false);
  const lastAddressRef = useRef<string | null>(null);

  // Capture referral from URL on component mount
  useEffect(() => {
    captureReferralFromUrl();
  }, []);

  // Auto-apply referral when wallet connects
  useEffect(() => {
    if (!isConnected) {
      // Reset when disconnected so we can try again on next connect
      hasTriedApplyRef.current = false;
      lastAddressRef.current = null;
      return;
    }

    const walletAddress = evmAddress || address;
    if (!walletAddress) return;

    // Skip if we've already tried for this address
    if (hasTriedApplyRef.current && lastAddressRef.current === walletAddress) {
      return;
    }

    // Check if there's a pending referral
    const pendingCode = getPendingReferral();
    if (!pendingCode) {
      console.log("🎁 ReferralHandler: No pending referral to apply");
      return;
    }

    console.log(`🎁 ReferralHandler: Wallet connected (${walletAddress.slice(0, 10)}...), applying referral ${pendingCode}`);
    
    // Mark as tried for this address
    hasTriedApplyRef.current = true;
    lastAddressRef.current = walletAddress;
    
    // Apply the referral (async, fire and forget)
    applyPendingReferral(walletAddress);
  }, [isConnected, address, evmAddress, applyPendingReferral]);

  // This component doesn't render anything
  return null;
}
