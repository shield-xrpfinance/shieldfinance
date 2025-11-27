import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/lib/walletContext";

const STAKING_BOOST_ADDRESS = "0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4";
const SHIELD_TOKEN_ADDRESS = "0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616";

// Note: StakingBoost contract is only deployed on Coston2 testnet.
// We use a direct RPC connection for read operations to ensure consistent behavior.
// Write operations use the user's connected wallet provider.
const COSTON2_RPC = "https://coston2-api.flare.network/ext/C/rpc";
const COSTON2_CHAIN_ID = 114;

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
];

const STAKING_BOOST_ABI = [
  "function stake(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function getStakeInfo(address user) external view returns (uint256 amount, uint256 stakedAt, uint256 unlockTime)",
  "function getBoost(address user) external view returns (uint256)",
  "function stakes(address) external view returns (uint256 amount, uint256 stakedAt)",
];

export interface OnChainStakeInfo {
  amount: bigint;
  stakedAt: bigint;
  unlockTime: bigint;
  boostBps: bigint;
  isLocked: boolean;
}

export interface StakingContractHook {
  isLoading: boolean;
  error: string | null;
  txHash: string | null;
  getStakeInfo: () => Promise<OnChainStakeInfo | null>;
  approveAndStake: (amount: string) => Promise<{ success: boolean; txHash?: string; error?: string }>;
  withdraw: (amount: string) => Promise<{ success: boolean; txHash?: string; error?: string }>;
  checkAllowance: (amount: string) => Promise<boolean>;
}

export function useStakingContract(): StakingContractHook {
  const { evmAddress, walletConnectProvider } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const getProvider = useCallback(() => {
    return new ethers.JsonRpcProvider(COSTON2_RPC);
  }, []);

  const getSigner = useCallback(async () => {
    if (!walletConnectProvider || !evmAddress) {
      throw new Error("Wallet not connected. Please connect your EVM wallet first.");
    }

    const provider = new ethers.BrowserProvider(walletConnectProvider as any);
    return provider.getSigner();
  }, [walletConnectProvider, evmAddress]);

  const getStakeInfo = useCallback(async (): Promise<OnChainStakeInfo | null> => {
    if (!evmAddress) return null;

    try {
      const provider = getProvider();
      const stakingContract = new ethers.Contract(STAKING_BOOST_ADDRESS, STAKING_BOOST_ABI, provider);
      
      const [amount, stakedAt, unlockTime] = await stakingContract.getStakeInfo(evmAddress);
      const boostBps = await stakingContract.getBoost(evmAddress);
      
      const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
      const isLocked = stakedAt > BigInt(0) && currentTimestamp < unlockTime;

      return {
        amount,
        stakedAt,
        unlockTime,
        boostBps,
        isLocked,
      };
    } catch (err) {
      console.error("Failed to get stake info from contract:", err);
      return null;
    }
  }, [evmAddress, getProvider]);

  const checkAllowance = useCallback(async (amount: string): Promise<boolean> => {
    if (!evmAddress) return false;

    try {
      const provider = getProvider();
      const shieldContract = new ethers.Contract(SHIELD_TOKEN_ADDRESS, ERC20_ABI, provider);
      
      const amountWei = ethers.parseEther(amount);
      const allowance = await shieldContract.allowance(evmAddress, STAKING_BOOST_ADDRESS);
      
      return allowance >= amountWei;
    } catch (err) {
      console.error("Failed to check allowance:", err);
      return false;
    }
  }, [evmAddress, getProvider]);

  const approveAndStake = useCallback(async (amount: string): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    console.log("approveAndStake called:", { amount, evmAddress, hasProvider: !!walletConnectProvider });
    
    if (!evmAddress || !walletConnectProvider) {
      console.error("Missing wallet connection:", { evmAddress, hasProvider: !!walletConnectProvider });
      return { success: false, error: "Wallet not connected. Please connect your EVM wallet first." };
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      console.log("Getting signer from WalletConnect provider...");
      console.log("Provider session:", walletConnectProvider.session);
      console.log("Provider namespaces:", walletConnectProvider.session?.namespaces);
      
      const signer = await getSigner();
      console.log("Signer obtained:", await signer.getAddress());
      
      const shieldContract = new ethers.Contract(SHIELD_TOKEN_ADDRESS, ERC20_ABI, signer);
      const stakingContract = new ethers.Contract(STAKING_BOOST_ADDRESS, STAKING_BOOST_ABI, signer);
      
      const amountWei = ethers.parseEther(amount);
      console.log("Amount in wei:", amountWei.toString());

      console.log("Checking current allowance...");
      const currentAllowance = await shieldContract.allowance(evmAddress, STAKING_BOOST_ADDRESS);
      console.log("Current allowance:", currentAllowance.toString());
      
      if (currentAllowance < amountWei) {
        console.log("Approving SHIELD tokens for staking...");
        const approveTx = await shieldContract.approve(STAKING_BOOST_ADDRESS, amountWei);
        console.log("Approval tx submitted:", approveTx.hash);
        await approveTx.wait();
        console.log("Approval confirmed");
      } else {
        console.log("Sufficient allowance already exists, skipping approval");
      }

      console.log("Staking SHIELD tokens...");
      const stakeTx = await stakingContract.stake(amountWei);
      console.log("Stake tx submitted:", stakeTx.hash);
      await stakeTx.wait();
      console.log("Stake confirmed");

      setTxHash(stakeTx.hash);
      setIsLoading(false);
      return { success: true, txHash: stakeTx.hash };
    } catch (err: any) {
      const errorMessage = err.reason || err.message || "Failed to stake";
      console.error("Staking error:", err);
      console.error("Error details:", { 
        code: err.code, 
        reason: err.reason, 
        message: err.message,
        data: err.data
      });
      setError(errorMessage);
      setIsLoading(false);
      return { success: false, error: errorMessage };
    }
  }, [evmAddress, walletConnectProvider, getSigner]);

  const withdraw = useCallback(async (amount: string): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    if (!evmAddress || !walletConnectProvider) {
      return { success: false, error: "Wallet not connected. Please connect your EVM wallet first." };
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      const signer = await getSigner();
      const stakingContract = new ethers.Contract(STAKING_BOOST_ADDRESS, STAKING_BOOST_ABI, signer);
      
      const amountWei = ethers.parseEther(amount);

      console.log("Withdrawing staked SHIELD tokens...");
      const withdrawTx = await stakingContract.withdraw(amountWei);
      console.log("Withdraw tx submitted:", withdrawTx.hash);
      await withdrawTx.wait();
      console.log("Withdraw confirmed");

      setTxHash(withdrawTx.hash);
      setIsLoading(false);
      return { success: true, txHash: withdrawTx.hash };
    } catch (err: any) {
      let errorMessage = err.reason || err.message || "Failed to withdraw";
      
      if (errorMessage.includes("Tokens still locked")) {
        errorMessage = "Your tokens are still locked. Please wait until the 30-day lock period ends.";
      } else if (errorMessage.includes("Insufficient stake")) {
        errorMessage = "You don't have enough staked tokens to withdraw this amount.";
      }
      
      console.error("Withdraw error:", err);
      setError(errorMessage);
      setIsLoading(false);
      return { success: false, error: errorMessage };
    }
  }, [evmAddress, walletConnectProvider, getSigner]);

  return {
    isLoading,
    error,
    txHash,
    getStakeInfo,
    approveAndStake,
    withdraw,
    checkAllowance,
  };
}
