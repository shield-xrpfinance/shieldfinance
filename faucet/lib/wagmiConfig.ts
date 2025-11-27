import { getDefaultConfig } from 'connectkit';
import { createConfig, http } from 'wagmi';
import { flareCoston2 } from './chains';

export const config = createConfig(
  getDefaultConfig({
    chains: [flareCoston2],
    transports: {
      [flareCoston2.id]: http('https://coston2-api.flare.network/ext/C/rpc'),
    },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
    appName: 'Shield Finance Faucet',
    appDescription: 'Get test SHIELD and wFLR tokens on Flare Coston2 testnet',
    appUrl: 'https://shield.finance',
    appIcon: 'https://shield.finance/logo.png',
  })
);

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
