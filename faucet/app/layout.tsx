import type { Metadata } from 'next';
import { WalletProvider } from '@/components/WalletProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shield Finance Faucet | Flare Coston2 Testnet',
  description: 'Get free test SHIELD and wFLR tokens on the Flare Coston2 testnet for development and testing.',
  keywords: ['Shield Finance', 'Faucet', 'Flare', 'Coston2', 'Testnet', 'SHIELD', 'wFLR'],
  openGraph: {
    title: 'Shield Finance Faucet',
    description: 'Get free test SHIELD and wFLR tokens on Flare Coston2 testnet',
    type: 'website',
    siteName: 'Shield Finance',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shield Finance Faucet',
    description: 'Get free test SHIELD and wFLR tokens on Flare Coston2 testnet',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen flex flex-col bg-cyber-bg">
        <WalletProvider>
          <Header />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
