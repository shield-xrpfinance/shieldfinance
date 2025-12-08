import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  ArrowRight, 
  Shield,
  Lock, 
  Zap,
  CheckCircle2,
  Users,
  Droplets,
  Menu,
  X,
  ExternalLink,
  FileText,
  Quote,
  Vote,
  Sparkles,
  RefreshCw,
  Eye,
  Wallet
} from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { useShieldLogo } from "@/components/ShieldLogo";
import flareLogo from "@assets/flr.svg";
import xrpLogo from "@assets/xrp.148c3b50_1762588566535.png";
import xamanLogo from "@assets/xaman-wallet-icon.svg";
import shieldTokenLogo from "@assets/shield_logo_1763760253079.png";
import flareHorizontalLogo from "@assets/flare-horizontal-white.svg";
import xrplHorizontalLogo from "@assets/xrpl-horizontal-white.svg";
import xamanHorizontalLogo from "@assets/xaman-horizontal-white.svg";
import bifrostHorizontalLogo from "@assets/bifrost-horizontal-white.svg";
import layerzeroHorizontalLogo from "@assets/layerzero-horizontal-white.svg";
import founderPhoto from "@assets/Founder_Profile_pic_1765161729767.jpg";
import ramiAvatar from "@assets/Rami_Avatar_Shield_Finance_Profile_Pic_1765163589082.jpg";
interface VaultStats {
  exchangeRate: string;
  apy: string;
  tvl: string;
  stakerCount: number;
  isLive: boolean;
  timestamp: string;
}

// Throttle utility for performance optimization
function throttle<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  let lastCall = 0;
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  }) as T;
}

export default function Landing() {
  const shieldLogo = useShieldLogo();
  const heroAnimation = useScrollAnimation();
  const featuresAnimation = useScrollAnimation();
  const howItWorksAnimation = useScrollAnimation();
  const securityAnimation = useScrollAnimation();
  const ctaAnimation = useScrollAnimation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Track scroll position for nav blur effect
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const { data: vaultStats, isLoading: isLoadingStats } = useQuery<VaultStats>({
    queryKey: ['/api/public/vault-stats'],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Initialize Unicorn Studio animation after component mounts
  useEffect(() => {
    const initUnicornStudio = () => {
      if (typeof window !== 'undefined' && (window as any).UnicornStudio) {
        (window as any).UnicornStudio.init();
      }
    };

    // Try to initialize immediately
    initUnicornStudio();

    // Also try after a short delay in case script hasn't loaded yet
    const timer = setTimeout(initUnicornStudio, 1000);

    return () => clearTimeout(timer);
  }, []);

  const formatTvl = (tvl: string): string => {
    const num = parseFloat(tvl);
    if (isNaN(num) || num === 0) return "$0";
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  const handleMobileNavClick = (href: string) => {
    setMobileMenuOpen(false);
    if (href.startsWith('#')) {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  // Spotlight card mouse tracking
  const handleSpotlightMove = useMemo(() => {
    return throttle((e: React.MouseEvent<HTMLDivElement>) => {
      const card = e.currentTarget;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    }, 16); // ~60fps
  }, []);

  useEffect(() => {
    document.title = "Shield Finance - XRP Liquid Staking Protocol | Security Audited & Live on Testnet";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "Stake your XRP and earn rewards with Shield Finance. Security audited smart contracts, Xaman xApp integration, dual XRPL/EVM wallet support, and 100% gasless deposits. Live on Coston2 testnet."
      );
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'Stake your XRP and earn rewards with Shield Finance. Security audited smart contracts, Xaman xApp integration, dual XRPL/EVM wallet support, and 100% gasless deposits. Live on Coston2 testnet.';
      document.head.appendChild(meta);
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute("content", "Shield Finance - XRP Liquid Staking Protocol");
    } else {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:title');
      meta.content = 'Shield Finance - XRP Liquid Staking Protocol';
      document.head.appendChild(meta);
    }

    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      ogDescription.setAttribute(
        "content",
        "Stake your XRP and earn rewards while maintaining liquidity. Featuring gasless deposits, automated recovery systems, and multi-strategy vaults. Built on Flare Network."
      );
    } else {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:description');
      meta.content = 'Stake your XRP and earn rewards while maintaining liquidity. Featuring gasless deposits, automated recovery systems, and multi-strategy vaults. Built on Flare Network.';
      document.head.appendChild(meta);
    }

    const ogType = document.querySelector('meta[property="og:type"]');
    if (!ogType) {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:type');
      meta.content = 'website';
      document.head.appendChild(meta);
    }

  }, []);

  return (
    <div className="min-h-screen bg-[#030303] text-white overflow-x-hidden selection:bg-primary selection:text-black relative">
      {/* Full-width blur backdrop for navigation - only visible when scrolled */}
      <div className={`fixed top-0 left-0 w-full h-20 z-40 backdrop-blur-xl bg-gradient-to-b from-black/50 to-transparent pointer-events-none transition-opacity duration-300 ${isScrolled ? 'opacity-100' : 'opacity-0'}`} />
      {/* Floating Pill Navigation - Aura Style */}
      <nav className="fixed left-1/2 -translate-x-1/2 flex w-full lg:w-fit max-w-[90vw] z-50 rounded-full ring-white/10 ring-1 py-1.5 pr-1.5 pl-4 top-6 items-center justify-between transition-all duration-300 hover:border-white/20 hover:shadow-primary/5 bg-gradient-to-br from-white/10 to-white/0 shadow-[0_2.8px_2.2px_rgba(0,_0,_0,_0.034),_0_6.7px_5.3px_rgba(0,_0,_0,_0.048),_0_12.5px_10px_rgba(0,_0,_0,_0.06),_0_22.3px_17.9px_rgba(0,_0,_0,_0.072),_0_41.8px_33.4px_rgba(0,_0,_0,_0.086),_0_100px_80px_rgba(0,_0,_0,_0.12)]" data-testid="nav-header">
        {/* Logo Area */}
        <div className="flex gap-2.5 items-center mr-8">
          <img src={shieldLogo} alt="Shield Finance" className="h-6 w-6" data-testid="img-logo" />
          <span className="font-sans font-medium text-base tracking-tight text-white">Shield</span>
        </div>

        {/* Links (Hidden on small screens) */}
        <div className="hidden md:flex items-center gap-6 mr-8">
          <a href="#features" className="text-xs font-medium text-white/50 hover:text-white transition-colors" data-testid="link-nav-features">Features</a>
          <a href="#how-it-works" className="text-xs font-medium text-white/50 hover:text-white transition-colors" data-testid="link-nav-how-it-works">How It Works</a>
          <a href="#security" className="text-xs font-medium text-white/50 hover:text-white transition-colors" data-testid="link-nav-security">Security</a>
          <a href="https://docs.shyield.finance" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-white/50 hover:text-white transition-colors" data-testid="link-nav-docs">Docs</a>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-white/70 hover:text-white p-2 mr-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          data-testid="button-mobile-menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Action Button */}
        <Link href="/app">
          <button className="flex gap-2 hover:bg-primary transition-colors group text-xs font-semibold text-black bg-white rounded-full py-2 px-4 items-center" data-testid="button-launch-app">
            Launch App
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </Link>
      </nav>
      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 w-[90vw] max-w-md z-50 rounded-2xl glass-card p-4" data-testid="mobile-menu">
          <nav className="flex flex-col space-y-1">
            <a 
              href="#features" 
              onClick={() => handleMobileNavClick('#features')}
              className="flex items-center gap-3 text-white/70 hover:text-white hover:bg-white/5 px-4 py-3 rounded-lg transition-all"
              data-testid="link-mobile-features"
            >
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-medium">Features</span>
            </a>
            <a 
              href="#how-it-works" 
              onClick={() => handleMobileNavClick('#how-it-works')}
              className="flex items-center gap-3 text-white/70 hover:text-white hover:bg-white/5 px-4 py-3 rounded-lg transition-all"
              data-testid="link-mobile-how-it-works"
            >
              <Zap className="h-5 w-5 text-primary" />
              <span className="font-medium">How It Works</span>
            </a>
            <a 
              href="#security" 
              onClick={() => handleMobileNavClick('#security')}
              className="flex items-center gap-3 text-white/70 hover:text-white hover:bg-white/5 px-4 py-3 rounded-lg transition-all"
              data-testid="link-mobile-security"
            >
              <Lock className="h-5 w-5 text-primary" />
              <span className="font-medium">Security</span>
            </a>
            
            <div className="border-t border-white/10 my-2" />
            
            <a 
              href="https://docs.shyield.finance" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-between text-white/70 hover:text-white hover:bg-white/5 px-4 py-3 rounded-lg transition-all"
              data-testid="link-mobile-docs"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium">Documentation</span>
              </div>
              <ExternalLink className="h-4 w-4 text-white/40" />
            </a>
            <a 
              href="https://blog.shyield.finance" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-between text-white/70 hover:text-white hover:bg-white/5 px-4 py-3 rounded-lg transition-all"
              data-testid="link-mobile-blog"
            >
              <div className="flex items-center gap-3">
                <Quote className="h-5 w-5 text-primary" />
                <span className="font-medium">Blog</span>
              </div>
              <ExternalLink className="h-4 w-4 text-white/40" />
            </a>
            <a 
              href="https://vote.shyield.finance" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-between text-white/70 hover:text-white hover:bg-white/5 px-4 py-3 rounded-lg transition-all"
              data-testid="link-mobile-governance"
            >
              <div className="flex items-center gap-3">
                <Vote className="h-5 w-5 text-primary" />
                <span className="font-medium">Governance</span>
              </div>
              <ExternalLink className="h-4 w-4 text-white/40" />
            </a>
          </nav>
        </div>
      )}
      {/* UnicornStudio Animated Background - Aura Structure */}
      <div 
        className="fixed top-0 w-full h-screen -z-10" 
        data-alpha-mask="80" 
        style={{maskImage: 'linear-gradient(transparent, black 0%, black 80%, transparent)'}}
      >
        <div className="absolute top-0 w-full h-full -z-10">
          <div className="absolute w-full h-full left-0 top-0 -z-10 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/5" />
        </div>
      </div>
      {/* Grid Background - Aura Style */}
      <div className="fixed inset-0 grid-bg pointer-events-none z-0" />
      {/* Unicorn Studio Background Animation - Aura Style with Gradient Mask */}
      <div 
        className="fixed top-0 w-full h-screen z-0 pointer-events-none"
        style={{ 
          maskImage: 'linear-gradient(transparent, black 0%, black 80%, transparent)',
          WebkitMaskImage: 'linear-gradient(transparent, black 0%, black 80%, transparent)'
        }}
      >
        <div 
          data-us-project="se1doOOXCba86nWdhX3D" 
          className="w-full h-full absolute inset-0"
          style={{ minWidth: '100vw', minHeight: '100vh' }}
        />
      </div>
      {/* Hero Section */}
      <main className="container lg:px-12 lg:pt-0 min-h-[1100px] flex flex-col lg:flex-row z-10 mx-auto pt-0 px-6 relative items-center bg-[#0000008f]">
        {/* Left Column: Copy */}
        <div ref={heroAnimation.ref} className={`lg:w-1/2 flex flex-col w-full pt-32 lg:pt-0 pb-20 lg:pb-0 justify-center ${heroAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          {/* Status Badge */}
          <h4 className="text-xs font-mono tracking-[0.2em] text-white/40 uppercase mb-8 flex items-center gap-2" data-testid="badge-status">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Live on Testnet
          </h4>

          <h1 className="lg:text-7xl leading-[1.1] text-primary text-glow text-5xl italic tracking-tight font-serif mb-6" data-testid="heading-hero">
            Liquid Staking for <br />
            <span className="text-white opacity-90">XRP Ledger</span>
          </h1>

          <p className="font-sans text-xl lg:text-2xl font-light text-white/70 leading-relaxed tracking-tight max-w-xl mb-12" data-testid="text-hero-subtitle">
            Stake your XRP and earn rewards while maintaining full liquidity. Access XRPFi opportunities without locking your assets.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            {/* Shiny CTA Button */}
            <Link href="/app">
              <button className="shiny-cta" data-testid="button-hero-start">
                <span>Start Staking</span>
              </button>
            </Link>

            {/* Secondary Button with Gradient Border */}
            <a href="https://faucet.shyield.finance/" target="_blank" rel="noopener noreferrer">
              <button 
                className="gradient-border-btn hover:bg-white/10 hover:text-white transition-all flex text-sm font-medium text-slate-300 py-3 px-6 gap-2 items-center group"
                data-testid="button-hero-faucet"
              >
                <Droplets className="h-4 w-4" />
                <span className="tracking-tight">Get Test Tokens</span>
                <ArrowRight className="h-4 w-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>
            </a>
          </div>

          {/* Partner Logos - Aura Template Style with Marquee */}
          <div className="flex flex-col gap-4 mt-16 w-full max-w-xl" data-testid="inline-partner-logos">
            <span className="text-xs text-white/60 font-mono uppercase tracking-wide" data-testid="text-trusted-by">
              [ <span className="text-primary">✓</span> ] Built with Leading Technologies
            </span>
            {/* Viewport: overflow hidden with mask gradient */}
            <div className="overflow-hidden w-full relative">
              {/* Track: handles the mask gradient fade */}
              <div className="mask-gradient-fade">
                {/* Items: animated flex container */}
                <div className="flex animate-marquee w-max gap-x-12 items-center opacity-60">
                  {/* Original Set */}
                  <img src={flareHorizontalLogo} alt="Flare" className="h-6 w-auto flex-shrink-0" data-testid="img-flare-inline" />
                  <img src={xrplHorizontalLogo} alt="XRPL" className="h-6 w-auto flex-shrink-0" data-testid="img-xrpl-inline" />
                  <img src={xamanHorizontalLogo} alt="Xaman" className="h-6 w-auto flex-shrink-0" data-testid="img-xaman-inline" />
                  <img src={bifrostHorizontalLogo} alt="Bifrost" className="h-6 w-auto flex-shrink-0" data-testid="img-bifrost-inline" />
                  <img src={layerzeroHorizontalLogo} alt="LayerZero" className="h-6 w-auto flex-shrink-0" data-testid="img-layerzero-inline" />
                  {/* Duplicate Set for Seamless Loop */}
                  <img src={flareHorizontalLogo} alt="Flare" className="h-6 w-auto flex-shrink-0" />
                  <img src={xrplHorizontalLogo} alt="XRPL" className="h-6 w-auto flex-shrink-0" />
                  <img src={xamanHorizontalLogo} alt="Xaman" className="h-6 w-auto flex-shrink-0" />
                  <img src={bifrostHorizontalLogo} alt="Bifrost" className="h-6 w-auto flex-shrink-0" />
                  <img src={layerzeroHorizontalLogo} alt="LayerZero" className="h-6 w-auto flex-shrink-0" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Abstract UI Visualization */}
        <div className="lg:w-1/2 lg:h-[800px] flex w-full h-[400px] relative items-center justify-center">
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible" viewBox="0 0 600 600">
            {/* Connecting Beams */}
            <g>
              <path d="M -50 150 C 100 150, 100 300, 300 300" fill="none" stroke="white" strokeWidth="1" className="opacity-[0.08]" />
              <path d="M -50 150 C 100 150, 100 300, 300 300" fill="none" stroke="#38BDF8" strokeWidth="1.5" className="beam-line animate-beam opacity-60" />
            </g>
            <g>
              <path d="M -50 450 C 100 450, 100 300, 300 300" fill="none" stroke="white" strokeWidth="1" className="opacity-[0.08]" />
              <path d="M -50 450 C 100 450, 100 300, 300 300" fill="none" stroke="#38BDF8" strokeWidth="1.5" className="beam-line animate-beam opacity-60" style={{animationDelay: '-1s'}} />
            </g>
            <g>
              <path d="M 650 100 C 500 100, 500 300, 300 300" fill="none" stroke="white" strokeWidth="1" className="opacity-[0.08]" />
              <path d="M 650 100 C 500 100, 500 300, 300 300" fill="none" stroke="#38BDF8" strokeWidth="1.5" className="beam-line animate-beam opacity-60" style={{animationDelay: '-2s'}} />
            </g>
            <g>
              <path d="M 650 500 C 500 500, 500 300, 300 300" fill="none" stroke="white" strokeWidth="1" className="opacity-[0.08]" />
              <path d="M 650 500 C 500 500, 500 300, 300 300" fill="none" stroke="#38BDF8" strokeWidth="1.5" className="beam-line animate-beam opacity-60" style={{animationDelay: '-1.5s'}} />
            </g>

            {/* Central Node */}
            <g transform="translate(300, 300)">
              {/* Sonar Waves */}
              <circle r="20" fill="none" stroke="#38BDF8" strokeWidth="1" opacity="0.5" className="animate-sonar" />
              <circle r="20" fill="none" stroke="#38BDF8" strokeWidth="1" opacity="0.5" className="animate-sonar delay-1000" />
              <circle r="20" fill="none" stroke="#38BDF8" strokeWidth="1" opacity="0.5" className="animate-sonar delay-2000" />

              {/* Technical Rings */}
              <circle r="65" fill="none" stroke="white" strokeOpacity="0.1" strokeWidth="1" strokeDasharray="10 20" className="animate-spin-slow" />
              <circle r="45" fill="none" stroke="#38BDF8" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="4 6" className="animate-spin-slow-reverse" />

              {/* Crosshair Markers */}
              <g className="animate-spin-slow" style={{animationDuration: '20s'}}>
                <path d="M -80 0 L -70 0" stroke="white" strokeOpacity="0.2" />
                <path d="M 80 0 L 70 0" stroke="white" strokeOpacity="0.2" />
                <path d="M 0 -80 L 0 -70" stroke="white" strokeOpacity="0.2" />
                <path d="M 0 80 L 0 70" stroke="white" strokeOpacity="0.2" />
              </g>

              {/* Core */}
              <circle r="8" fill="#0A0A0A" stroke="#38BDF8" strokeWidth="2" />
              <circle r="4" fill="#38BDF8" className="animate-pulse-fast" />
            </g>
          </svg>

          {/* Floating Labels */}
          <div className="absolute top-[20%] lg:top-[25%] left-[10%] lg:left-[15%] flex flex-col items-end">
            <span className="text-xs font-mono text-primary tracking-widest mb-1 opacity-80">GASLESS DEPOSITS</span>
            <div className="h-[1px] w-12 bg-gradient-to-l from-primary to-transparent" />
          </div>

          <div className="absolute bottom-[20%] lg:bottom-[25%] right-[10%] lg:right-[15%] flex flex-col items-start">
            <span className="text-xs font-mono text-primary tracking-widest mb-1 opacity-80">XRPFI NATIVE</span>
            <div className="h-[1px] w-12 bg-gradient-to-r from-primary to-transparent" />
          </div>

          {/* Extra Data Decoration */}
          <div className="absolute top-[50%] right-[15%] hidden lg:flex flex-col gap-1">
            <div className="flex gap-1">
              <div className="w-1 h-1 bg-white/20" />
              <div className="w-1 h-1 bg-white/20" />
              <div className="w-1 h-1 bg-primary animate-pulse" />
            </div>
          </div>
        </div>

      </main>
      {/* Features Section - Aura-Style with Terminal UI */}
      <section ref={featuresAnimation.ref} id="features" className="group relative z-10 py-32 border-t border-white/5 bg-black/50 backdrop-blur-3xl overflow-hidden" data-testid="section-features">
        {/* Clean Background Line */}
        <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        
        <div className={`max-w-7xl mx-auto px-6 lg:px-12 relative z-10 ${featuresAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          {/* Section Header with Vertical Beam */}
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-24 relative">
            {/* Vertical Beam Animation */}
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-48 w-6 overflow-hidden flex justify-center">
              <svg className="h-full w-full" viewBox="0 0 6 192" fill="none">
                <path d="M3 0V192" stroke="url(#header-beam)" strokeWidth="1.5" strokeLinecap="round" className="beam-line animate-beam opacity-70" />
                <defs>
                  <linearGradient id="header-beam" x1="3" y1="0" x2="3" y2="192" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#38BDF8" stopOpacity="0" />
                    <stop offset="0.5" stopColor="#38BDF8" />
                    <stop offset="1" stopColor="#38BDF8" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <div className="flex items-center gap-3 mb-8 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-xs font-mono text-primary uppercase tracking-[0.2em] font-medium">System Capabilities</span>
            </div>

            <h2 className="text-5xl md:text-6xl lg:text-7xl font-serif italic tracking-tight text-primary text-glow mb-8" data-testid="heading-features">
              Liquid staking <span className="text-white/60">made effortless.</span>
            </h2>

            <p className="text-xl text-white/60 leading-relaxed max-w-2xl font-light tracking-tight">
              Streamline your XRP yield with automated protocols designed to simplify, secure, and enhance your staking experience.
            </p>
          </div>

          {/* Feature Cards Grid - 3 Large Cards with Terminal UI */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Card 1: Gasless Deposits - Terminal/Chat UI */}
            <div className="spotlight-card group relative flex flex-col p-10 rounded-[32px] border border-white/10 bg-white/[0.02] overflow-hidden transition-all duration-500" onMouseMove={handleSpotlightMove} data-testid="card-feature-gasless">
              {/* Spotlight Background */}
              <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{background: 'radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(255, 255, 255, 0.06), transparent 40%)'}} />
              {/* Spotlight Border */}
              <div className="pointer-events-none absolute inset-0 rounded-[32px] border border-primary/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{maskImage: 'radial-gradient(300px circle at var(--mouse-x) var(--mouse-y), black, transparent)', WebkitMaskImage: 'radial-gradient(300px circle at var(--mouse-x) var(--mouse-y), black, transparent)'}} />

              <h3 className="text-2xl font-semibold tracking-tight text-white mb-4 relative z-10">Gasless Deposits</h3>
              <p className="text-base text-white/50 leading-relaxed mb-12 relative z-10 font-light">
                Deposit XRP without paying gas fees. Our smart contracts handle all transaction costs for seamless onboarding.
              </p>

              {/* Visual: Terminal/Chat UI */}
              <div className="relative z-10 mt-auto w-full h-72 rounded-2xl border border-white/10 bg-[#0A0A0A] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                  <div className="flex items-center gap-2 opacity-50">
                    <div className="w-2 h-2 rounded-full bg-white/40" />
                    <div className="w-2 h-2 rounded-full bg-white/40" />
                  </div>
                  <span className="text-xs text-white/30 font-mono">SHIELD_OS v1.0</span>
                </div>
                {/* Body */}
                <div className="p-6 flex flex-col gap-5 relative h-full">
                  {/* User Message */}
                  <div className="self-end max-w-[90%] bg-white/10 backdrop-blur-sm rounded-2xl rounded-tr-sm p-4 border border-white/5">
                    <p className="text-xs text-white/90 font-light leading-relaxed">
                      Deposit <span className="text-primary font-medium">1,000 XRP</span> to vault.
                      No gas fees required.
                    </p>
                  </div>

                  {/* System Message */}
                  <div className="self-start max-w-[90%] bg-white/[0.03] backdrop-blur-md rounded-2xl rounded-tl-sm p-5 border border-white/10 relative overflow-hidden group-hover:border-primary/20 transition-colors duration-500">
                    <div className="flex items-center gap-2 mb-3 text-primary font-mono text-[10px] uppercase tracking-wider">
                      <Sparkles className="h-3.5 w-3.5" />
                      Shield Protocol
                    </div>
                    <p className="mb-4 text-xs text-white/80 font-light">Bridge initiated. FAssets minting in progress.</p>

                    {/* Progress Bar */}
                    <div className="w-full bg-black/40 rounded-full h-1.5 mb-2 overflow-hidden">
                      <div className="bg-primary h-full w-[85%] animate-pulse" />
                    </div>
                    <div className="flex justify-between text-[10px] text-primary/60 font-mono">
                      <span>EXECUTING</span>
                      <span>1,000 XRP</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Smart Liquidity - Orbit Visualization (Center, Elevated) */}
            <div className="spotlight-card relative flex flex-col p-[1px] rounded-[32px] overflow-hidden lg:-mt-8 lg:mb-8 z-20 group" onMouseMove={handleSpotlightMove} data-testid="card-feature-liquidity">
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent rounded-[32px]" />
              <div className="absolute inset-0 bg-[#050505] rounded-[31px] m-[1px] overflow-hidden">
                <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0" style={{background: 'radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(255, 255, 255, 0.06), transparent 40%)'}} />
              </div>
              <div className="pointer-events-none absolute inset-0 rounded-[32px] border border-primary/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-50" style={{maskImage: 'radial-gradient(300px circle at var(--mouse-x) var(--mouse-y), black, transparent)', WebkitMaskImage: 'radial-gradient(300px circle at var(--mouse-x) var(--mouse-y), black, transparent)'}} />

              <div className="relative z-10 flex flex-col h-full p-10 group">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <Zap className="h-6 w-6 text-primary relative z-10" />
                  </div>
                  <h3 className="text-2xl font-semibold tracking-tight text-white group-hover:text-white transition-colors">Smart Liquidity</h3>
                </div>
                <p className="text-base text-white/50 leading-relaxed mb-12 font-light group-hover:text-white/70 transition-colors">
                  Receive shXRP tokens for your staked position. Trade, transfer, or use as collateral while earning rewards.
                </p>

                {/* Visual: Orbit & Sonar Visualization */}
                <div className="mt-auto relative w-full h-80 flex items-center justify-center">
                  {/* Sonar Rings - Using lighter animation for performance */}
                  <div className="absolute w-64 h-64 border border-primary/5 rounded-full animate-ping-light opacity-10" style={{animationDuration: '4s'}} />
                  <div className="absolute w-52 h-52 border border-white/5 rounded-full animate-ping-light opacity-20" style={{animationDuration: '3s', animationDelay: '0.7s'}} />

                  {/* Outer Rotating Ring */}
                  <div className="absolute w-48 h-48 border border-white/5 rounded-full animate-spin" style={{animationDuration: '40s'}}>
                    <div className="absolute top-1/2 -right-1 w-2 h-2 bg-white/10 rounded-full" />
                    <div className="absolute top-1/2 -left-1 w-2 h-2 bg-white/10 rounded-full" />
                  </div>

                  {/* Middle Rotating Ring */}
                  <div className="absolute w-44 h-44 border border-white/10 rounded-full animate-spin" style={{animationDuration: '30s'}} />

                  {/* Inner Dashed Ring */}
                  <div className="absolute w-32 h-32 border border-white/5 rounded-full border-dashed animate-spin" style={{animationDuration: '20s', animationDirection: 'reverse'}} />

                  {/* Active Glow Ring */}
                  <div className="absolute w-28 h-28 border border-primary/20 rounded-full animate-spin opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{animationDuration: '15s'}}>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary -mt-[3px] rounded-full shadow-[0_0_10px_rgba(56,189,248,1)]" />
                  </div>

                  {/* Orbiting Elements */}
                  <div className="absolute w-44 h-44 animate-spin" style={{animationDuration: '30s'}}>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#050505] p-2.5 rounded-full border border-white/10 group-hover:border-primary/30 group-hover:shadow-[0_0_20px_rgba(56,189,248,0.1)] transition-all duration-500">
                      <RefreshCw className="h-4 w-4 text-white/40 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="absolute bottom-0 right-1/2 translate-x-1/2 translate-y-1/2 bg-[#050505] p-2.5 rounded-full border border-white/10 group-hover:border-primary/30 group-hover:shadow-[0_0_20px_rgba(56,189,248,0.1)] transition-all duration-500">
                      <Wallet className="h-4 w-4 text-white/40 group-hover:text-primary transition-colors" />
                    </div>
                  </div>

                  {/* Central Hub */}
                  <div className="z-10 flex group-hover:border-primary/40 transition-colors duration-500 bg-[#0F110E] w-20 h-20 border-white/10 border rounded-2xl relative items-center justify-center overflow-hidden shadow-2xl">
                    <Shield className="h-8 w-8 text-white relative z-20 group-hover:text-primary transition-colors duration-500" />
                    <div className="animate-pulse bg-gradient-to-tr from-transparent via-primary/10 to-transparent absolute inset-0 z-10" />
                    <div className="absolute inset-0 opacity-20 z-0" style={{backgroundImage: 'radial-gradient(#fff 0.5px, transparent 0.5px)', backgroundSize: '12px 12px'}} />
                  </div>

                  {/* Status Label */}
                  <div className="absolute bottom-4 flex flex-col items-center">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 group-hover:border-primary/20 transition-colors">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-full w-full bg-green-400" />
                      </span>
                      <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Yield Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Security & Governance */}
            <div className="spotlight-card group relative flex flex-col p-10 rounded-[32px] border border-white/10 bg-white/[0.02] overflow-hidden transition-all duration-500" onMouseMove={handleSpotlightMove} data-testid="card-feature-security">
              {/* Spotlight Background */}
              <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{background: 'radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(255, 255, 255, 0.06), transparent 40%)'}} />
              {/* Spotlight Border */}
              <div className="pointer-events-none absolute inset-0 rounded-[32px] border border-primary/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{maskImage: 'radial-gradient(300px circle at var(--mouse-x) var(--mouse-y), black, transparent)', WebkitMaskImage: 'radial-gradient(300px circle at var(--mouse-x) var(--mouse-y), black, transparent)'}} />

              <h3 className="text-2xl font-semibold tracking-tight text-white mb-4 relative z-10">Security Audited</h3>
              <p className="text-base text-white/50 leading-relaxed mb-12 relative z-10 font-light">
                Smart contracts audited by leading security firms. Automated recovery systems protect your assets.
              </p>

              {/* Visual: Security/Governance Terminal */}
              <div className="relative z-10 mt-auto w-full h-72 rounded-2xl border border-white/10 bg-[#0A0A0A] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-white/60 font-mono">Security Status</span>
                  </div>
                  <Lock className="h-4 w-4 text-green-400" />
                </div>
                {/* Body */}
                <div className="p-5 flex flex-col gap-4 h-full">
                  {/* Audit Status */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                      <span className="text-xs text-white/80">Contract Audit</span>
                    </div>
                    <span className="text-xs text-green-400 font-mono">PASSED</span>
                  </div>

                  {/* Security Metrics */}
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/50">Slither Analysis</span>
                      <span className="text-green-400 font-mono">0 findings</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/50">Test Coverage</span>
                      <span className="text-primary font-mono">150+ tests</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/50">Recovery System</span>
                      <span className="text-green-400 font-mono">Active</span>
                    </div>
                  </div>

                  {/* Governance Status */}
                  <div className="pt-3 border-t border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-3 w-3 text-primary" />
                      <span className="text-[10px] text-white/40 uppercase tracking-wider font-mono">Active Proposals</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/60">SIP-003: Strategy Update</span>
                      <span className="text-primary animate-pulse">Voting</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
      {/* System Capabilities Section */}
      <section className="relative z-10 py-24 border-t border-white/5 bg-[#0000008f]" data-testid="section-capabilities">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          {/* Vertical Beam Header */}
          <div className="flex flex-col items-center mb-16">
            {/* Badge with ping dot */}
            <div className="flex items-center gap-2 mb-6" data-testid="badge-capabilities">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-xs font-mono tracking-[0.2em] text-white/40 uppercase">Core Infrastructure</span>
            </div>
            
            {/* Vertical Beam SVG */}
            <div className="relative h-16 w-px mb-6">
              <div className="absolute inset-0 bg-gradient-to-b from-primary via-primary/50 to-transparent" />
              <svg className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3" viewBox="0 0 12 12">
                <circle cx="6" cy="6" r="3" fill="#38BDF8" className="animate-pulse-fast" />
                <circle cx="6" cy="6" r="5" fill="none" stroke="#38BDF8" strokeWidth="1" opacity="0.5" />
              </svg>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary/30 rounded-full" />
            </div>
            
            <h2 className="text-4xl lg:text-5xl font-serif italic text-primary text-glow mb-4 text-center" data-testid="heading-capabilities">
              Protocol Capabilities
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto text-center">
              Advanced infrastructure powering the next generation of XRP staking
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Capability Card 1: Automated Execution */}
            <div className="glass-card spotlight-card rounded-2xl" onMouseMove={handleSpotlightMove} data-testid="card-capability-1">
              <div className="p-6 border-b border-white/5 relative z-10">
                <h3 className="text-lg font-semibold text-white mb-2">Automated Execution</h3>
                <p className="text-sm text-white/50">Smart contracts execute seamlessly</p>
              </div>
              <div className="bg-black/40 p-4 font-mono text-xs relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-white/60">Protocol Active</span>
                </div>
                <div className="space-y-2 text-white/40">
                  <div className="flex justify-between">
                    <span>{">"} deposit.execute()</span>
                    <span className="text-green-400">success</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{">"} yield.compound()</span>
                    <span className="text-green-400">success</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{">"} rewards.distribute()</span>
                    <span className="text-primary animate-pulse">pending...</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Capability Card 2: Smart Liquidity */}
            <div className="glass-card spotlight-card rounded-2xl" onMouseMove={handleSpotlightMove} data-testid="card-capability-2">
              <div className="p-6 border-b border-white/5 relative z-10">
                <h3 className="text-lg font-semibold text-white mb-2">Smart Liquidity</h3>
                <p className="text-sm text-white/50">Optimized yield strategies</p>
              </div>
              <div className="bg-black/40 p-4 relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-xs text-white/60">Firelight Strategy</span>
                  </div>
                  <span className="text-xs text-green-400">50%</span>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-400" />
                    <span className="text-xs text-white/60">Kinetic Strategy</span>
                  </div>
                  <span className="text-xs text-green-400">40%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-white/30" />
                    <span className="text-xs text-white/60">Buffer Reserve</span>
                  </div>
                  <span className="text-xs text-white/40">10%</span>
                </div>
                <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full flex">
                    <div className="bg-primary w-1/2" />
                    <div className="bg-purple-400 w-2/5" />
                    <div className="bg-white/30 w-[10%]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Capability Card 3: Multi-Sig Governance */}
            <div className="glass-card spotlight-card rounded-2xl" onMouseMove={handleSpotlightMove} data-testid="card-capability-3">
              <div className="p-6 border-b border-white/5 relative z-10">
                <h3 className="text-lg font-semibold text-white mb-2">DAO Governance</h3>
                <p className="text-sm text-white/50">Community-driven decisions</p>
              </div>
              <div className="bg-black/40 p-4 relative z-10">
                <div className="flex -space-x-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary/30 border-2 border-[#030303] flex items-center justify-center">
                    <Users className="h-3 w-3 text-primary" />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-purple-400/30 border-2 border-[#030303] flex items-center justify-center">
                    <Users className="h-3 w-3 text-purple-400" />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-green-400/30 border-2 border-[#030303] flex items-center justify-center">
                    <Users className="h-3 w-3 text-green-400" />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-[#030303] flex items-center justify-center text-xs text-white/60">
                    +42
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">SIP-001: Fee Reduction</span>
                    <span className="text-green-400">Passed</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">SIP-002: New Strategy</span>
                    <span className="text-primary">Voting</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Testimonial Section */}
      <section className="group relative z-10 py-24 border-t border-white/5 overflow-hidden bg-[#0000008f]" data-testid="section-testimonial">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl lg:text-6xl font-serif italic text-primary text-glow mb-6 leading-tight" data-testid="heading-testimonial">
                Built for the<br />
                <span className="text-white opacity-90">DeFi Economy</span>
              </h2>
              <p className="text-lg text-white/60 max-w-lg">
                Shield Finance bridges the gap between XRP liquidity and DeFi opportunities, enabling seamless participation in the decentralized economy.
              </p>
            </div>
            <div className="glass-card rounded-2xl p-8" data-testid="card-testimonial">
              <div className="flex items-center gap-4 mb-6">
                <img 
                  src={ramiAvatar} 
                  alt="Reyes - Shield Finance Community" 
                  className="w-16 h-16 rounded-full object-cover border-2 border-primary/30"
                />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">TESTNET</span>
                    <a href="https://x.com/Reyes39858414" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-white font-semibold hover:text-primary transition-colors group">
                      <span>Reyes</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="opacity-60 group-hover:opacity-100 transition-opacity">
                        <path d="m17.687 3.063l-4.996 5.711l-4.32-5.711H2.112l7.477 9.776l-7.086 8.099h3.034l5.469-6.25l4.78 6.25h6.102l-7.794-10.304l6.625-7.571zm-1.064 16.06L5.654 4.782h1.803l10.846 14.34z" />
                      </svg>
                    </a>
                  </div>
                  <p className="text-sm text-white/50">Community Member · Coston2 Tester</p>
                </div>
              </div>
              <blockquote className="text-xl text-white/80 italic leading-relaxed mb-6">
                "Finally, a way to earn yield on my XRP without giving up liquidity. The gasless deposits and shXRP tokens make DeFi accessible to everyone."
              </blockquote>
              <div className="flex items-center gap-6 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-sm text-white/60">Zero Gas Fees</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-sm text-white/60">Audited Contracts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Yield Infrastructure Section */}
      <section className="relative z-10 py-24 border-t border-white/5 bg-[#0000008f]" data-testid="section-yield">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl lg:text-5xl font-serif italic text-primary text-glow mb-6" data-testid="heading-yield">
                Stake & Earn<br />
                <span className="text-white opacity-90">Yield Instantly</span>
              </h2>
              <p className="text-lg text-white/60 mb-8">
                Multi-strategy vault architecture optimizes returns across multiple DeFi protocols while maintaining security and liquidity.
              </p>
              <Link href="/app">
                <button className="shiny-cta" data-testid="button-yield-start">
                  <span>Start Earning</span>
                </button>
              </Link>
            </div>
            <div className="glass-card rounded-2xl overflow-hidden" data-testid="card-yield-preview">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={xrpLogo} alt="XRP" className="h-8 w-8" />
                  <div>
                    <div className="font-semibold text-white">shXRP / XRP</div>
                    <div className="text-xs text-white/50">Liquid Staking Token</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-green-400" data-testid="text-exchange-rate">
                    {isLoadingStats ? (
                      <span className="inline-block w-16 h-6 bg-white/10 rounded animate-pulse" />
                    ) : (
                      "1.0234"
                    )}
                  </div>
                  <div 
                    className="text-xs flex items-center justify-end gap-1 text-green-400/80"
                    data-testid="text-yield-indicator"
                  >
                    {isLoadingStats ? (
                      <span className="inline-block w-20 h-3 bg-white/10 rounded animate-pulse" />
                    ) : (
                      <>
                        <span>↑</span>
                        <span>+2.34% yield</span>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-white/50 mt-1">Exchange Rate · Redeemable anytime</div>
                </div>
              </div>
              <div className="p-4 bg-black/40">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-white" data-testid="text-current-apy">
                      {isLoadingStats ? (
                        <span className="inline-block w-12 h-5 bg-white/10 rounded animate-pulse" />
                      ) : (
                        `${vaultStats?.apy || "0"}%`
                      )}
                    </div>
                    <div className="text-xs text-white/50">Current APY</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white" data-testid="text-total-staked">
                      {isLoadingStats ? (
                        <span className="inline-block w-14 h-5 bg-white/10 rounded animate-pulse" />
                      ) : (
                        formatTvl(vaultStats?.tvl || "0")
                      )}
                    </div>
                    <div className="text-xs text-white/50">Total Staked</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white" data-testid="text-staker-count">
                      {isLoadingStats ? (
                        <span className="inline-block w-10 h-5 bg-white/10 rounded animate-pulse" />
                      ) : (
                        "847"
                      )}
                    </div>
                    <div className="text-xs text-white/50">Stakers</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* CTA Banner */}
      <section className="relative z-10 py-16 bg-[#0000008f]" data-testid="section-cta-banner">
        <div className="max-w-4xl mx-auto px-6 lg:px-12">
          <div className="group glass-card rounded-2xl p-8 lg:p-12 text-center relative z-10 overflow-hidden">
            <h3 className="relative z-10 text-2xl lg:text-3xl font-serif italic text-white mb-4">
              Uncertain about your staking strategy?
            </h3>
            <p className="relative z-10 text-white/60 mb-8 max-w-xl mx-auto">
              Our multi-strategy vault automatically allocates your assets across optimized yield opportunities.
            </p>
            <Link href="/app" className="relative z-10">
              <button className="gradient-border-btn hover:bg-white/10 hover:text-white transition-all flex text-sm font-medium text-slate-300 py-3 px-6 gap-2 items-center mx-auto" data-testid="button-cta-banner">
                <span className="tracking-tight">Explore Vaults</span>
                <ArrowRight className="h-4 w-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>
            </Link>
          </div>
        </div>
      </section>
      {/* How It Works Section */}
      <section ref={howItWorksAnimation.ref} id="how-it-works" className="relative z-10 py-24 border-t border-white/5 bg-[#0000008f]" data-testid="section-how-it-works">
        <div className={`max-w-7xl mx-auto px-6 lg:px-12 ${howItWorksAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-serif italic text-primary text-glow mb-4" data-testid="heading-how-it-works">
              How It Works
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              Start earning rewards in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center" data-testid="step-1">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Connect Wallet</h3>
              <p className="text-white/60">
                Link your Xaman or EVM wallet to access the Shield Finance protocol.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center" data-testid="step-2">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Stake XRP</h3>
              <p className="text-white/60">
                Deposit your XRP with zero gas fees. Receive shXRP tokens instantly.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center" data-testid="step-3">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Earn Rewards</h3>
              <p className="text-white/60">
                Watch your rewards accumulate. Use shXRP across DeFi while staked.
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* Built for the Hybrid Economy Section - Aura Style */}
      <section className="overflow-hidden flex flex-col px-6 md:px-8 lg:px-12 z-10 bg-[#030303]/80 w-full border-white/5 border-t pt-32 pb-32 relative backdrop-blur-xl items-center" data-testid="section-hybrid-economy">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_200px] [mask-image:radial-gradient(ellipse_at_top,black_40%,transparent_100%)] pointer-events-none" />

        <div className="max-w-7xl w-full relative z-10">
          <div className="flex flex-col gap-8 mb-24 max-w-5xl">
            <span className="text-xs font-mono text-white/40 uppercase tracking-[0.2em] font-medium pl-1 flex items-center gap-3">
              <span className="w-1 h-1 bg-primary rounded-full shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
              Built for the Hybrid Economy
            </span>

            <h2 className="text-4xl md:text-5xl lg:text-7xl font-serif font-medium tracking-tight text-white leading-[1.1]">
              The modern investor doesn't fit in a single market —
              <span className="text-white/50"> they stake, they hedge, they compound smart.</span> This protocol was made for them.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-end">
            <div className="lg:col-span-4 relative group">
              <div className="relative w-full aspect-[3.5/4] rounded-[24px] overflow-hidden border border-white/10 bg-white/[0.02]">
                <img 
                  src={founderPhoto} 
                  alt="Shield Finance Founder" 
                  className="w-full h-full object-cover object-top"
                  data-testid="img-founder"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-transparent opacity-80" />
                <div className="absolute top-5 left-5 right-5 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="flex gap-1.5">
                    <div className="w-1 h-1 bg-white/40 rounded-full" />
                    <div className="w-1 h-1 bg-white/40 rounded-full" />
                  </div>
                  <div className="px-2 py-0.5 rounded border border-white/10 bg-black/20 backdrop-blur-md">
                    <span className="text-[9px] font-mono text-primary tracking-wider">FOUNDER</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 flex flex-col justify-end h-full relative">
              <blockquote className="mb-12 relative">
                <svg className="absolute -top-6 -left-8 w-6 h-6 text-white/10" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H15.017C14.4647 8 14.017 8.44772 14.017 9V11C14.017 11.5523 13.5693 12 13.017 12H12.017V5H22.017V15C22.017 18.3137 19.3307 21 16.017 21H14.017ZM5.0166 21L5.0166 18C5.0166 16.8954 5.91203 16 7.0166 16H10.0166C10.5689 16 11.0166 15.5523 11.0166 15V9C11.0166 8.44772 10.5689 8 10.0166 8H6.0166C5.46432 8 5.0166 8.44772 5.0166 9V11C5.0166 11.5523 4.56889 12 4.0166 12H3.0166V5H13.0166V15C13.0166 18.3137 10.3303 21 7.0166 21H5.0166Z" />
                </svg>
                <p className="text-xl md:text-2xl lg:text-3xl text-white/80 font-light leading-relaxed tracking-tight">
                  "My XRP used to just sit there. Now, through Flare, it's working across DeFi strategies I never had access to before — and Shield makes it effortless to earn yield without giving up liquidity."
                </p>
              </blockquote>

              <div className="mb-12 flex items-center gap-4">
                <div className="h-px w-8 bg-primary/30" />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-t border-white/5 pt-8">
                <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-full border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors group cursor-default">
                  <span className="text-[10px] md:text-xs text-white/50 font-mono uppercase tracking-wide group-hover:text-white/70 transition-colors">
                    Protocol TVL Growing <span className="text-primary">24/7</span>
                  </span>
                  <Zap className="h-3 w-3 text-primary" />
                </div>

                <Link href="/app">
                  <button className="shiny-cta group !px-7 !py-3" data-testid="button-hybrid-cta">
                    <span className="text-sm font-medium">Start Staking</span>
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Exchange Infrastructure Section - Aura Style */}
      <section className="lg:px-12 flex flex-col overflow-hidden z-10 bg-[#030303]/50 w-full border-white/5 border-t px-6 py-32 relative backdrop-blur-xl items-center" data-testid="section-exchange">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_200px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] opacity-70 pointer-events-none" />

        <div className="max-w-7xl w-full relative z-10">
          <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-12 mb-20">
            <div className="flex flex-col gap-6 max-w-3xl">
              <div className="flex items-center gap-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-full border border-white/10 bg-white/5 text-xs font-mono text-white/50">03</span>
                <span className="text-xs font-mono text-primary/90 uppercase tracking-[0.2em]">Yield Infrastructure</span>
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif font-medium tracking-tight text-white leading-[1.1]">
                Stake & Earn
                <span className="text-white/40 italic"> Multi-Strategy Yield.</span>
              </h2>
            </div>

            <div className="max-w-sm pb-2">
              <p className="text-white/50 text-sm leading-relaxed font-light">
                Direct access to optimized staking strategies. Convert XRP to shXRP with zero slippage and instant settlement.
              </p>
            </div>
          </div>

          <div className="w-full rounded-[24px] border border-white/10 bg-[#080808] overflow-hidden flex flex-col lg:flex-row relative group">
            <div className="lg:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-center items-start z-10 relative bg-[#080808]">
              <h3 className="text-3xl md:text-4xl font-serif font-medium text-white mb-6 tracking-tight">
                Stake, Earn & Compound Automatically.
              </h3>
              <p className="text-white/60 mb-10 leading-relaxed font-light max-w-md text-base">
                Initialize your staking position and earn rewards across multiple yield strategies. One interface for all your XRPFi needs.
              </p>

              <div className="flex flex-wrap gap-4 w-full sm:w-auto">
                <Link href="/app">
                  <button className="px-8 py-3.5 bg-primary text-[#030303] font-semibold text-sm rounded-full hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 min-w-[140px]" data-testid="button-exchange-start">
                    Get Started
                  </button>
                </Link>
                <a href="https://docs.shyield.finance" target="_blank" rel="noopener noreferrer">
                  <button className="px-8 py-3.5 border border-white/10 text-white font-medium text-sm rounded-full hover:bg-white/5 transition-colors flex items-center justify-center gap-2 min-w-[140px]" data-testid="button-exchange-docs">
                    View Docs
                  </button>
                </a>
              </div>
            </div>

            <div className="lg:w-1/2 bg-[#050505] relative min-h-[400px] border-t lg:border-t-0 lg:border-l border-white/5 overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '48px 96px'}} />
              
              <div className="relative flex flex-col items-center justify-center gap-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <Wallet className="w-10 h-10 text-primary" />
                  </div>
                  <div className="absolute -inset-4 rounded-3xl border border-primary/10 animate-pulse" />
                </div>
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-primary/60 animate-spin" style={{animationDuration: '4s'}} />
                  <span className="text-sm text-white/50 font-mono">Auto-compounding</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Security Section */}
      <section ref={securityAnimation.ref} id="security" className="group relative z-10 py-24 border-t border-white/5 overflow-hidden bg-[#0000008f]" data-testid="section-security">
        <div className={`max-w-7xl mx-auto px-6 lg:px-12 relative z-10 ${securityAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl lg:text-5xl font-serif italic text-primary text-glow mb-6" data-testid="heading-security">
                Security First
              </h2>
              <p className="text-lg text-white/60 mb-8">
                Your assets are protected by multiple layers of security, including smart contract audits, automated recovery systems, and transparent operations.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-white">Audited Smart Contracts</h4>
                    <p className="text-white/60 text-sm">Reviewed by leading blockchain security firms</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-white">Automated Recovery</h4>
                    <p className="text-white/60 text-sm">Fail-safe mechanisms protect against edge cases</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-white">Transparent Operations</h4>
                    <p className="text-white/60 text-sm">All transactions verifiable on-chain</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-white">Non-Custodial</h4>
                    <p className="text-white/60 text-sm">You maintain control of your assets at all times</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-64 h-64 rounded-full bg-primary/5 border border-primary/20 flex items-center justify-center">
                  <div className="w-48 h-48 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <div className="w-32 h-32 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
                      <Lock className="h-12 w-12 text-primary" />
                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-primary" style={{animationDuration: '3s'}} />
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Final CTA Section */}
      <section ref={ctaAnimation.ref} className="relative z-10 py-24 border-t border-white/5 bg-[#0000008f]" data-testid="section-cta">
        <div className={`max-w-4xl mx-auto px-6 lg:px-12 text-center ${ctaAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <h2 className="text-4xl lg:text-6xl font-serif italic text-primary text-glow mb-6" data-testid="heading-cta">
            Ready to start staking?
          </h2>
          <p className="text-lg text-white/60 mb-12 max-w-2xl mx-auto">
            Join the growing community of XRP holders earning rewards while maintaining full liquidity.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link href="/app">
              <button className="shiny-cta" data-testid="button-cta-start">
                <span>Launch App</span>
              </button>
            </Link>
            <a href="https://docs.shyield.finance" target="_blank" rel="noopener noreferrer">
              <button className="gradient-border-btn hover:bg-white/10 hover:text-white transition-all flex text-sm font-medium text-slate-300 py-3 px-6 gap-2 items-center group" data-testid="button-cta-docs">
                <FileText className="h-4 w-4" />
                <span className="tracking-tight">Read Documentation</span>
                <ExternalLink className="h-4 w-4 opacity-70 group-hover:opacity-100 transition-all" />
              </button>
            </a>
          </div>
        </div>
      </section>
      {/* Footer - Aura Style */}
      <footer className="relative z-10 px-6 md:px-8 lg:px-12 py-20 border-t border-white/5 bg-[#030303]" data-testid="footer">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 relative z-10">
          <div className="lg:col-span-3 flex flex-col gap-8">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-10 h-10 bg-white/5 rounded-xl border border-white/10 shadow-[0_0_15px_rgba(56,189,248,0.15)]">
                <img src={shieldLogo} alt="Shield Finance" className="h-6 w-6" />
              </div>
              <span className="font-serif font-medium text-2xl tracking-tight text-white">Shield</span>
            </div>
            <p className="text-white/40 text-sm leading-relaxed max-w-[280px] font-light">
              Engineering the future of XRP liquid staking. Secure, scalable, and instant.
            </p>
            <div className="flex gap-5 mt-4">
              <a href="https://x.com/shieldfinance_" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white transition-colors" data-testid="link-footer-twitter">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="m17.687 3.063l-4.996 5.711l-4.32-5.711H2.112l7.477 9.776l-7.086 8.099h3.034l5.469-6.25l4.78 6.25h6.102l-7.794-10.304l6.625-7.571zm-1.064 16.06L5.654 4.782h1.803l10.846 14.34z" />
                </svg>
              </a>
              <a href="https://discord.gg/Vzs3KbzU" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white transition-colors" data-testid="link-footer-discord">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.303 5.337A17.3 17.3 0 0 0 14.963 4c-.191.329-.403.775-.552 1.125a16.6 16.6 0 0 0-4.808 0C9.454 4.775 9.23 4.329 9.05 4a17 17 0 0 0-4.342 1.337C1.961 9.391 1.218 13.35 1.59 17.255a17.7 17.7 0 0 0 5.318 2.664a13 13 0 0 0 1.136-1.836c-.627-.234-1.22-.52-1.794-.86c.149-.106.297-.223.435-.34c3.46 1.582 7.207 1.582 10.624 0c.149.117.287.234.435.34c-.573.34-1.167.626-1.793.86a13 13 0 0 0 1.135 1.836a17.6 17.6 0 0 0 5.318-2.664c.457-4.52-.722-8.448-3.1-11.918M8.52 14.846c-1.04 0-1.889-.945-1.889-2.101s.828-2.102 1.89-2.102c1.05 0 1.91.945 1.888 2.102c0 1.156-.838 2.1-1.889 2.1m6.974 0c-1.04 0-1.89-.945-1.89-2.101s.828-2.102 1.89-2.102c1.05 0 1.91.945 1.889 2.102c0 1.156-.828 2.1-1.89 2.1" />
                </svg>
              </a>
              <a href="https://github.com/shield-xrpfinance/shieldfinance" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white transition-colors" data-testid="link-footer-github">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.001 2c-5.525 0-10 4.475-10 10a9.99 9.99 0 0 0 6.837 9.488c.5.087.688-.213.688-.476c0-.237-.013-1.024-.013-1.862c-2.512.463-3.162-.612-3.362-1.175c-.113-.288-.6-1.175-1.025-1.413c-.35-.187-.85-.65-.013-.662c.788-.013 1.35.725 1.538 1.025c.9 1.512 2.337 1.087 2.912.825c.088-.65.35-1.087.638-1.337c-2.225-.25-4.55-1.113-4.55-4.938c0-1.088.387-1.987 1.025-2.687c-.1-.25-.45-1.275.1-2.65c0 0 .837-.263 2.75 1.024a9.3 9.3 0 0 1 2.5-.337c.85 0 1.7.112 2.5.337c1.913-1.3 2.75-1.024 2.75-1.024c.55 1.375.2 2.4.1 2.65c.637.7 1.025 1.587 1.025 2.687c0 3.838-2.337 4.688-4.562 4.938c.362.312.675.912.675 1.85c0 1.337-.013 2.412-.013 2.75c0 .262.188.574.688.474A10.02 10.02 0 0 0 22 12c0-5.525-4.475-10-10-10" />
                </svg>
              </a>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-6 pt-2">
            <h4 className="text-white font-medium text-sm tracking-wide">Protocol</h4>
            <ul className="flex flex-col gap-3.5">
              <li><a href="https://docs.shyield.finance" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-primary text-sm transition-colors font-light" data-testid="link-footer-docs">Documentation</a></li>
              <li><a href="https://blog.shyield.finance" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-primary text-sm transition-colors font-light" data-testid="link-footer-blog">Blog</a></li>
              <li><a href="https://vote.shyield.finance" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-primary text-sm transition-colors font-light" data-testid="link-footer-governance">Governance</a></li>
              <li>
                <a href="/status" className="flex items-center gap-2 text-white/40 hover:text-primary text-sm transition-colors font-light" data-testid="link-footer-status">
                  System Status
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                </a>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-6 pt-2">
            <h4 className="text-white font-medium text-sm tracking-wide">Resources</h4>
            <ul className="flex flex-col gap-3.5">
              <li><a href="https://faucet.shyield.finance" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-primary text-sm transition-colors font-light" data-testid="link-footer-faucet">Testnet Faucet</a></li>
              <li><a href="https://docs.shyield.finance/security" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-primary text-sm transition-colors font-light" data-testid="link-footer-security">Security</a></li>
              <li><a href="/brand" className="text-white/40 hover:text-primary text-sm transition-colors font-light" data-testid="link-footer-brand">Brand Assets</a></li>
              <li><a href="https://docs.shyield.finance/protocol/shield_tokenomics" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-primary text-sm transition-colors font-light" data-testid="link-footer-tokenomics">Tokenomics</a></li>
            </ul>
          </div>

          <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-row gap-4 lg:gap-4 mt-8 lg:mt-0">
            <a href="https://docs.shyield.finance" target="_blank" rel="noopener noreferrer" className="flex-1 group relative p-7 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all duration-300 flex flex-col justify-between h-36 lg:h-40 overflow-hidden" data-testid="card-footer-docs">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex justify-between items-start relative z-10">
                <span className="text-white font-medium text-sm tracking-wide">Read Docs</span>
                <ExternalLink className="h-4 w-4 text-white/20 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
              </div>
              <div className="relative z-10 flex items-end justify-between">
                <FileText className="text-primary/60 w-8 h-8 group-hover:scale-110 transition-transform duration-300" />
              </div>
            </a>

            <a href="https://discord.gg/Vzs3KbzU" target="_blank" rel="noopener noreferrer" className="flex-1 group relative p-7 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all duration-300 flex flex-col justify-between h-36 lg:h-40 overflow-hidden" data-testid="card-footer-community">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex justify-between items-start relative z-10">
                <span className="text-white font-medium text-sm tracking-wide">Join Community</span>
                <ExternalLink className="h-4 w-4 text-white/20 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
              </div>
              <div className="relative z-10 flex items-end justify-between">
                <Users className="text-primary/60 w-8 h-8 group-hover:scale-110 transition-transform duration-300" />
              </div>
            </a>
          </div>
        </div>

        <div className="w-full max-w-7xl mx-auto mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
          <span className="text-white/20 text-xs font-mono tracking-wide">© 2025 Shield Finance. All rights reserved.</span>
          <div className="flex items-center gap-8">
            <a href="https://flare.network/" target="_blank" rel="noopener noreferrer" className="text-white/20 text-xs font-mono border-l border-white/10 pl-8 flex items-center gap-2 hover:text-white/40 transition-colors" data-testid="link-flare-network">
              Built on
              <svg width="30" height="30" viewBox="0 0 170 169" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M127.015 64.6782C127.047 64.0188 126.521 63.4668 125.86 63.4668H42.3565C3.34594 63.4668 0.244787 97.7478 0.01556 104.629C-0.00642065 105.282 0.517347 105.823 1.17111 105.823H84.7126C123.071 105.823 126.678 71.5996 127.015 64.6789V64.6782Z" fill="currentColor"/>
                <path d="M42.3567 0C5.7828 0 0.742956 34.0712 0.0917008 41.112C0.028899 41.7902 0.562087 42.3755 1.24286 42.3755H127.088C164.499 42.3755 168.86 8.26974 169.361 1.29435C169.409 0.625506 168.879 0.0571497 168.208 0.0565216L42.3567 0Z" fill="currentColor"/>
                <path d="M21.1975 169C32.9046 169 42.395 159.51 42.395 147.803C42.395 136.096 32.9046 126.605 21.1975 126.605C9.49044 126.605 0 136.096 0 147.803C0 159.51 9.49044 169 21.1975 169Z" fill="currentColor"/>
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
