import { useEffect, useState, useCallback } from "react";
import Shepherd from "shepherd.js";
import "shepherd.js/dist/css/shepherd.css";
import "@/styles/shepherd-theme.css";
import { useWallet } from "@/lib/walletContext";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOUR_STORAGE_KEY = "shield-tour-completed";
const TOUR_VERSION = "1.0";

type TourScenario = "new-user" | "xrpl-user" | "evm-user";

function getTourScenario(
  isConnected: boolean,
  walletType: "xrpl" | "evm" | null
): TourScenario {
  if (!isConnected) return "new-user";
  if (walletType === "xrpl") return "xrpl-user";
  return "evm-user";
}

function createTour(scenario: TourScenario, onComplete: () => void) {
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
      attachTo: { element: '[data-testid="button-connect-wallet"]', on: "bottom" },
      buttons: [skipButton, backButton, nextButton],
    });

    tour.addStep({
      id: "network-toggle",
      title: "Step 2: Choose Your Network",
      text: `
        <div class="shepherd-custom-content">
          <p>Toggle between <strong>Mainnet</strong> and <strong>Testnet</strong>.</p>
          <p class="shepherd-hint">We recommend starting on Testnet to practice with test tokens before using real funds.</p>
        </div>
      `,
      attachTo: { element: '[data-testid="network-toggle"]', on: "right" },
      buttons: [skipButton, backButton, nextButton],
    });

    tour.addStep({
      id: "sidebar-nav",
      title: "Step 3: Explore the App",
      text: `
        <div class="shepherd-custom-content">
          <p>Use the sidebar to navigate:</p>
          <ul>
            <li><strong>Dashboard</strong> - Overview of your positions</li>
            <li><strong>Vaults</strong> - Deposit & earn yield</li>
            <li><strong>Portfolio</strong> - Track your holdings</li>
            <li><strong>Staking</strong> - Stake SHIELD for boost</li>
          </ul>
        </div>
      `,
      attachTo: { element: '[data-testid="link-vaults"]', on: "right" },
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
      attachTo: { element: '[data-testid="help-card"]', on: "top" },
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
      buttons: [skipButton, { text: "Show Me!", action: () => tour.next(), classes: "shepherd-button-primary" }],
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
      attachTo: { element: '[data-testid="link-vaults"]', on: "right" },
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
      attachTo: { element: '[data-testid="link-portfolio"]', on: "right" },
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
      buttons: [skipButton, { text: "Show Me!", action: () => tour.next(), classes: "shepherd-button-primary" }],
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
      attachTo: { element: '[data-testid="link-vaults"]', on: "right" },
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
      attachTo: { element: '[data-testid="link-staking"]', on: "right" },
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
      attachTo: { element: '[data-testid="link-swap"]', on: "right" },
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
      attachTo: { element: '[data-testid="link-portfolio"]', on: "right" },
      buttons: [skipButton, backButton, { text: "Let's Go!", action: () => tour.complete(), classes: "shepherd-button-primary" }],
    });
  }

  tour.on("complete", onComplete);
  tour.on("cancel", onComplete);

  return tour;
}

export function ShieldTour() {
  const { isConnected, walletType } = useWallet();
  const [tourInstance, setTourInstance] = useState<ReturnType<typeof createTour> | null>(null);
  const [hasSeenTour, setHasSeenTour] = useState(true);

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
  }, []);

  const startTour = useCallback(() => {
    if (tourInstance) {
      tourInstance.cancel();
    }

    const scenario = getTourScenario(isConnected, walletType);
    const tour = createTour(scenario, markTourComplete);
    setTourInstance(tour);

    setTimeout(() => {
      tour.start();
    }, 500);
  }, [isConnected, walletType, markTourComplete, tourInstance]);

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
