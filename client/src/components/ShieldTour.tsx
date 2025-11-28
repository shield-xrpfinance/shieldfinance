import { useEffect, useState, useCallback } from "react";
import Shepherd from "shepherd.js";
import "shepherd.js/dist/css/shepherd.css";
import "@/styles/shepherd-theme.css";
import { useWallet } from "@/lib/walletContext";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOUR_STORAGE_KEY = "shield-tour-completed";
const TOUR_VERSION = "1.3";

type TourScenario = "new-user" | "xrpl-user" | "evm-user";

function getTourScenario(
  isConnected: boolean,
  walletType: "xrpl" | "evm" | null
): TourScenario {
  if (!isConnected) return "new-user";
  if (walletType === "xrpl") return "xrpl-user";
  return "evm-user";
}

interface TourOptions {
  isMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  setMobileSidebarLocked: (locked: boolean) => void;
}

function createTour(scenario: TourScenario, onComplete: () => void, options: TourOptions) {
  const { isMobile, setOpenMobile, setMobileSidebarLocked } = options;
  
  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      classes: "shield-tour-step",
      scrollTo: { behavior: "smooth", block: "center" },
      cancelIcon: { enabled: true },
      modalOverlayOpeningPadding: 8,
      modalOverlayOpeningRadius: 8,
    },
  });
  
  type PopperPlacement = "top" | "bottom" | "left" | "right" | "top-start" | "top-end" | "bottom-start" | "bottom-end" | "left-start" | "left-end" | "right-start" | "right-end";
  
  // Helper to create beforeShowPromise that opens and locks sidebar on mobile for sidebar elements
  const getSidebarStepConfig = (selector: string, position: PopperPlacement) => {
    if (isMobile) {
      return {
        attachTo: { element: selector, on: position as PopperPlacement },
        beforeShowPromise: () => {
          return new Promise<void>((resolve) => {
            // Lock the sidebar to prevent it from closing
            setMobileSidebarLocked(true);
            setOpenMobile(true);
            // Wait for sidebar animation to complete
            setTimeout(resolve, 350);
          });
        },
      };
    }
    return {
      attachTo: { element: selector, on: position as PopperPlacement },
    };
  };
  
  // Helper to unlock and close sidebar on mobile for non-sidebar steps
  const getNonSidebarStepConfig = () => {
    if (isMobile) {
      return {
        beforeShowPromise: () => {
          return new Promise<void>((resolve) => {
            // Unlock and close the sidebar
            setMobileSidebarLocked(false);
            setOpenMobile(false);
            setTimeout(resolve, 150);
          });
        },
      };
    }
    return {};
  };

  const skipButton = {
    text: "Skip Tour",
    action: () => tour.cancel(),
    classes: "shepherd-button-secondary",
  };
  
  const backButton = {
    text: "Back",
    action: () => tour.back(),
    classes: "shepherd-button-secondary",
  };
  
  const nextButton = {
    text: "Next",
    action: () => tour.next(),
    classes: "shepherd-button-primary",
  };
  
  const finishButton = {
    text: "Finish",
    action: () => tour.complete(),
    classes: "shepherd-button-primary",
  };

  if (scenario === "new-user") {
    tour.addStep({
      id: "welcome",
      title: "Welcome to Shield Finance!",
      text: `
        <div class="shepherd-custom-content">
          <p>Shield Finance is a <strong>liquid staking protocol</strong> for XRP.</p>
          <p>Earn yield on your XRP while keeping it liquid and usable.</p>
          <p class="shepherd-hint">This quick tour will show you around. You can skip anytime.</p>
        </div>
      `,
      ...getNonSidebarStepConfig(),
      buttons: [skipButton, { text: "Let's Go!", action: () => tour.next(), classes: "shepherd-button-primary" }],
    });

    tour.addStep({
      id: "connect-wallet",
      title: "Step 1: Connect Your Wallet",
      text: `
        <div class="shepherd-custom-content">
          <p>First, connect your wallet to get started.</p>
          <p><strong>XRPL Users:</strong> Use Xaman (formerly XUMM) wallet</p>
          <p><strong>EVM Users:</strong> Use MetaMask, Rabby, or any Web3 wallet</p>
        </div>
      `,
      ...getSidebarStepConfig('[data-testid="button-connect-wallet"]', "bottom"),
      buttons: [skipButton, backButton, nextButton],
    });

    tour.addStep({
      id: "control-panel",
      title: "Step 2: Control Panel",
      text: `
        <div class="shepherd-custom-content">
          <p>Access the <strong>Control Panel</strong> to manage your experience:</p>
          <ul>
            <li><strong>Network</strong> - Switch between XRPL and Flare ecosystems</li>
            <li><strong>Theme</strong> - Toggle light or dark mode</li>
            <li><strong>Wallet</strong> - Connect or disconnect your wallet</li>
          </ul>
          <p class="shepherd-hint">Disconnect your wallet to switch between networks.</p>
        </div>
      `,
      ...getNonSidebarStepConfig(),
      attachTo: { element: '[data-testid="button-control-center"]', on: "bottom" },
      buttons: [skipButton, backButton, nextButton],
    });

    tour.addStep({
      id: "network-toggle",
      title: "Step 3: Quick Network Toggle",
      text: `
        <div class="shepherd-custom-content">
          <p>Quickly switch between <strong>Mainnet</strong> and <strong>Testnet</strong> here.</p>
          <p class="shepherd-hint">We recommend starting on Testnet to practice with test tokens before using real funds.</p>
        </div>
      `,
      ...getSidebarStepConfig('[data-testid="network-toggle"]', "right"),
      buttons: [skipButton, backButton, nextButton],
    });

    tour.addStep({
      id: "sidebar-nav",
      title: "Step 4: Explore the App",
      text: `
        <div class="shepherd-custom-content">
          <p>Use the sidebar menu to navigate:</p>
          <ul>
            <li><strong>Dashboard</strong> - Overview of your positions</li>
            <li><strong>Vaults</strong> - Deposit & earn yield</li>
            <li><strong>Portfolio</strong> - Track your holdings</li>
            <li><strong>Staking</strong> - Stake SHIELD for boost</li>
          </ul>
        </div>
      `,
      ...getSidebarStepConfig('[data-testid="link-vaults"]', "right"),
      buttons: [skipButton, backButton, nextButton],
    });

    tour.addStep({
      id: "help-resources",
      title: "Need Help?",
      text: `
        <div class="shepherd-custom-content">
          <p>Check out our documentation and join our community!</p>
          <p class="shepherd-hint">You can restart this tour anytime using the help button.</p>
        </div>
      `,
      ...getSidebarStepConfig('[data-testid="help-card"]', "top"),
      buttons: [skipButton, backButton, finishButton],
    });
  } else if (scenario === "xrpl-user") {
    tour.addStep({
      id: "welcome-xrpl",
      title: "Welcome, XRP Holder!",
      text: `
        <div class="shepherd-custom-content">
          <p>Great! Your <strong>XRPL wallet</strong> is connected.</p>
          <p>Let's show you how to earn yield on your XRP.</p>
        </div>
      `,
      ...getNonSidebarStepConfig(),
      buttons: [skipButton, { text: "Show Me!", action: () => tour.next(), classes: "shepherd-button-primary" }],
    });

    tour.addStep({
      id: "xrpl-control-panel",
      title: "Control Panel",
      text: `
        <div class="shepherd-custom-content">
          <p>Access the <strong>Control Panel</strong> anytime to:</p>
          <ul>
            <li>Switch between Mainnet and Testnet</li>
            <li>Toggle light or dark theme</li>
            <li>Disconnect or reconnect your wallet</li>
          </ul>
        </div>
      `,
      ...getNonSidebarStepConfig(),
      attachTo: { element: '[data-testid="button-control-center"]', on: "bottom" },
      buttons: [skipButton, backButton, nextButton],
    });

    tour.addStep({
      id: "xrpl-vaults",
      title: "XRP Vaults",
      text: `
        <div class="shepherd-custom-content">
          <p>Head to <strong>Vaults</strong> to see available XRP staking options.</p>
          <p>You'll see the current APY and can deposit your XRP to start earning.</p>
        </div>
      `,
      ...getSidebarStepConfig('[data-testid="link-vaults"]', "right"),
      buttons: [skipButton, backButton, nextButton],
    });

    tour.addStep({
      id: "xrpl-deposit",
      title: "How Deposits Work",
      text: `
        <div class="shepherd-custom-content">
          <p><strong>1.</strong> Choose a vault and click "Deposit"</p>
          <p><strong>2.</strong> Enter the amount of XRP</p>
          <p><strong>3.</strong> Approve the transaction in Xaman</p>
          <p><strong>4.</strong> Receive shXRP tokens representing your stake</p>
          <p class="shepherd-hint">Your shXRP grows in value as rewards accrue!</p>
        </div>
      `,
      ...getNonSidebarStepConfig(),
      buttons: [skipButton, backButton, nextButton],
    });

    tour.addStep({
      id: "xrpl-portfolio",
      title: "Track Your Earnings",
      text: `
        <div class="shepherd-custom-content">
          <p>Visit <strong>Portfolio</strong> to see your positions and accumulated rewards.</p>
          <p>Withdraw anytime - your XRP stays liquid!</p>
        </div>
      `,
      ...getSidebarStepConfig('[data-testid="link-portfolio"]', "right"),
      buttons: [skipButton, backButton, { text: "Got It!", action: () => tour.complete(), classes: "shepherd-button-primary" }],
    });
  } else {
    // EVM user
    tour.addStep({
      id: "welcome-evm",
      title: "Welcome, Flare User!",
      text: `
        <div class="shepherd-custom-content">
          <p>Great! Your <strong>EVM wallet</strong> is connected to Flare Network.</p>
          <p>Let's show you how to maximize your FXRP yield.</p>
        </div>
      `,
      ...getNonSidebarStepConfig(),
      buttons: [skipButton, { text: "Show Me!", action: () => tour.next(), classes: "shepherd-button-primary" }],
    });

    tour.addStep({
      id: "evm-control-panel",
      title: "Control Panel",
      text: `
        <div class="shepherd-custom-content">
          <p>Access the <strong>Control Panel</strong> anytime to:</p>
          <ul>
            <li>Switch between Mainnet and Testnet</li>
            <li>Toggle light or dark theme</li>
            <li>Disconnect or reconnect your wallet</li>
          </ul>
        </div>
      `,
      ...getNonSidebarStepConfig(),
      attachTo: { element: '[data-testid="button-control-center"]', on: "bottom" },
      buttons: [skipButton, backButton, nextButton],
    });

    tour.addStep({
      id: "evm-vaults",
      title: "FXRP Vaults",
      text: `
        <div class="shepherd-custom-content">
          <p>Visit <strong>Vaults</strong> to deposit FXRP and earn yield.</p>
          <p>FXRP is bridged XRP on Flare Network via FAssets.</p>
        </div>
      `,
      ...getSidebarStepConfig('[data-testid="link-vaults"]', "right"),
      buttons: [skipButton, backButton, nextButton],
    });

    tour.addStep({
      id: "evm-staking",
      title: "Boost Your Yield",
      text: `
        <div class="shepherd-custom-content">
          <p>Stake <strong>SHIELD tokens</strong> to boost your shXRP yield!</p>
          <p>The more SHIELD you stake, the higher your APY boost.</p>
        </div>
      `,
      ...getSidebarStepConfig('[data-testid="link-staking"]', "right"),
      buttons: [skipButton, backButton, nextButton],
    });

    tour.addStep({
      id: "evm-swap",
      title: "Get SHIELD Tokens",
      text: `
        <div class="shepherd-custom-content">
          <p>Use the <strong>Swap</strong> feature to trade FLR for SHIELD.</p>
          <p>SHIELD is our governance token that powers yield boosts.</p>
        </div>
      `,
      ...getSidebarStepConfig('[data-testid="link-swap"]', "right"),
      buttons: [skipButton, backButton, nextButton],
    });

    tour.addStep({
      id: "evm-portfolio",
      title: "Monitor Everything",
      text: `
        <div class="shepherd-custom-content">
          <p>Your <strong>Portfolio</strong> shows all positions, rewards, and transaction history.</p>
          <p class="shepherd-hint">Happy staking! You can restart this tour from the help button.</p>
        </div>
      `,
      ...getSidebarStepConfig('[data-testid="link-portfolio"]', "right"),
      buttons: [skipButton, backButton, { text: "Let's Go!", action: () => tour.complete(), classes: "shepherd-button-primary" }],
    });
  }

  tour.on("complete", onComplete);
  tour.on("cancel", onComplete);

  return tour;
}

interface ShieldTourProps {
  variant?: "fixed" | "inline";
}

export function ShieldTour({ variant = "fixed" }: ShieldTourProps) {
  const { isConnected, walletType } = useWallet();
  const { setOpenMobile, openMobile, setMobileSidebarLocked } = useSidebar();
  const isMobile = useIsMobile();
  const [tourInstance, setTourInstance] = useState<ReturnType<typeof createTour> | null>(null);
  const [hasSeenTour, setHasSeenTour] = useState(true);
  const [wasOpenMobile, setWasOpenMobile] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(TOUR_STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setHasSeenTour(data.version === TOUR_VERSION);
      } catch {
        setHasSeenTour(false);
      }
    } else {
      setHasSeenTour(false);
    }
  }, []);

  const markTourComplete = useCallback(() => {
    localStorage.setItem(
      TOUR_STORAGE_KEY,
      JSON.stringify({ completed: true, version: TOUR_VERSION, timestamp: Date.now() })
    );
    setHasSeenTour(true);
    setTourInstance(null);
    
    // Unlock and restore mobile sidebar state after tour
    if (isMobile) {
      setMobileSidebarLocked(false);
      if (!wasOpenMobile) {
        setOpenMobile(false);
      }
    }
  }, [isMobile, wasOpenMobile, setOpenMobile, setMobileSidebarLocked]);

  const startTour = useCallback(() => {
    if (tourInstance) {
      tourInstance.cancel();
    }

    // On mobile, close the sidebar before starting the tour
    if (isMobile) {
      setWasOpenMobile(openMobile);
      setMobileSidebarLocked(false);
      setOpenMobile(false);
    }

    const scenario = getTourScenario(isConnected, walletType);
    const tour = createTour(scenario, markTourComplete, { isMobile, setOpenMobile, setMobileSidebarLocked });
    setTourInstance(tour);

    // Give the sidebar time to close on mobile before starting
    setTimeout(() => {
      tour.start();
    }, isMobile ? 400 : 500);
  }, [isConnected, walletType, markTourComplete, tourInstance, isMobile, openMobile, setOpenMobile, setMobileSidebarLocked]);

  useEffect(() => {
    if (!hasSeenTour) {
      const timer = setTimeout(() => {
        startTour();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [hasSeenTour, startTour]);

  useEffect(() => {
    return () => {
      if (tourInstance) {
        tourInstance.cancel();
      }
    };
  }, [tourInstance]);

  // Inline variant renders differently - used in sidebar
  if (variant === "inline") {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
        onClick={startTour}
        title="Start guided tour"
        data-testid="button-help-tour"
      >
        <HelpCircle className="h-4 w-4" />
        <span>Take a Tour</span>
      </Button>
    );
  }

  // Fixed variant - floating button (default)
  return (
    <Button
      variant="outline"
      size="icon"
      className="fixed bottom-20 right-4 md:bottom-6 z-50 rounded-full shadow-lg bg-primary/10 border-primary/30 hover:bg-primary/20"
      onClick={startTour}
      title="Start guided tour"
      data-testid="button-help-tour"
    >
      <HelpCircle className="h-5 w-5 text-primary" />
    </Button>
  );
}
