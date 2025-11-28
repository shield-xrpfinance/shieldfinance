import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/lib/walletContext";
import { useWalletClient, useSwitchChain } from "wagmi";

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
  const { evmAddress, walletConnectProvider, provider: walletProvider } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  
  // Wagmi hooks for Reown AppKit transaction signing
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  
  const isReown = walletProvider === "reown";

  const getProvider = useCallback(() => {
    return new ethers.JsonRpcProvider(COSTON2_RPC);
  }, []);
  
  // Helper function to send transaction via appropriate provider
  const sendTransaction = useCallback(async (to: string, data: string): Promise<string> => {
    if (isReown && walletClient) {
      console.log("Sending transaction via Wagmi/Reown...");
      const hash = await walletClient.sendTransaction({
        to: to as `0x${string}`,
        data: data as `0x${string}`,
        account: evmAddress as `0x${string}`,
        chain: walletClient.chain,
      });
      return hash;
    } else if (walletConnectProvider) {
      console.log("Sending transaction via WalletConnect...");
      const hash = await walletConnectProvider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: evmAddress,
          to,
          data,
        }],
      }) as string;
      return hash;
    }
    throw new Error("No wallet provider available");
  }, [isReown, walletClient, walletConnectProvider, evmAddress]);
  
  // Helper function to ensure wallet is on Coston2 network
  const ensureCoston2Network = useCallback(async () => {
    console.log("Ensuring wallet is on Coston2 (chainId 114)...");
    if (isReown && switchChainAsync) {
      try {
        await switchChainAsync({ chainId: 114 });
        console.log("Chain switch successful via Wagmi");
      } catch (switchError: any) {
        console.log("Chain switch error:", switchError.message);
      }
    } else if (walletConnectProvider) {
      try {
        await walletConnectProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x72' }], // 114 in hex
        });
        console.log("Chain switch successful via WalletConnect");
      } catch (switchError: any) {
        console.log("Chain switch error:", switchError.code, switchError.message);
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
    }
  }, [isReown, switchChainAsync, walletConnectProvider]);

  const getSigner = useCallback(async () => {
    if (!walletConnectProvider || !evmAddress) {
      throw new Error("Wallet not connected. Please connect your EVM wallet first.");
    }

    await ensureCoston2Network();

    const provider = new ethers.BrowserProvider(walletConnectProvider as any, COSTON2_CHAIN_ID);
    return provider.getSigner();
  }, [walletConnectProvider, evmAddress, ensureCoston2Network]);

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
    console.log("approveAndStake called:", { amount, evmAddress, isReown, hasWalletClient: !!walletClient, hasProvider: !!walletConnectProvider });
    
    // Check for appropriate provider based on wallet type
    if (isReown) {
      if (!evmAddress || !walletClient) {
        console.error("Missing Reown wallet connection:", { evmAddress, hasWalletClient: !!walletClient });
        return { success: false, error: "Wallet not connected. Please connect your EVM wallet first." };
      }
    } else {
      if (!evmAddress || !walletConnectProvider) {
        console.error("Missing WalletConnect connection:", { evmAddress, hasProvider: !!walletConnectProvider });
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
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Ensure wallet is on Coston2 network
      await ensureCoston2Network();
      
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
        
        const iface = new ethers.Interface(ERC20_ABI);
        const approveData = iface.encodeFunctionData("approve", [STAKING_BOOST_ADDRESS, amountWei]);
        
        const approveTxHash = await sendTransaction(SHIELD_TOKEN_ADDRESS, approveData);
        console.log("Approval tx submitted:", approveTxHash);
        
        // Wait for confirmation using RPC provider
        const receipt = await rpcProvider.waitForTransaction(approveTxHash);
        console.log("Approval confirmed:", receipt?.hash);
        
        // Re-verify allowance after approval using RPC provider
        const newAllowance = await shieldReadContract.allowance(evmAddress, STAKING_BOOST_ADDRESS);
        console.log("New allowance after approval:", newAllowance.toString());
      } else {
        console.log("Sufficient allowance already exists, skipping approval");
      }

      console.log("Staking SHIELD tokens...");
      
      const stakingIface = new ethers.Interface(STAKING_BOOST_ABI);
      const stakeData = stakingIface.encodeFunctionData("stake", [amountWei]);
      
      const stakeTxHash = await sendTransaction(STAKING_BOOST_ADDRESS, stakeData);
      console.log("Stake tx submitted:", stakeTxHash);
      
      // Wait for confirmation
      const stakeReceipt = await rpcProvider.waitForTransaction(stakeTxHash);
      console.log("Stake confirmed:", stakeReceipt?.hash);

      setTxHash(stakeTxHash);
      setIsLoading(false);
      return { success: true, txHash: stakeTxHash };
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
  }, [evmAddress, isReown, walletClient, walletConnectProvider, getProvider, sendTransaction, ensureCoston2Network]);

  const withdraw = useCallback(async (amount: string): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    console.log("withdraw called:", { amount, evmAddress, isReown, hasWalletClient: !!walletClient, hasProvider: !!walletConnectProvider });
    
    // Check for appropriate provider based on wallet type
    if (isReown) {
      if (!evmAddress || !walletClient) {
        return { success: false, error: "Wallet not connected. Please connect your EVM wallet first." };
      }
    } else {
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
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Ensure wallet is on Coston2 network
      await ensureCoston2Network();

      const rpcProvider = getProvider();
      const amountWei = ethers.parseEther(amount);

      const stakingIface = new ethers.Interface(STAKING_BOOST_ABI);
      const withdrawData = stakingIface.encodeFunctionData("withdraw", [amountWei]);

      console.log("Withdrawing staked SHIELD tokens...");
      console.log("Withdraw amount:", amount, "SHIELD (", amountWei.toString(), "wei)");
      
      const withdrawTxHash = await sendTransaction(STAKING_BOOST_ADDRESS, withdrawData);
      console.log("Withdraw tx submitted:", withdrawTxHash);
      
      // Wait for confirmation
      const receipt = await rpcProvider.waitForTransaction(withdrawTxHash);
      console.log("Withdraw confirmed:", receipt?.hash);

      setTxHash(withdrawTxHash);
      setIsLoading(false);
      return { success: true, txHash: withdrawTxHash };
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
  }, [evmAddress, isReown, walletClient, walletConnectProvider, getProvider, sendTransaction, ensureCoston2Network]);

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
