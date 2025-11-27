'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { FaucetCard } from '@/components/FaucetCard';
import { CONTRACTS } from '@/lib/contracts';
import { flareCoston2 } from '@/lib/chains';
import { Droplets, AlertTriangle, RefreshCw } from 'lucide-react';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

export default function FaucetPage() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);
  
  const isWrongNetwork = isConnected && chainId !== flareCoston2.id;

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey) return;

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.onload = () => {
      window.grecaptcha?.ready(() => {
        setRecaptchaLoaded(true);
      });
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const handleCaptchaVerify = useCallback(async (): Promise<string | null> => {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey || !window.grecaptcha || !recaptchaLoaded) {
      return null;
    }

    try {
      const token = await window.grecaptcha.execute(siteKey, { action: 'claim_tokens' });
      return token;
    } catch (error) {
      console.error('reCAPTCHA error:', error);
      return null;
    }
  }, [recaptchaLoaded]);

  const handleSwitchNetwork = () => {
    switchChain({ chainId: flareCoston2.id });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyber-cyan to-cyber-cyan-light mb-6 animate-pulse-glow">
          <Droplets className="w-8 h-8 text-cyber-bg" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
          Shield Finance <span className="text-cyber-cyan">Faucet</span>
        </h1>
        <p className="text-lg text-cyber-muted max-w-2xl mx-auto">
          Get free test tokens on Flare Coston2 testnet for development and testing. 
          Each wallet can claim tokens once every 12 hours.
        </p>
      </div>

      {isWrongNetwork && (
        <div className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            <div>
              <p className="font-medium text-amber-400">Wrong Network</p>
              <p className="text-sm text-cyber-muted">Please switch to Flare Coston2 testnet to use the faucet</p>
            </div>
          </div>
          <button
            onClick={handleSwitchNetwork}
            disabled={isSwitching}
            data-testid="button-switch-network"
            className="px-4 py-2 rounded-xl font-medium bg-amber-500 text-cyber-bg hover:bg-amber-400 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isSwitching ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Switching...
              </>
            ) : (
              'Switch Network'
            )}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FaucetCard
          tokenName="Test SHIELD"
          tokenSymbol="SHIELD"
          contractAddress={CONTRACTS.SHIELD as `0x${string}`}
          faucetWallet={CONTRACTS.FAUCET as `0x${string}`}
          iconColor="#00E0FF"
          onClaimStart={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ? handleCaptchaVerify : undefined}
        />
        
        <FaucetCard
          tokenName="Wrapped Flare (Test)"
          tokenSymbol="wFLR"
          contractAddress={CONTRACTS.WFLR as `0x${string}`}
          faucetWallet={CONTRACTS.FAUCET as `0x${string}`}
          iconColor="#E84142"
          onClaimStart={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ? handleCaptchaVerify : undefined}
        />
      </div>

      <div className="mt-12 text-center">
        <div className="inline-block p-6 rounded-2xl bg-cyber-card border border-cyber-border">
          <h3 className="text-lg font-semibold text-white mb-2">Need Testnet C2FLR for Gas?</h3>
          <p className="text-sm text-cyber-muted mb-4">
            Get free Coston2 FLR from the official Flare faucet to pay for transaction fees.
          </p>
          <a
            href="https://faucet.flare.network/coston2"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-flare-faucet"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyber-bg border border-cyber-border text-cyber-cyan hover:border-cyber-cyan/50 transition-colors"
          >
            <Droplets className="w-4 h-4" />
            Flare Coston2 Faucet
          </a>
        </div>
      </div>

      {process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && (
        <p className="mt-8 text-center text-xs text-cyber-muted">
          This site is protected by reCAPTCHA and the Google{' '}
          <a href="https://policies.google.com/privacy" className="text-cyber-cyan hover:underline">
            Privacy Policy
          </a>{' '}
          and{' '}
          <a href="https://policies.google.com/terms" className="text-cyber-cyan hover:underline">
            Terms of Service
          </a>{' '}
          apply.
        </p>
      )}
    </div>
  );
}
