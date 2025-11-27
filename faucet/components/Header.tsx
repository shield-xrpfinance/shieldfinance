'use client';

import { ConnectKitButton } from 'connectkit';
import { Shield } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b border-cyber-border bg-cyber-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyber-cyan to-cyber-cyan-light">
              <Shield className="w-6 h-6 text-cyber-bg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Shield Finance</h1>
              <p className="text-xs text-cyber-muted">Testnet Faucet</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyber-cyan/10 border border-cyber-cyan/30">
              <div className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse" />
              <span className="text-sm text-cyber-cyan font-medium">Coston2 Testnet</span>
            </div>
            
            <ConnectKitButton.Custom>
              {({ isConnected, show, truncatedAddress, ensName }) => (
                <button
                  onClick={show}
                  data-testid="button-connect-wallet"
                  className="px-4 py-2 rounded-xl font-medium transition-all duration-200 
                    bg-gradient-to-r from-cyber-cyan to-cyber-cyan-light text-cyber-bg
                    hover:shadow-lg hover:shadow-cyber-cyan/25 hover:scale-105
                    active:scale-95"
                >
                  {isConnected ? (ensName ?? truncatedAddress) : 'Connect Wallet'}
                </button>
              )}
            </ConnectKitButton.Custom>
          </div>
        </div>
      </div>
    </header>
  );
}
