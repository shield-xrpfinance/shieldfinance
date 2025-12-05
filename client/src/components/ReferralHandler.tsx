import { useEffect, useRef } from "react";
import { useWallet } from "@/lib/walletContext";
import { useReferral, captureReferralFromUrl, getPendingReferral } from "@/hooks/useReferral";

/**
 * Component that handles referral tracking and daily login points:
 * 1. Captures referral code from URL on mount
 * 2. Auto-applies referral when wallet connects
 * 3. Awards daily login points when wallet connects
 * 
 * Should be placed inside WalletProvider in the component tree.
 */
export function ReferralHandler() {
  const { address, evmAddress, isConnected } = useWallet();
  const { applyPendingReferral } = useReferral();
  const hasTriedApplyRef = useRef(false);
  const hasTriedDailyLoginRef = useRef(false);
  const lastAddressRef = useRef<string | null>(null);

  // Capture referral from URL on component mount
  useEffect(() => {
    captureReferralFromUrl();
  }, []);

  // Auto-apply referral and daily login points when wallet connects
  useEffect(() => {
    if (!isConnected) {
      // Reset when disconnected so we can try again on next connect
      hasTriedApplyRef.current = false;
      hasTriedDailyLoginRef.current = false;
      lastAddressRef.current = null;
      return;
    }

    const walletAddress = evmAddress || address;
    if (!walletAddress) return;

    // Skip if we've already processed this address
    if (lastAddressRef.current === walletAddress) {
      return;
    }

    // Mark as processed for this address
    lastAddressRef.current = walletAddress;

    // Award daily login points (async, fire and forget)
    if (!hasTriedDailyLoginRef.current) {
      hasTriedDailyLoginRef.current = true;
      fetch("/api/points/daily-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && !data.alreadyClaimed && data.pointsAwarded) {
            console.log(`🌟 ReferralHandler: Daily login points awarded (+${data.pointsAwarded})`);
          }
        })
        .catch(err => {
          console.log("🌟 ReferralHandler: Failed to check daily login (non-critical):", err);
        });
    }

    // Check if there's a pending referral
    const pendingCode = getPendingReferral();
    if (!pendingCode) {
      console.log("🎁 ReferralHandler: No pending referral to apply");
      return;
    }

    if (!hasTriedApplyRef.current) {
      console.log(`🎁 ReferralHandler: Wallet connected (${walletAddress.slice(0, 10)}...), applying referral ${pendingCode}`);
      
      // Mark as tried
      hasTriedApplyRef.current = true;
      
      // Apply the referral (async, fire and forget)
      applyPendingReferral(walletAddress);
    }
  }, [isConnected, address, evmAddress, applyPendingReferral]);

  // This component doesn't render anything
  return null;
}
