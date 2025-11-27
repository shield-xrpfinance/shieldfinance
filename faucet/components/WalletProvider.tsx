'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { ConnectKitProvider } from 'connectkit';
import { config } from '@/lib/wagmiConfig';
import { useState, type ReactNode } from 'react';

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          theme="midnight"
          mode="dark"
          customTheme={{
            '--ck-font-family': 'Inter, sans-serif',
            '--ck-accent-color': '#00E0FF',
            '--ck-accent-text-color': '#0a0f1a',
            '--ck-body-background': '#0f172a',
            '--ck-body-background-secondary': '#1e293b',
            '--ck-body-background-tertiary': '#0a0f1a',
            '--ck-body-color': '#e2e8f0',
            '--ck-body-color-muted': '#94a3b8',
            '--ck-body-color-muted-hover': '#e2e8f0',
            '--ck-border-radius': '12px',
            '--ck-primary-button-background': '#00E0FF',
            '--ck-primary-button-color': '#0a0f1a',
            '--ck-primary-button-hover-background': '#22d3ee',
            '--ck-secondary-button-background': '#1e293b',
            '--ck-secondary-button-color': '#e2e8f0',
            '--ck-secondary-button-hover-background': '#334155',
          }}
          options={{
            enforceSupportedChains: true,
            initialChainId: 114,
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
