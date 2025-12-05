import { useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const REFERRAL_STORAGE_KEY = "pending_referral_code";

/**
 * Capture referral code from URL and store it
 * Returns the pending referral code if any
 */
export function captureReferralFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get("ref");
  
  if (refCode) {
    console.log("🎁 Referral code captured from URL:", refCode);
    localStorage.setItem(REFERRAL_STORAGE_KEY, refCode.toUpperCase());
    
    // Clean up URL without losing other params
    urlParams.delete("ref");
    const newSearch = urlParams.toString();
    const newUrl = newSearch 
      ? `${window.location.pathname}?${newSearch}${window.location.hash}`
      : `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, "", newUrl);
    
    return refCode.toUpperCase();
  }
  
  // Return existing pending referral if any
  return localStorage.getItem(REFERRAL_STORAGE_KEY);
}

/**
 * Get pending referral code from storage
 */
export function getPendingReferral(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFERRAL_STORAGE_KEY);
}

/**
 * Clear pending referral from storage
 */
export function clearPendingReferral(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REFERRAL_STORAGE_KEY);
}

/**
 * Hook to manage referral tracking
 * - Captures referral code from URL on mount
 * - Provides function to apply referral when wallet connects
 */
export function useReferral() {
  const { toast } = useToast();
  const hasAppliedRef = useRef(false);

  // Capture referral from URL on mount
  useEffect(() => {
    captureReferralFromUrl();
  }, []);

  /**
   * Apply pending referral code for a wallet address
   * Called when wallet connects
   */
  const applyPendingReferral = useCallback(async (walletAddress: string): Promise<boolean> => {
    // Prevent double application
    if (hasAppliedRef.current) {
      console.log("🎁 Referral already applied in this session");
      return false;
    }

    const pendingCode = getPendingReferral();
    if (!pendingCode) {
      console.log("🎁 No pending referral code to apply");
      return false;
    }

    console.log(`🎁 Applying referral code ${pendingCode} for wallet ${walletAddress}`);
    
    try {
      const response = await apiRequest("POST", "/api/referral/apply", {
        walletAddress,
        referralCode: pendingCode,
      });

      const data = await response.json();

      if (data.success) {
        hasAppliedRef.current = true;
        clearPendingReferral();
        
        if (data.alreadyApplied) {
          console.log("🎁 Referral was already applied previously");
        } else {
          console.log("🎁 Referral applied successfully!");
          toast({
            title: "Referral Applied!",
            description: "You've been connected through a referral link. Both you and your referrer can now earn bonus points!",
          });
        }
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error("🎁 Failed to apply referral:", error);
      
      // Handle specific error cases
      const errorMessage = error?.message || "Unknown error";
      
      if (errorMessage.includes("Invalid referral code")) {
        toast({
          title: "Invalid Referral Code",
          description: "The referral code in your link is no longer valid.",
          variant: "destructive",
        });
        clearPendingReferral();
      } else if (errorMessage.includes("Cannot refer yourself")) {
        toast({
          title: "Self-Referral Not Allowed",
          description: "You cannot use your own referral code.",
          variant: "destructive",
        });
        clearPendingReferral();
      } else if (errorMessage.includes("Already referred")) {
        // Silently clear - user was already referred
        clearPendingReferral();
      }
      
      return false;
    }
  }, [toast]);

  return {
    applyPendingReferral,
    getPendingReferral,
    clearPendingReferral,
  };
}
