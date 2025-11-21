import { Web3Auth } from "@web3auth/modal";
import { WEB3AUTH_NETWORK, WALLET_ADAPTERS } from "@web3auth/base";
import { Wallet } from "xrpl";
import * as secp256k1 from "@noble/secp256k1";

let web3auth: Web3Auth | null = null;
let currentNetwork: string | null = null;

export interface Web3AuthConfig {
  clientId: string;
  network: "mainnet" | "testnet";
}

export async function initWeb3Auth(config: Web3AuthConfig): Promise<Web3Auth> {
  // IMPORTANT: Current Web3Auth Client ID is configured for testnet (sapphire_devnet)
  // Always use testnet network regardless of app's network toggle
  const networkToUse = WEB3AUTH_NETWORK.SAPPHIRE_DEVNET;
  
  // Reset if network changed or if instance doesn't exist
  if (web3auth && currentNetwork !== networkToUse) {
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

  currentNetwork = networkToUse;

  // Note: For Web3Auth v10+, chain configuration must be done in the Web3Auth Dashboard
  // at https://dashboard.web3auth.io under your project settings
  web3auth = new Web3Auth({
    clientId: config.clientId,
    web3AuthNetwork: networkToUse,
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
  });

  await web3auth.init();

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
