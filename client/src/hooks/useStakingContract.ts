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

    // Ensure the provider is enabled and connected to Coston2
    console.log("Requesting chain switch to Coston2 (chainId 114)...");
    try {
      // Request wallet to switch to Coston2 network (chainId 114)
      await walletConnectProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x72' }], // 114 in hex
      });
      console.log("Chain switch successful");
    } catch (switchError: any) {
      console.log("Chain switch error:", switchError.code, switchError.message);
      // If the chain doesn't exist in the wallet, add it
      if (switchError.code === 4902 || switchError.message?.includes('chain')) {
        console.log("Attempting to add Coston2 network to wallet...");
        try {
          await walletConnectProvider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x72',
              chainName: 'Flare Coston2 Testnet',
              nativeCurrency: { name: 'Coston2 Flare', symbol: 'C2FLR', decimals: 18 },
              rpcUrls: [COSTON2_RPC],
              blockExplorerUrls: ['https://coston2-explorer.flare.network'],
            }],
          });
          console.log("Network added successfully");
        } catch (addError) {
          console.error("Failed to add Coston2 network:", addError);
        }
      }
    }

    const provider = new ethers.BrowserProvider(walletConnectProvider as any, COSTON2_CHAIN_ID);
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

    // Validate that the WalletConnect session has an active EIP155 (EVM) namespace
    const session = walletConnectProvider.session;
    const evmAccounts = session?.namespaces?.eip155?.accounts || [];
    console.log("WalletConnect session validation:", { 
      hasSession: !!session, 
      evmAccounts,
      allNamespaces: session?.namespaces ? Object.keys(session.namespaces) : []
    });
    
    if (!session || evmAccounts.length === 0) {
      console.error("No active EVM session in WalletConnect");
      return { 
        success: false, 
        error: "EVM session not found. Please disconnect and reconnect using the EVM wallet option." 
      };
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Use direct RPC provider for read operations
      const rpcProvider = getProvider();
      const shieldReadContract = new ethers.Contract(SHIELD_TOKEN_ADDRESS, ERC20_ABI, rpcProvider);
      
      const amountWei = ethers.parseEther(amount);
      console.log("Amount in wei:", amountWei.toString());

      console.log("Checking current allowance via RPC provider...");
      const currentAllowance = await shieldReadContract.allowance(evmAddress, STAKING_BOOST_ADDRESS);
      console.log("Current allowance:", currentAllowance.toString());
      
      if (currentAllowance < amountWei) {
        console.log("Approving SHIELD tokens for staking...");
        console.log("Shield contract address:", SHIELD_TOKEN_ADDRESS);
        console.log("Staking boost address:", STAKING_BOOST_ADDRESS);
        
        // Use direct WalletConnect request instead of ethers.js to ensure transaction reaches wallet
        const iface = new ethers.Interface(ERC20_ABI);
        const approveData = iface.encodeFunctionData("approve", [STAKING_BOOST_ADDRESS, amountWei]);
        
        console.log("Sending approve transaction via WalletConnect request...");
        const approveTxHash = await walletConnectProvider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: evmAddress,
            to: SHIELD_TOKEN_ADDRESS,
            data: approveData,
          }],
        });
        console.log("Approval tx submitted:", approveTxHash);
        
        // Wait for confirmation using RPC provider
        const receipt = await rpcProvider.waitForTransaction(approveTxHash as string);
        console.log("Approval confirmed:", receipt?.hash);
        
        // Re-verify allowance after approval using RPC provider
        const newAllowance = await shieldReadContract.allowance(evmAddress, STAKING_BOOST_ADDRESS);
        console.log("New allowance after approval:", newAllowance.toString());
      } else {
        console.log("Sufficient allowance already exists, skipping approval");
      }

      console.log("Staking SHIELD tokens...");
      
      // Use direct WalletConnect request for stake transaction too
      const stakingIface = new ethers.Interface(STAKING_BOOST_ABI);
      const stakeData = stakingIface.encodeFunctionData("stake", [amountWei]);
      
      console.log("Sending stake transaction via WalletConnect request...");
      const stakeTxHash = await walletConnectProvider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: evmAddress,
          to: STAKING_BOOST_ADDRESS,
          data: stakeData,
        }],
      });
      console.log("Stake tx submitted:", stakeTxHash);
      
      // Wait for confirmation
      const stakeReceipt = await rpcProvider.waitForTransaction(stakeTxHash as string);
      console.log("Stake confirmed:", stakeReceipt?.hash);

      setTxHash(stakeTxHash as string);
      setIsLoading(false);
      return { success: true, txHash: stakeTxHash as string };
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
  }, [evmAddress, walletConnectProvider, getProvider]);

  const withdraw = useCallback(async (amount: string): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    if (!evmAddress || !walletConnectProvider) {
      return { success: false, error: "Wallet not connected. Please connect your EVM wallet first." };
    }

    // Validate WalletConnect session has EVM namespace
    const session = walletConnectProvider.session;
    const evmAccounts = session?.namespaces?.eip155?.accounts || [];
    if (!session || evmAccounts.length === 0) {
      return { 
        success: false, 
        error: "EVM session not found. Please disconnect and reconnect using the EVM wallet option." 
      };
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Ensure wallet is on Coston2 network
      console.log("Ensuring wallet is on Coston2 for withdraw...");
      try {
        await walletConnectProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x72' }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902 || switchError.message?.includes('chain')) {
          await walletConnectProvider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x72',
              chainName: 'Flare Coston2 Testnet',
              nativeCurrency: { name: 'Coston2 Flare', symbol: 'C2FLR', decimals: 18 },
              rpcUrls: [COSTON2_RPC],
              blockExplorerUrls: ['https://coston2-explorer.flare.network'],
            }],
          });
        }
      }

      const rpcProvider = getProvider();
      const amountWei = ethers.parseEther(amount);

      // Use direct WalletConnect request for withdraw transaction
      const stakingIface = new ethers.Interface(STAKING_BOOST_ABI);
      const withdrawData = stakingIface.encodeFunctionData("withdraw", [amountWei]);

      console.log("Withdrawing staked SHIELD tokens via WalletConnect...");
      console.log("Withdraw amount:", amount, "SHIELD (", amountWei.toString(), "wei)");
      
      const withdrawTxHash = await walletConnectProvider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: evmAddress,
          to: STAKING_BOOST_ADDRESS,
          data: withdrawData,
        }],
      });
      console.log("Withdraw tx submitted:", withdrawTxHash);
      
      // Wait for confirmation
      const receipt = await rpcProvider.waitForTransaction(withdrawTxHash as string);
      console.log("Withdraw confirmed:", receipt?.hash);

      setTxHash(withdrawTxHash as string);
      setIsLoading(false);
      return { success: true, txHash: withdrawTxHash as string };
    } catch (err: any) {
      let errorMessage = err.reason || err.message || "Failed to withdraw";
      
      // Handle specific contract errors
      if (errorMessage.includes("Tokens still locked") || errorMessage.includes("still locked")) {
        errorMessage = "Your tokens are still locked. Please wait until the 30-day lock period ends.";
      } else if (errorMessage.includes("Insufficient stake") || errorMessage.includes("Insufficient")) {
        errorMessage = "You don't have enough staked tokens to withdraw this amount.";
      } else if (errorMessage.includes("expired") || errorMessage.includes("Request expired")) {
        errorMessage = "Transaction request expired. Please try again.";
      } else if (errorMessage.includes("rejected") || errorMessage.includes("denied")) {
        errorMessage = "Transaction was rejected in your wallet.";
      }
      
      console.error("Withdraw error:", err);
      console.error("Withdraw error details:", { 
        code: err.code, 
        reason: err.reason, 
        message: err.message 
      });
      setError(errorMessage);
      setIsLoading(false);
      return { success: false, error: errorMessage };
    }
  }, [evmAddress, walletConnectProvider, getProvider]);

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
