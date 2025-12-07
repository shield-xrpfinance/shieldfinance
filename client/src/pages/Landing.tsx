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
import { useAnalyticsMetrics } from "@/hooks/useAnalyticsMetrics";
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
  const metrics = useAnalyticsMetrics();
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

      {/* Hero Section */}
      <main className="container lg:px-12 min-h-screen flex flex-col lg:flex-row z-10 mx-auto px-6 relative items-center">
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

          {/* Stats */}
          <div className="mt-16" data-testid="stats-container">
            <p className="text-xs text-white/40 mb-4" data-testid="text-testnet-disclaimer">
              {metrics.isLoading ? "Loading metrics..." : "* Testnet demo metrics - Mainnet launch coming soon"}
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className={`glass-card rounded-xl p-4 transition-all hover:scale-105 ${metrics.isLoading ? 'opacity-60' : ''}`} data-testid="stat-tvl">
                <div className="text-2xl lg:text-3xl font-bold text-primary mb-1" data-testid="value-tvl">{metrics.tvl}</div>
                <div className="text-xs lg:text-sm text-white/50" data-testid="label-tvl">TVL</div>
              </div>
              <div className={`glass-card rounded-xl p-4 transition-all hover:scale-105 ${metrics.isLoading ? 'opacity-60' : ''}`} data-testid="stat-apy">
                <div className="text-2xl lg:text-3xl font-bold text-primary mb-1" data-testid="value-apy">{metrics.apy}</div>
                <div className="text-xs lg:text-sm text-white/50" data-testid="label-apy">APY</div>
              </div>
              <div className={`glass-card rounded-xl p-4 transition-all hover:scale-105 ${metrics.isLoading ? 'opacity-60' : ''}`} data-testid="stat-stakers">
                <div className="text-2xl lg:text-3xl font-bold text-primary mb-1" data-testid="value-stakers">{metrics.stakers}</div>
                <div className="text-xs lg:text-sm text-white/50" data-testid="label-stakers">Stakers</div>
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
              <circle r="65" fill="none" stroke="white" strokeOpacity="0.1" strokeWidth="1" strokeDasharray="10 20" className="animate-spin" style={{animationDuration: '12s'}} />
              <circle r="45" fill="none" stroke="#38BDF8" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="4 6" className="animate-spin" style={{animationDuration: '15s', animationDirection: 'reverse'}} />

              {/* Core */}
              <circle r="8" fill="#0A0A0A" stroke="#38BDF8" strokeWidth="2" />
              <circle r="4" fill="#38BDF8" className="animate-pulse" />
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
        </div>
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
            <div className="glass-card rounded-2xl p-8 hover:scale-[1.02] transition-all" data-testid="card-feature-gasless">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">100% Gasless Deposits</h3>
              <p className="text-white/60 leading-relaxed">
                Deposit XRP without paying gas fees. Our smart contracts handle all transaction costs for seamless onboarding.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="glass-card rounded-2xl p-8 hover:scale-[1.02] transition-all" data-testid="card-feature-liquidity">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <RefreshCw className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Maintain Liquidity</h3>
              <p className="text-white/60 leading-relaxed">
                Receive shXRP tokens representing your staked position. Trade, transfer, or use as collateral while earning rewards.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="glass-card rounded-2xl p-8 hover:scale-[1.02] transition-all" data-testid="card-feature-security">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Security Audited</h3>
              <p className="text-white/60 leading-relaxed">
                Smart contracts audited by leading security firms. Automated recovery systems protect your assets.
              </p>
            </div>

            {/* Feature Card 4 */}
            <div className="glass-card rounded-2xl p-8 hover:scale-[1.02] transition-all" data-testid="card-feature-xaman">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Xaman xApp Integration</h3>
              <p className="text-white/60 leading-relaxed">
                Native integration with Xaman wallet. Stake directly from your mobile device with secure signing.
              </p>
            </div>

            {/* Feature Card 5 */}
            <div className="glass-card rounded-2xl p-8 hover:scale-[1.02] transition-all" data-testid="card-feature-dual-wallet">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Dual Wallet Support</h3>
              <p className="text-white/60 leading-relaxed">
                Connect with both XRPL and EVM wallets. Bridge seamlessly between ecosystems with FAssets technology.
              </p>
            </div>

            {/* Feature Card 6 */}
            <div className="glass-card rounded-2xl p-8 hover:scale-[1.02] transition-all" data-testid="card-feature-governance">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <Eye className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Transparent Governance</h3>
              <p className="text-white/60 leading-relaxed">
                Community-driven protocol upgrades. SHIELD token holders vote on key protocol decisions.
              </p>
            </div>
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
