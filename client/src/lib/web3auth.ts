import { Web3Auth } from "@web3auth/modal";
import { WEB3AUTH_NETWORK, WALLET_ADAPTERS, CHAIN_NAMESPACES } from "@web3auth/base";
import { CommonPrivateKeyProvider } from "@web3auth/base-provider";
import { Wallet } from "xrpl";
import * as secp256k1 from "@noble/secp256k1";

let web3auth: Web3Auth | null = null;
let currentNetwork: string | null = null;

export interface Web3AuthConfig {
  clientId: string;
  network: "mainnet" | "testnet";
}

export async function initWeb3Auth(config: Web3AuthConfig): Promise<Web3Auth> {
  // Use sapphire_devnet for testnet, sapphire_mainnet for mainnet
  const networkToUse = config.network === "mainnet" 
    ? WEB3AUTH_NETWORK.SAPPHIRE_MAINNET 
    : WEB3AUTH_NETWORK.SAPPHIRE_DEVNET;
  
  // Reset if network changed or if instance doesn't exist
  if (web3auth && currentNetwork !== config.network) {
    try {
      await web3auth.logout();
    } catch (e) {
      // Ignore logout errors
    }
    web3auth = null;
  }
  
  if (web3auth) {
    return web3auth;
  }

  currentNetwork = config.network;

  // Configure XRPL chain based on network (primary chain for Web3Auth Social Login)
  const xrplChainConfig = config.network === "mainnet" 
    ? {
        chainNamespace: CHAIN_NAMESPACES.OTHER,
        chainId: "0x1", // Generic ID for XRPL mainnet
        rpcTarget: "https://xrplcluster.com/",
        displayName: "XRP Ledger Mainnet",
        blockExplorer: "https://livenet.xrpl.org",
        ticker: "XRP",
        tickerName: "XRP",
        decimals: 6,
      }
    : {
        chainNamespace: CHAIN_NAMESPACES.OTHER,
        chainId: "0x2", // Generic ID for XRPL testnet
        rpcTarget: "https://s.altnet.rippletest.net:51234/",
        displayName: "XRP Ledger Testnet",
        blockExplorer: "https://testnet.xrpl.org",
        ticker: "XRP",
        tickerName: "XRP",
        decimals: 6,
      };

  // Create private key provider with chain config (required for v10)
  const privateKeyProvider = new CommonPrivateKeyProvider({
    config: { chainConfig: xrplChainConfig }
  });

  // Web3Auth configuration with chain support (works on free tier!)
  // Note: TypeScript may complain about chainConfig, but it's supported in v10.7+ runtime
  web3auth = new Web3Auth({
    clientId: config.clientId,
    web3AuthNetwork: networkToUse,
    privateKeyProvider: privateKeyProvider as any,
    chainConfig: xrplChainConfig,
    uiConfig: {
      appName: "Shield Finance",
      appUrl: window.location.origin,
      logoLight: window.location.origin + "/favicon.ico",
      logoDark: window.location.origin + "/favicon.ico",
      defaultLanguage: "en",
      mode: "light",
      theme: {
        primary: "#0052FF",
      },
      useLogoLoader: true,
    },
  } as any); // Type assertion: chainConfig is supported but may not be in type definitions

  await web3auth.init();

  console.log(`✅ Web3Auth initialized with ${config.network} XRPL configuration`);

  return web3auth;
}

export async function loginWithWeb3Auth(): Promise<{ address: string; privateKey: string } | null> {
  if (!web3auth) {
    throw new Error("Web3Auth not initialized");
  }

  const web3authProvider = await web3auth.connect();

  if (!web3authProvider) {
    return null;
  }

  // Get private key from Web3Auth (returns hex-encoded secp256k1 private key)
  const privateKeyHex = await web3authProvider.request({
    method: "private_key",
  });

  if (!privateKeyHex || typeof privateKeyHex !== "string") {
    throw new Error("Failed to get private key from Web3Auth");
  }

  // Remove '0x' prefix if present
  const cleanPrivateKey = privateKeyHex.startsWith('0x') 
    ? privateKeyHex.slice(2) 
    : privateKeyHex;

  // Convert hex string to Uint8Array for secp256k1
  const privateKeyBytes = new Uint8Array(cleanPrivateKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  // Derive the public key from the private key using @noble/secp256k1 (browser-native, no Buffer required)
  const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, true); // true = compressed format
  
  // Convert Uint8Array to hex string and uppercase
  const compressedPublicKey = Array.from(publicKeyBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  
  // Format private key for XRPL (33 bytes with 0x00 prefix for secp256k1)
  const formattedPrivateKey = '00' + cleanPrivateKey.toUpperCase();
  
  // Create the XRPL wallet instance with both keys
  const wallet = new Wallet(compressedPublicKey, formattedPrivateKey);
  
  return {
    address: wallet.address,
    privateKey: cleanPrivateKey,
  };
}

export async function logoutWeb3Auth(): Promise<void> {
  if (web3auth) {
    await web3auth.logout();
  }
}

export function getWeb3AuthInstance(): Web3Auth | null {
  return web3auth;
}
