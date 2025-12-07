import { useEffect, useState } from "react";
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
  Wallet,
  Globe
} from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { useShieldLogo } from "@/components/ShieldLogo";
import flareLogo from "@assets/flr.svg";
import xrpLogo from "@assets/xrp.148c3b50_1762588566535.png";
import xamanLogo from "@assets/xaman-wallet-icon.svg";
import shieldTokenLogo from "@assets/shield_logo_1763760253079.png";

export default function Landing() {
  const shieldLogo = useShieldLogo();
  const heroAnimation = useScrollAnimation();
  const partnersAnimation = useScrollAnimation();
  const featuresAnimation = useScrollAnimation();
  const howItWorksAnimation = useScrollAnimation();
  const securityAnimation = useScrollAnimation();
  const ctaAnimation = useScrollAnimation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  const handleSpotlightMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  };

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

    // Initialize UnicornStudio for animated background
    if (!(window as any).UnicornStudio) {
      (window as any).UnicornStudio = { isInitialized: false };
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js';
      script.onload = () => {
        if (!(window as any).UnicornStudio.isInitialized) {
          (window as any).UnicornStudio.init();
          (window as any).UnicornStudio.isInitialized = true;
        }
      };
      (document.head || document.body).appendChild(script);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] text-white overflow-x-hidden selection:bg-primary selection:text-black relative">
      {/* Background Grid Effect */}
      <div className="fixed inset-0 grid-bg pointer-events-none z-0" />
      
      {/* Radial Glow Background */}
      <div className="fixed inset-0 radial-glow pointer-events-none z-0" />

      {/* Floating Pill Navigation */}
      <nav className="fixed left-1/2 -translate-x-1/2 flex w-full lg:w-fit max-w-[90vw] z-50 rounded-full ring-white/10 ring-1 py-1.5 pr-1.5 pl-4 top-6 nav-pill backdrop-blur-xl items-center justify-between" data-testid="nav-header">
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

      {/* UnicornStudio Animated Background */}
      <div className="fixed top-0 w-full h-screen -z-10" style={{maskImage: 'linear-gradient(transparent, black 0%, black 80%, transparent)'}}>
        <div className="absolute top-0 w-full h-full -z-10">
          <div data-us-project="4ayjq1ymSRJ9Ah3nsX1c" className="absolute w-full h-full left-0 top-0 -z-10"></div>
        </div>
      </div>

      {/* Hero Section */}
      <main className="container lg:px-12 lg:pt-0 min-h-[1100px] flex flex-col lg:flex-row z-10 mx-auto pt-0 px-6 relative items-center">
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
              <button className="gradient-border-btn hover:bg-white/10 hover:text-white transition-all flex text-sm font-medium text-slate-300 py-3 px-6 gap-2 items-center group" data-testid="button-hero-faucet">
                <Droplets className="h-4 w-4" />
                <span className="tracking-tight">Get Test Tokens</span>
                <ArrowRight className="h-4 w-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>
            </a>
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

        {/* Infinite Marquee Section */}
        <section className="w-[95%] z-20 pb-8 absolute bottom-0" data-testid="section-marquee">
          <div className="flex flex-col lg:flex-row overflow-hidden opacity-50 w-full pt-6 gap-6 items-center justify-between">
            <div className="flex-1 overflow-hidden mask-gradient-fade w-full relative">
              <div className="flex animate-marquee hover:[animation-play-state:paused] w-max gap-32 items-center">
                {/* Original Set */}
                <img src={flareLogo} alt="Flare" className="h-7 w-auto monotone-logo" />
                <img src={xrpLogo} alt="XRP" className="h-7 w-auto monotone-logo" />
                <img src={xamanLogo} alt="Xaman" className="h-7 w-auto monotone-logo" />
                <img src={shieldTokenLogo} alt="Shield" className="h-7 w-auto monotone-logo" />
                {/* Duplicate Set for Seamless Loop */}
                <img src={flareLogo} alt="Flare" className="h-7 w-auto monotone-logo" />
                <img src={xrpLogo} alt="XRP" className="h-7 w-auto monotone-logo" />
                <img src={xamanLogo} alt="Xaman" className="h-7 w-auto monotone-logo" />
                <img src={shieldTokenLogo} alt="Shield" className="h-7 w-auto monotone-logo" />
                {/* Third Set for Full Coverage */}
                <img src={flareLogo} alt="Flare" className="h-7 w-auto monotone-logo" />
                <img src={xrpLogo} alt="XRP" className="h-7 w-auto monotone-logo" />
                <img src={xamanLogo} alt="Xaman" className="h-7 w-auto monotone-logo" />
                <img src={shieldTokenLogo} alt="Shield" className="h-7 w-auto monotone-logo" />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Partner Logos Section */}
      <section ref={partnersAnimation.ref} className="relative z-10 py-16 border-t border-white/5" data-testid="section-partners">
        <div className={`max-w-7xl mx-auto px-6 lg:px-12 ${partnersAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <p className="text-center text-xs font-mono tracking-[0.2em] text-white/40 uppercase mb-8" data-testid="text-partners-heading">
            Built on leading blockchain infrastructure
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            <div className="group" data-testid="partner-flare">
              <img src={flareLogo} alt="Flare Network" className="h-8 w-auto monotone-logo" data-testid="img-flare-logo" />
            </div>
            <div className="group" data-testid="partner-xrpl">
              <img src={xrpLogo} alt="XRP Ledger" className="h-8 w-auto monotone-logo" data-testid="img-xrpl-logo" />
            </div>
            <div className="group" data-testid="partner-xaman">
              <img src={xamanLogo} alt="Xaman" className="h-8 w-auto monotone-logo" data-testid="img-xaman-logo" />
            </div>
            <div className="group" data-testid="partner-shield">
              <img src={shieldTokenLogo} alt="Shield Token" className="h-8 w-auto monotone-logo" data-testid="img-shield-logo" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresAnimation.ref} id="features" className="relative z-10 py-24 border-t border-white/5" data-testid="section-features">
        <div className={`max-w-7xl mx-auto px-6 lg:px-12 ${featuresAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-serif italic text-primary text-glow mb-4" data-testid="heading-features">
              Why Shield Finance?
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              Advanced liquid staking infrastructure designed for the XRP ecosystem
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature Card 1 */}
            <div className="glass-card spotlight-card rounded-2xl p-8 hover:scale-[1.02] transition-all" onMouseMove={handleSpotlightMove} data-testid="card-feature-gasless">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 relative z-10">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3 relative z-10">100% Gasless Deposits</h3>
              <p className="text-white/60 leading-relaxed relative z-10">
                Deposit XRP without paying gas fees. Our smart contracts handle all transaction costs for seamless onboarding.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="glass-card spotlight-card rounded-2xl p-8 hover:scale-[1.02] transition-all" onMouseMove={handleSpotlightMove} data-testid="card-feature-liquidity">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 relative z-10">
                <RefreshCw className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3 relative z-10">Maintain Liquidity</h3>
              <p className="text-white/60 leading-relaxed relative z-10">
                Receive shXRP tokens representing your staked position. Trade, transfer, or use as collateral while earning rewards.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="glass-card spotlight-card rounded-2xl p-8 hover:scale-[1.02] transition-all" onMouseMove={handleSpotlightMove} data-testid="card-feature-security">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 relative z-10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3 relative z-10">Security Audited</h3>
              <p className="text-white/60 leading-relaxed relative z-10">
                Smart contracts audited by leading security firms. Automated recovery systems protect your assets.
              </p>
            </div>

            {/* Feature Card 4 */}
            <div className="glass-card spotlight-card rounded-2xl p-8 hover:scale-[1.02] transition-all" onMouseMove={handleSpotlightMove} data-testid="card-feature-xaman">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 relative z-10">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3 relative z-10">Xaman xApp Integration</h3>
              <p className="text-white/60 leading-relaxed relative z-10">
                Native integration with Xaman wallet. Stake directly from your mobile device with secure signing.
              </p>
            </div>

            {/* Feature Card 5 */}
            <div className="glass-card spotlight-card rounded-2xl p-8 hover:scale-[1.02] transition-all" onMouseMove={handleSpotlightMove} data-testid="card-feature-dual-wallet">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 relative z-10">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3 relative z-10">Dual Wallet Support</h3>
              <p className="text-white/60 leading-relaxed relative z-10">
                Connect with both XRPL and EVM wallets. Bridge seamlessly between ecosystems with FAssets technology.
              </p>
            </div>

            {/* Feature Card 6 */}
            <div className="glass-card spotlight-card rounded-2xl p-8 hover:scale-[1.02] transition-all" onMouseMove={handleSpotlightMove} data-testid="card-feature-governance">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 relative z-10">
                <Eye className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3 relative z-10">Transparent Governance</h3>
              <p className="text-white/60 leading-relaxed relative z-10">
                Community-driven protocol upgrades. SHIELD token holders vote on key protocol decisions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* System Capabilities Section */}
      <section className="relative z-10 py-24 border-t border-white/5" data-testid="section-capabilities">
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
      <section className="relative z-10 py-24 border-t border-white/5" data-testid="section-testimonial">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
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
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">XF</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">LIVE</span>
                    <span className="text-white font-semibold">XRPFi Enthusiast</span>
                  </div>
                  <p className="text-sm text-white/50">Early Adopter · Flare Network</p>
                </div>
              </div>
              <blockquote className="text-xl text-white/80 italic leading-relaxed mb-6">
                "Finally, a way to earn yield on my XRP without giving up liquidity. The gasless deposits and shXRP tokens make DeFi accessible."
              </blockquote>
              <div className="flex items-center gap-8 pt-4 border-t border-white/10">
                <div>
                  <div className="text-2xl font-bold text-primary">$124K</div>
                  <div className="text-xs text-white/50">Portfolio Value</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">+12.4%</div>
                  <div className="text-xs text-white/50">30d Returns</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Yield Infrastructure Section */}
      <section className="relative z-10 py-24 border-t border-white/5" data-testid="section-yield">
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
                  <div className="text-xl font-bold text-green-400">1.0234</div>
                  <div className="text-xs text-white/50">Exchange Rate</div>
                </div>
              </div>
              <div className="p-4 bg-black/40">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-white">8.2%</div>
                    <div className="text-xs text-white/50">Current APY</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">$1.2M</div>
                    <div className="text-xs text-white/50">Total Staked</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">847</div>
                    <div className="text-xs text-white/50">Stakers</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="relative z-10 py-16" data-testid="section-cta-banner">
        <div className="max-w-4xl mx-auto px-6 lg:px-12">
          <div className="glass-card rounded-2xl p-8 lg:p-12 text-center">
            <h3 className="text-2xl lg:text-3xl font-serif italic text-white mb-4">
              Uncertain about your staking strategy?
            </h3>
            <p className="text-white/60 mb-8 max-w-xl mx-auto">
              Our multi-strategy vault automatically allocates your assets across optimized yield opportunities.
            </p>
            <Link href="/app">
              <button className="gradient-border-btn hover:bg-white/10 hover:text-white transition-all flex text-sm font-medium text-slate-300 py-3 px-6 gap-2 items-center group mx-auto" data-testid="button-cta-banner">
                <span className="tracking-tight">Explore Vaults</span>
                <ArrowRight className="h-4 w-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section ref={howItWorksAnimation.ref} id="how-it-works" className="relative z-10 py-24 border-t border-white/5" data-testid="section-how-it-works">
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

      {/* Security Section */}
      <section ref={securityAnimation.ref} id="security" className="relative z-10 py-24 border-t border-white/5" data-testid="section-security">
        <div className={`max-w-7xl mx-auto px-6 lg:px-12 ${securityAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
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
      <section ref={ctaAnimation.ref} className="relative z-10 py-24 border-t border-white/5" data-testid="section-cta">
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

      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-white/5" data-testid="footer">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <img src={shieldLogo} alt="Shield Finance" className="h-8 w-8" />
              <span className="font-medium text-white">Shield Finance</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6">
              <a href="https://docs.shyield.finance" target="_blank" rel="noopener noreferrer" className="text-sm text-white/50 hover:text-white transition-colors" data-testid="link-footer-docs">
                Docs
              </a>
              <a href="https://blog.shyield.finance" target="_blank" rel="noopener noreferrer" className="text-sm text-white/50 hover:text-white transition-colors" data-testid="link-footer-blog">
                Blog
              </a>
              <a href="https://vote.shyield.finance" target="_blank" rel="noopener noreferrer" className="text-sm text-white/50 hover:text-white transition-colors" data-testid="link-footer-governance">
                Governance
              </a>
              <a href="https://discord.gg/Vzs3KbzU" target="_blank" rel="noopener noreferrer" className="text-sm text-white/50 hover:text-white transition-colors" data-testid="link-footer-discord">
                Discord
              </a>
            </div>
            <div className="text-sm text-white/30">
              © 2024 Shield Finance. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
