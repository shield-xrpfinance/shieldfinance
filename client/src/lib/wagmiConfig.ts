import { http, createStorage, cookieStorage } from "wagmi";
import { flare, flareTestnet } from "wagmi/chains";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { type AppKitNetwork } from "@reown/appkit/networks";

export const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";

if (!projectId && typeof window !== "undefined") {
  console.warn("VITE_WALLETCONNECT_PROJECT_ID not configured - Reown AppKit will not function");
}

export const metadata = {
  name: "Shield Finance",
  description: "Earn yield on your XRP with liquid staking",
  url: typeof window !== "undefined" ? window.location.origin : "https://shyield.finance",
  icons: [typeof window !== "undefined" ? window.location.origin + "/favicon.ico" : "https://shyield.finance/favicon.ico"],
};

const flareMainnet: AppKitNetwork = {
  id: 14,
  name: "Flare",
  nativeCurrency: {
    name: "Flare",
    symbol: "FLR",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://flare-api.flare.network/ext/C/rpc"],
    },
  },
  blockExplorers: {
    default: {
      name: "Flare Explorer",
      url: "https://flare-explorer.flare.network",
    },
  },
};

const flareCoston2: AppKitNetwork = {
  id: 114,
  name: "Coston2",
  nativeCurrency: {
    name: "Coston2 Flare",
    symbol: "C2FLR",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://coston2-api.flare.network/ext/C/rpc"],
    },
  },
  blockExplorers: {
    default: {
      name: "Coston2 Explorer",
      url: "https://coston2-explorer.flare.network",
    },
  },
};

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  flareMainnet,
  flareCoston2,
];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: false,
  projectId,
  networks,
  transports: {
    [flare.id]: http("https://flare-api.flare.network/ext/C/rpc"),
    [flareTestnet.id]: http("https://coston2-api.flare.network/ext/C/rpc"),
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
