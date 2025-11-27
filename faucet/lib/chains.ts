import { defineChain } from 'viem';

export const flareCoston2 = defineChain({
  id: 114,
  name: 'Flare Coston2',
  nativeCurrency: {
    name: 'Coston2 Flare',
    symbol: 'C2FLR',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://coston2-api.flare.network/ext/C/rpc'],
    },
    public: {
      http: ['https://coston2-api.flare.network/ext/C/rpc'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Coston2 Explorer',
      url: 'https://coston2-explorer.flare.network',
    },
  },
  testnet: true,
});

export const EXPLORER_URL = 'https://coston2-explorer.flare.network';

export function getTransactionUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function getAddressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}
