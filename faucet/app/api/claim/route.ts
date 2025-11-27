import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http, parseUnits, createPublicClient, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { flareCoston2 } from '@/lib/chains';
import { ERC20_ABI, FAUCET_AMOUNTS, CONTRACTS } from '@/lib/contracts';
import { canClaimServer, setClaimRecordServer, getTimeUntilNextClaimServer } from '@/lib/rateLimit';

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const MIN_SCORE = 0.5;
const FAUCET_PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY;

interface ClaimRequest {
  walletAddress: string;
  tokenSymbol: string;
  captchaToken?: string;
}

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

async function verifyCaptcha(token: string): Promise<{ success: boolean; error?: string }> {
  if (!RECAPTCHA_SECRET_KEY) {
    return { success: true };
  }

  try {
    const verifyResponse = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: RECAPTCHA_SECRET_KEY,
        response: token,
      }),
    });

    const data: RecaptchaResponse = await verifyResponse.json();

    if (!data.success) {
      console.error('reCAPTCHA verification failed:', data['error-codes']);
      return { success: false, error: 'reCAPTCHA verification failed' };
    }

    if (data.score !== undefined && data.score < MIN_SCORE) {
      console.warn(`Low reCAPTCHA score: ${data.score}`);
      return { success: false, error: 'Suspicious activity detected' };
    }

    if (data.action && data.action !== 'claim_tokens') {
      return { success: false, error: 'Invalid action' };
    }

    return { success: true };
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return { success: false, error: 'Internal verification error' };
  }
}

function getTokenConfig(tokenSymbol: string): { address: `0x${string}`; amount: string; decimals: number } | null {
  const symbol = tokenSymbol.toUpperCase();
  
  if (symbol === 'SHIELD') {
    return {
      address: CONTRACTS.SHIELD as `0x${string}`,
      amount: FAUCET_AMOUNTS.SHIELD,
      decimals: 18,
    };
  }
  
  if (symbol === 'WFLR') {
    return {
      address: CONTRACTS.WFLR as `0x${string}`,
      amount: FAUCET_AMOUNTS.WFLR,
      decimals: 18,
    };
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!FAUCET_PRIVATE_KEY) {
      console.error('FAUCET_PRIVATE_KEY not configured');
      return NextResponse.json(
        { success: false, error: 'Faucet not configured. Please contact administrator.' },
        { status: 500 }
      );
    }

    const body: ClaimRequest = await request.json();
    const { walletAddress, tokenSymbol, captchaToken } = body;

    if (!walletAddress || !isAddress(walletAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    if (!tokenSymbol) {
      return NextResponse.json(
        { success: false, error: 'Token symbol is required' },
        { status: 400 }
      );
    }

    const tokenConfig = getTokenConfig(tokenSymbol);
    if (!tokenConfig) {
      return NextResponse.json(
        { success: false, error: 'Unsupported token' },
        { status: 400 }
      );
    }

    if (tokenConfig.address === '0x0000000000000000000000000000000000000000') {
      return NextResponse.json(
        { success: false, error: 'Token contract address not configured' },
        { status: 500 }
      );
    }

    if (captchaToken) {
      const captchaResult = await verifyCaptcha(captchaToken);
      if (!captchaResult.success) {
        return NextResponse.json(
          { success: false, error: captchaResult.error || 'Captcha verification failed' },
          { status: 403 }
        );
      }
    } else if (RECAPTCHA_SECRET_KEY) {
      return NextResponse.json(
        { success: false, error: 'Captcha token required' },
        { status: 400 }
      );
    }

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    if (!canClaimServer(walletAddress, tokenSymbol, clientIp)) {
      const timeRemaining = getTimeUntilNextClaimServer(walletAddress, tokenSymbol, clientIp);
      return NextResponse.json(
        { 
          success: false, 
          error: `Rate limit exceeded. Please try again in ${timeRemaining}.`,
          timeRemaining,
        },
        { status: 429 }
      );
    }

    const formattedPrivateKey = FAUCET_PRIVATE_KEY.startsWith('0x') 
      ? FAUCET_PRIVATE_KEY as `0x${string}`
      : `0x${FAUCET_PRIVATE_KEY}` as `0x${string}`;

    const account = privateKeyToAccount(formattedPrivateKey);

    const publicClient = createPublicClient({
      chain: flareCoston2,
      transport: http(),
    });

    const walletClient = createWalletClient({
      account,
      chain: flareCoston2,
      transport: http(),
    });

    const faucetBalance = await publicClient.readContract({
      address: tokenConfig.address,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    });

    const amountToSend = parseUnits(tokenConfig.amount, tokenConfig.decimals);

    if (faucetBalance < amountToSend) {
      console.error(`Insufficient faucet balance for ${tokenSymbol}. Balance: ${faucetBalance}, Required: ${amountToSend}`);
      return NextResponse.json(
        { success: false, error: 'Faucet has insufficient funds. Please try again later.' },
        { status: 503 }
      );
    }

    const hash = await walletClient.writeContract({
      address: tokenConfig.address,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [walletAddress as `0x${string}`, amountToSend],
    });

    setClaimRecordServer(walletAddress, tokenSymbol, clientIp);

    console.log(`Faucet claim successful: ${tokenConfig.amount} ${tokenSymbol} sent to ${walletAddress}, tx: ${hash}`);

    return NextResponse.json({
      success: true,
      txHash: hash,
      amount: tokenConfig.amount,
      tokenSymbol: tokenSymbol.toUpperCase(),
    });

  } catch (error: any) {
    console.error('Faucet claim error:', error);

    if (error.message?.includes('insufficient funds')) {
      return NextResponse.json(
        { success: false, error: 'Faucet has insufficient gas. Please try again later.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Transaction failed. Please try again.' },
      { status: 500 }
    );
  }
}
