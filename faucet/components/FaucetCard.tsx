'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { Copy, Check, ExternalLink, Loader2, AlertCircle, CheckCircle2, Clock, Coins } from 'lucide-react';
import { ERC20_ABI, FAUCET_AMOUNTS } from '@/lib/contracts';
import { canClaim, setClaimRecord, getTimeUntilNextClaim, getRateLimitHours } from '@/lib/rateLimit';
import { getTransactionUrl, getAddressUrl } from '@/lib/chains';

interface FaucetCardProps {
  tokenName: string;
  tokenSymbol: string;
  contractAddress: `0x${string}`;
  faucetWallet: `0x${string}`;
  iconColor?: string;
  onClaimStart?: () => Promise<string | null>;
}

interface ClaimResponse {
  success: boolean;
  txHash?: string;
  amount?: string;
  tokenSymbol?: string;
  error?: string;
  timeRemaining?: string;
}

export function FaucetCard({
  tokenName,
  tokenSymbol,
  contractAddress,
  faucetWallet,
  iconColor = '#00E0FF',
  onClaimStart,
}: FaucetCardProps) {
  const { address, isConnected } = useAccount();
  const [copied, setCopied] = useState(false);
  const [canUserClaim, setCanUserClaim] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingState, setLoadingState] = useState<'verifying' | 'sending' | 'confirming' | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: contractAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [faucetWallet],
  });

  const { data: decimals } = useReadContract({
    address: contractAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });

  const checkRateLimit = useCallback(() => {
    if (address) {
      const canClaimNow = canClaim(address, tokenSymbol);
      setCanUserClaim(canClaimNow);
      if (!canClaimNow) {
        setTimeRemaining(getTimeUntilNextClaim(address, tokenSymbol));
      }
    }
  }, [address, tokenSymbol]);

  useEffect(() => {
    checkRateLimit();
    const interval = setInterval(checkRateLimit, 1000);
    return () => clearInterval(interval);
  }, [checkRateLimit]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClaim = async () => {
    if (!address || !canUserClaim) return;

    setClaimError(null);
    setTxHash(null);
    setIsSuccess(false);
    setIsLoading(true);
    setLoadingState('verifying');

    try {
      let captchaToken: string | null = null;
      
      if (onClaimStart) {
        captchaToken = await onClaimStart();
        if (!captchaToken) {
          setClaimError('Failed to verify captcha. Please try again.');
          setIsLoading(false);
          setLoadingState(null);
          return;
        }
      }

      setLoadingState('sending');

      const response = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          tokenSymbol: tokenSymbol,
          captchaToken: captchaToken,
        }),
      });

      const data: ClaimResponse = await response.json();

      if (!response.ok || !data.success) {
        if (response.status === 429 && data.timeRemaining) {
          setTimeRemaining(data.timeRemaining);
          setCanUserClaim(false);
        }
        setClaimError(data.error || 'Failed to claim tokens. Please try again.');
        setIsLoading(false);
        setLoadingState(null);
        return;
      }

      if (data.txHash) {
        setTxHash(data.txHash);
        setLoadingState('confirming');
        
        setClaimRecord(address, tokenSymbol);
        checkRateLimit();
        
        setTimeout(() => {
          refetchBalance();
          setIsSuccess(true);
          setIsLoading(false);
          setLoadingState(null);
        }, 2000);
      }
    } catch (error) {
      console.error('Claim error:', error);
      setClaimError('An error occurred. Please try again.');
      setIsLoading(false);
      setLoadingState(null);
    }
  };

  const formattedBalance = balance && decimals
    ? parseFloat(formatUnits(balance, decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : '0';

  const getLoadingText = () => {
    switch (loadingState) {
      case 'verifying':
        return 'Verifying...';
      case 'sending':
        return 'Sending...';
      case 'confirming':
        return 'Confirming...';
      default:
        return 'Processing...';
    }
  };

  return (
    <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 hover:border-cyber-cyan/30 transition-all duration-300">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${iconColor}15` }}
          >
            <Coins className="w-6 h-6" style={{ color: iconColor }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{tokenName}</h3>
            <p className="text-sm text-cyber-muted">{tokenSymbol}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyber-bg border border-cyber-border">
          <span className="text-xs text-cyber-muted font-mono">
            {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
          </span>
          <button
            onClick={handleCopy}
            data-testid={`button-copy-${tokenSymbol.toLowerCase()}`}
            className="text-cyber-muted hover:text-cyber-cyan transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-cyber-success" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-cyber-bg rounded-xl p-4 border border-cyber-border/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-cyber-muted">Faucet Balance</span>
            <a
              href={getAddressUrl(faucetWallet)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cyber-cyan hover:underline flex items-center gap-1"
            >
              View Wallet
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <p className="text-2xl font-bold text-white mt-1">
            {formattedBalance} <span className="text-cyber-cyan">{tokenSymbol}</span>
          </p>
        </div>

        <div className="bg-cyber-bg/50 rounded-xl p-4 border border-cyber-border/30">
          <div className="flex items-center gap-2 text-sm text-cyber-muted">
            <Clock className="w-4 h-4" />
            <span>Claim Limit: {FAUCET_AMOUNTS[tokenSymbol as keyof typeof FAUCET_AMOUNTS] || '100'} {tokenSymbol} every {getRateLimitHours()} hours</span>
          </div>
        </div>

        {!isConnected ? (
          <div className="text-center py-4 text-cyber-muted">
            Connect your wallet to claim tokens
          </div>
        ) : !canUserClaim ? (
          <div className="flex items-center justify-center gap-2 py-4 text-amber-400">
            <Clock className="w-5 h-5" />
            <span>Next claim available in: {timeRemaining}</span>
          </div>
        ) : (
          <button
            onClick={handleClaim}
            disabled={isLoading || !canUserClaim}
            data-testid={`button-claim-${tokenSymbol.toLowerCase()}`}
            className="w-full py-4 rounded-xl font-semibold text-lg transition-all duration-200
              bg-gradient-to-r from-cyber-cyan to-cyber-cyan-light text-cyber-bg
              hover:shadow-lg hover:shadow-cyber-cyan/25 hover:scale-[1.02]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {getLoadingText()}
              </>
            ) : (
              <>
                <Coins className="w-5 h-5" />
                Claim {FAUCET_AMOUNTS[tokenSymbol as keyof typeof FAUCET_AMOUNTS] || '100'} {tokenSymbol}
              </>
            )}
          </button>
        )}

        {claimError && (
          <div className="flex items-start gap-2 p-4 rounded-xl bg-cyber-error/10 border border-cyber-error/30">
            <AlertCircle className="w-5 h-5 text-cyber-error flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-cyber-error font-medium">Claim Failed</p>
              <p className="text-xs text-cyber-muted mt-1">
                {claimError}
              </p>
            </div>
          </div>
        )}

        {isSuccess && txHash && (
          <div className="flex items-start gap-2 p-4 rounded-xl bg-cyber-success/10 border border-cyber-success/30">
            <CheckCircle2 className="w-5 h-5 text-cyber-success flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-cyber-success font-medium">Tokens Claimed Successfully!</p>
              <a
                href={getTransactionUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`link-tx-${tokenSymbol.toLowerCase()}`}
                className="text-xs text-cyber-cyan hover:underline flex items-center gap-1 mt-1"
              >
                View Transaction
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
