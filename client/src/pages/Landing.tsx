import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { 
  Shield, 
  TrendingUp, 
  Lock, 
  Zap, 
  ArrowRight, 
  CheckCircle2, 
  Users,
  Target,
  Award,
  Quote,
  Calendar,
  FileText,
  Minus,
  Coins,
  Flame,
  Gift,
  Sparkles,
  Network,
  Cpu,
  RefreshCw,
  Eye,
  BarChart3,
  Menu,
  X,
  ExternalLink,
  Smartphone,
  Wallet,
  Compass,
  PartyPopper,
  BadgeCheck,
  Activity,
  Droplets,
  Vote,
  Globe
} from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { useAnalyticsMetrics } from "@/hooks/useAnalyticsMetrics";
import { IPhoneMockup } from "@/components/IPhoneMockup";
import { useShieldLogo } from "@/components/ShieldLogo";
import flareLogo from "@assets/flr.svg";
import xrpLogo from "@assets/xrp.148c3b50_1762588566535.png";
import xamanLogo from "@assets/xaman-wallet-icon.svg";
import walletConnectLogo from "@assets/walletconnect-logo.svg";
import mobileScreenshot from "@assets/IMG_2860_1764436010804.jpg";

export default function Landing() {
  const shieldLogo = useShieldLogo();
  const heroAnimation = useScrollAnimation();
  const partnersAnimation = useScrollAnimation();
  const latestUpdatesAnimation = useScrollAnimation();
  const featuresAnimation = useScrollAnimation();
  const whyUsAnimation = useScrollAnimation();
  const technicalAnimation = useScrollAnimation();
  const howItWorksAnimation = useScrollAnimation();
  const mobileExperienceAnimation = useScrollAnimation();
  const platformIntelligenceAnimation = useScrollAnimation();
  const securityAnimation = useScrollAnimation();
  const airdropAnimation = useScrollAnimation();
  const valueAnimation = useScrollAnimation();
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
    <div className="min-h-screen bg-background">
      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(5deg); }
          }
          
          @keyframes float-delayed {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-30px) rotate(-5deg); }
          }
          
          @keyframes float-slow {
            0%, 100% { transform: translateY(0px) scale(1); }
            50% { transform: translateY(-15px) scale(1.05); }
          }
          
          @keyframes pulse-glow {
            0%, 100% { opacity: 0.5; box-shadow: 0 0 20px rgba(0, 102, 255, 0.3); }
            50% { opacity: 0.8; box-shadow: 0 0 40px rgba(0, 102, 255, 0.5); }
          }
          
          @keyframes fade-in-up {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes gradient-flow {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }
          
          @keyframes gradient-shift {
            0%, 100% {
              background-position: 0% 0%;
            }
            25% {
              background-position: 100% 0%;
            }
            50% {
              background-position: 100% 100%;
            }
            75% {
              background-position: 0% 100%;
            }
          }
          
          .animate-float {
            animation: float 6s ease-in-out infinite;
          }
          
          .animate-float-delayed {
            animation: float-delayed 8s ease-in-out infinite;
          }
          
          .animate-float-slow {
            animation: float-slow 10s ease-in-out infinite;
          }
          
          .animate-pulse-glow {
            animation: pulse-glow 3s ease-in-out infinite;
          }
          
          .animate-fade-in-up {
            animation: fade-in-up 0.6s ease-out forwards;
          }
          
          .glassmorphic {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
          
          .glassmorphic-light {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.3);
          }
          
          .dark .glassmorphic-light {
            background: rgba(19, 19, 22, 0.7);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
          
          .line-connector {
            position: relative;
          }
          
          .line-connector::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 100%;
            width: 100%;
            height: 2px;
            background: linear-gradient(to right, hsl(var(--primary)), transparent);
            transform: translateY(-50%);
          }
          
          @media (max-width: 768px) {
            .line-connector::after {
              display: none;
            }
          }
        `}
      </style>
      {/* Light Theme Header - To Highlight Logo */}
      <header className="sticky top-0 z-50 transition-all duration-300 bg-white border-b border-gray-200" data-testid="header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3" data-testid="logo-header">
              <img src={shieldLogo} alt="Shield Finance" className="h-10 w-10" data-testid="img-logo" />
              <span className="text-xl font-bold text-gray-900">Shield Finance</span>
            </div>
            <nav className="hidden md:flex items-center gap-8" data-testid="nav-header">
              <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 hover-elevate px-3 py-2 rounded-md transition-all" data-testid="link-nav-features">
                Features
              </a>
              <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900 hover-elevate px-3 py-2 rounded-md transition-all" data-testid="link-nav-how-it-works">
                How It Works
              </a>
              <a href="#security" className="text-sm text-gray-600 hover:text-gray-900 hover-elevate px-3 py-2 rounded-md transition-all" data-testid="link-nav-security">
                Security
              </a>
              <a href="https://docs.shyield.finance" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 hover:text-gray-900 hover-elevate px-3 py-2 rounded-md transition-all" data-testid="link-nav-docs">
                Docs
              </a>
              <a href="https://blog.shyield.finance" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 hover:text-gray-900 hover-elevate px-3 py-2 rounded-md transition-all" data-testid="link-nav-blog">
                Blog
              </a>
              <a href="https://vote.shyield.finance" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 hover:text-gray-900 hover-elevate px-3 py-2 rounded-md transition-all" data-testid="link-nav-governance">
                Governance
              </a>
            </nav>
            <div className="flex items-center gap-2">
              {/* Mobile hamburger menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-gray-700"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="button-mobile-menu"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
              <Link href="/app">
                <Button data-testid="button-launch-app" className="transition-all">
                  <span className="hidden sm:inline">Launch App</span>
                  <span className="sm:hidden">App</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 shadow-lg" data-testid="mobile-menu">
            <nav className="flex flex-col py-4 px-4 space-y-1">
              <a 
                href="#features" 
                onClick={() => handleMobileNavClick('#features')}
                className="flex items-center gap-3 text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-4 py-3 rounded-lg transition-all"
                data-testid="link-mobile-features"
              >
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-medium">Features</span>
              </a>
              <a 
                href="#how-it-works" 
                onClick={() => handleMobileNavClick('#how-it-works')}
                className="flex items-center gap-3 text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-4 py-3 rounded-lg transition-all"
                data-testid="link-mobile-how-it-works"
              >
                <Zap className="h-5 w-5 text-primary" />
                <span className="font-medium">How It Works</span>
              </a>
              <a 
                href="#security" 
                onClick={() => handleMobileNavClick('#security')}
                className="flex items-center gap-3 text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-4 py-3 rounded-lg transition-all"
                data-testid="link-mobile-security"
              >
                <Lock className="h-5 w-5 text-primary" />
                <span className="font-medium">Security</span>
              </a>
              
              <div className="border-t border-gray-100 my-2" />
              
              <a 
                href="https://docs.shyield.finance" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-4 py-3 rounded-lg transition-all"
                data-testid="link-mobile-docs"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="font-medium">Documentation</span>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400" />
              </a>
              <a 
                href="https://blog.shyield.finance" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-4 py-3 rounded-lg transition-all"
                data-testid="link-mobile-blog"
              >
                <div className="flex items-center gap-3">
                  <Quote className="h-5 w-5 text-primary" />
                  <span className="font-medium">Blog</span>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400" />
              </a>
              <a 
                href="https://discord.gg/Vzs3KbzU" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-4 py-3 rounded-lg transition-all"
                data-testid="link-mobile-discord"
              >
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="font-medium">Discord</span>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400" />
              </a>
              <a 
                href="https://vote.shyield.finance" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-4 py-3 rounded-lg transition-all"
                data-testid="link-mobile-governance"
              >
                <div className="flex items-center gap-3">
                  <Vote className="h-5 w-5 text-primary" />
                  <span className="font-medium">Governance</span>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400" />
              </a>
              
              <div className="border-t border-gray-100 my-2" />
              
              <a 
                href="https://faucet.shyield.finance/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between text-white bg-primary hover:bg-primary/90 px-4 py-3 rounded-lg transition-all"
                data-testid="link-mobile-faucet"
              >
                <div className="flex items-center gap-3">
                  <Droplets className="h-5 w-5" />
                  <span className="font-medium">Get Test Tokens</span>
                </div>
                <ExternalLink className="h-4 w-4 text-white/70" />
              </a>
            </nav>
          </div>
        )}
      </header>
      {/* Hero Section with Animated Gradient Background */}
      <section 
        className="relative overflow-hidden py-24 lg:py-32 min-h-screen flex items-center" 
        data-testid="section-hero"
      >
        {/* Animated Gradient Background */}
        <div 
          className="absolute inset-0 w-full h-full"
          style={{
            background: 'linear-gradient(-45deg, #0a0a0f, #0d1528, #0a1929, #050810, #0f1419)',
            backgroundSize: '400% 400%',
            animation: 'gradient-flow 20s ease infinite'
          }}
          data-testid="animated-hero-background"
        />
        
        {/* Secondary Animated Gradient Layer for Depth */}
        <div 
          className="absolute inset-0 w-full h-full opacity-60"
          style={{
            background: 'radial-gradient(circle at 20% 50%, rgba(0, 102, 255, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%), radial-gradient(circle at 40% 20%, rgba(147, 197, 253, 0.08) 0%, transparent 50%)',
            backgroundSize: '200% 200%',
            animation: 'gradient-shift 25s ease infinite'
          }}
        />

        {/* Dark Gradient Overlay for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/60" data-testid="hero-overlay" />

        {/* Animated Floating Coins */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div 
            className="absolute top-20 left-[10%] w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 animate-float"
            style={{ backdropFilter: 'blur(2px)' }}
          />
          <div 
            className="absolute top-40 right-[15%] w-32 h-32 rounded-full bg-gradient-to-br from-chart-2/30 to-chart-2/10 animate-float-delayed"
            style={{ backdropFilter: 'blur(2px)' }}
          />
          <div 
            className="absolute bottom-20 left-[20%] w-20 h-20 rounded-full bg-gradient-to-br from-chart-3/30 to-chart-3/10 animate-float-slow"
            style={{ backdropFilter: 'blur(2px)' }}
          />
        </div>

        {/* Content */}
        <div ref={heroAnimation.ref} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className={`max-w-3xl ${heroAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            {/* XRPFi Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 backdrop-blur-md" data-testid="badge-xrpfi">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary" data-testid="text-xrpfi-badge">Leading XRPFi Innovation</span>
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-white" data-testid="heading-hero">
              Liquid Staking for{" "}
              <span className="text-primary">XRP Ledger</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8" data-testid="text-hero-subtitle">
              Stake your XRP and earn rewards while maintaining liquidity. Access XRPFi opportunities without locking your assets.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/app">
                <Button size="lg" data-testid="button-hero-start" className="transition-all hover:scale-105">
                  Start Staking
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <a href="https://faucet.shyield.finance/" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" data-testid="button-hero-faucet" className="transition-all hover:scale-105 border-primary/50 text-white">
                  <Droplets className="mr-2 h-5 w-5" />
                  Get Test Tokens
                </Button>
              </a>
            </div>
            
            {/* Glassmorphic Stats */}
            <div className="mt-16" data-testid="stats-container">
              <p className="text-xs text-gray-400 mb-4" data-testid="text-testnet-disclaimer">
                {metrics.isLoading ? "Loading metrics..." : "* Testnet demo metrics - Mainnet launch coming soon"}
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className={`glassmorphic rounded-2xl p-4 transition-all hover:scale-105 ${metrics.isLoading ? 'opacity-60' : ''}`} data-testid="stat-tvl">
                  <div className="text-2xl lg:text-3xl font-bold text-primary mb-1" data-testid="value-tvl">{metrics.tvl}</div>
                  <div className="text-xs lg:text-sm text-gray-300" data-testid="label-tvl">TVL</div>
                </div>
                <div className={`glassmorphic rounded-2xl p-4 transition-all hover:scale-105 ${metrics.isLoading ? 'opacity-60' : ''}`} data-testid="stat-apy">
                  <div className="text-2xl lg:text-3xl font-bold text-primary mb-1" data-testid="value-apy">{metrics.apy}</div>
                  <div className="text-xs lg:text-sm text-gray-300" data-testid="label-apy">APY</div>
                </div>
                <div className={`glassmorphic rounded-2xl p-4 transition-all hover:scale-105 ${metrics.isLoading ? 'opacity-60' : ''}`} data-testid="stat-stakers">
                  <div className="text-2xl lg:text-3xl font-bold text-primary mb-1" data-testid="value-stakers">{metrics.stakers}</div>
                  <div className="text-xs lg:text-sm text-gray-300" data-testid="label-stakers">Stakers</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Partner Logos Section */}
      <section ref={partnersAnimation.ref} className="py-16 bg-muted/30" data-testid="section-partners">
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${partnersAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <p className="text-center text-sm text-muted-foreground mb-8" data-testid="text-partners-heading">
            Built on leading blockchain infrastructure
          </p>
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10">
            <div className="relative group" data-testid="partner-flare">
              <div className="glassmorphic-light rounded-xl px-8 py-4 transition-all hover:scale-110 flex items-center justify-center">
                <img src={flareLogo} alt="Flare Network" className="h-6 w-auto" data-testid="img-flare-logo" />
              </div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                FAssets & Smart Contracts
              </div>
            </div>
            <div className="relative group" data-testid="partner-xrpl">
              <div className="glassmorphic-light rounded-xl px-8 py-4 transition-all hover:scale-110 flex items-center justify-center">
                <img src={xrpLogo} alt="XRP Ledger" className="h-6 w-auto" data-testid="img-xrpl-logo" />
              </div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Native Integration
              </div>
            </div>
            <div className="relative group" data-testid="partner-xaman">
              <div className="glassmorphic-light rounded-xl px-8 py-4 transition-all hover:scale-110 flex items-center justify-center">
                <img src={xamanLogo} alt="Xaman" className="h-6 w-auto" data-testid="img-xaman-logo" />
              </div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Wallet SDK Integration
              </div>
            </div>
            <div className="relative group" data-testid="partner-walletconnect">
              <div className="glassmorphic-light rounded-xl px-8 py-4 transition-all hover:scale-110 flex items-center justify-center">
                <img src={walletConnectLogo} alt="WalletConnect" className="h-6 w-auto" data-testid="img-walletconnect-logo" />
              </div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Multi-Chain Connectivity
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Latest Updates Section - Post Security Audit Features */}
      <section ref={latestUpdatesAnimation.ref} className="py-24" data-testid="section-latest-updates">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 ${latestUpdatesAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-chart-2/10 border border-chart-2/20 mb-6" data-testid="badge-updates">
              <BadgeCheck className="h-4 w-4 text-chart-2" />
              <span className="text-sm font-semibold text-chart-2" data-testid="text-updates-badge">Security Audited</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4" data-testid="heading-updates">
              What's New
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-updates-subtitle">
              Latest features and improvements since completing our security audit
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className={`p-6 glassmorphic transition-all hover:scale-105 ${latestUpdatesAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.1s' }} data-testid="card-update-xapp">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-update-xapp">Xaman xApp Integration</h3>
              <p className="text-sm text-muted-foreground mb-3" data-testid="text-update-xapp">
                Seamless mobile experience with auto-connect and one-tap deposit signing directly within the Xaman wallet app
              </p>
              <div className="text-xs text-primary font-medium" data-testid="badge-update-xapp">Native SDK Integration</div>
            </Card>

            <Card className={`p-6 glassmorphic transition-all hover:scale-105 ${latestUpdatesAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.2s' }} data-testid="card-update-wallets">
              <div className="h-12 w-12 rounded-lg bg-chart-2/10 flex items-center justify-center mb-4">
                <Wallet className="h-6 w-6 text-chart-2" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-update-wallets">Dual Wallet Support</h3>
              <p className="text-sm text-muted-foreground mb-3" data-testid="text-update-wallets">
                Connect with XRPL wallets (Xaman, Bifrost) or EVM wallets (MetaMask, Trust Wallet) via Reown AppKit v2
              </p>
              <div className="text-xs text-chart-2 font-medium" data-testid="badge-update-wallets">XRPL + EVM Ecosystems</div>
            </Card>

            <Card className={`p-6 glassmorphic transition-all hover:scale-105 ${latestUpdatesAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.3s' }} data-testid="card-update-airdrop">
              <div className="h-12 w-12 rounded-lg bg-chart-3/10 flex items-center justify-center mb-4">
                <PartyPopper className="h-6 w-6 text-chart-3" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-update-airdrop">SHIELD Token Airdrop</h3>
              <p className="text-sm text-muted-foreground mb-3" data-testid="text-update-airdrop">
                Check eligibility and claim your SHIELD tokens. Fair Launch price set at $0.01 with on-chain Merkle verification
              </p>
              <Link href="/app/airdrop">
                <Button variant="outline" size="sm" className="mt-2" data-testid="button-check-airdrop">
                  Check Eligibility
                  <ArrowRight className="ml-2 h-3 w-3" />
                </Button>
              </Link>
            </Card>

            <Card className={`p-6 glassmorphic transition-all hover:scale-105 ${latestUpdatesAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.4s' }} data-testid="card-update-realtime">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-update-realtime">Real-Time On-Chain Data</h3>
              <p className="text-sm text-muted-foreground mb-3" data-testid="text-update-realtime">
                Live TVL, APY tracking, and position verification directly from smart contracts with on-chain balance checks
              </p>
              <div className="text-xs text-primary font-medium" data-testid="badge-update-realtime">Live Contract Data</div>
            </Card>

            <Card className={`p-6 glassmorphic transition-all hover:scale-105 ${latestUpdatesAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.5s' }} data-testid="card-update-swap">
              <div className="h-12 w-12 rounded-lg bg-chart-2/10 flex items-center justify-center mb-4">
                <RefreshCw className="h-6 w-6 text-chart-2" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-update-swap">Multi-Asset Swap</h3>
              <p className="text-sm text-muted-foreground mb-3" data-testid="text-update-swap">
                Swap between tokens with real-time quotes and approval flows powered by SparkDEX V3 router
              </p>
              <div className="text-xs text-chart-2 font-medium" data-testid="badge-update-swap">SparkDEX Integration</div>
            </Card>

            <Card className={`p-6 glassmorphic transition-all hover:scale-105 ${latestUpdatesAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.6s' }} data-testid="card-update-bridge">
              <div className="h-12 w-12 rounded-lg bg-chart-3/10 flex items-center justify-center mb-4">
                <Globe className="h-6 w-6 text-chart-3" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-update-bridge">Multi-Chain Bridge</h3>
              <p className="text-sm text-muted-foreground mb-3" data-testid="text-update-bridge">
                Bridge assets between XRPL, Flare, Ethereum, Base, Arbitrum, and more with real-time transaction tracking
              </p>
              <Link href="/app/bridge">
                <Button variant="outline" size="sm" className="mt-2" data-testid="button-bridge">
                  Bridge Assets
                  <ArrowRight className="ml-2 h-3 w-3" />
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>
      {/* Features Section with Glassmorphism */}
      <section id="features" ref={featuresAnimation.ref} className="py-24" data-testid="section-features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 ${featuresAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4" data-testid="heading-features">
              Why Choose Shield Finance
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-features-subtitle">
              The most secure and efficient way to stake XRP on the ledger
            </p>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${featuresAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.1s' }}>
            <Card className="p-6 glassmorphic transition-all hover:scale-105" data-testid="card-feature-liquidity">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-feature-liquidity">Maintain Liquidity</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-feature-liquidity">
                Receive liquid staking tokens that can be used across DeFi while earning rewards
              </p>
            </Card>

            <Card className="p-6 glassmorphic transition-all hover:scale-105" data-testid="card-feature-security">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-feature-security">Security Audited</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-feature-security">
                Completed comprehensive security audit with all critical fixes deployed. OpenZeppelin standards.
              </p>
            </Card>

            <Card className="p-6 glassmorphic transition-all hover:scale-105" data-testid="card-feature-rewards">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-feature-rewards">Competitive APY</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-feature-rewards">
                Earn competitive staking rewards with our optimized validator selection
              </p>
            </Card>

            <Card className="p-6 glassmorphic transition-all hover:scale-105" data-testid="card-feature-instant">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-feature-instant">Instant Unstaking</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-feature-instant">
                Access your funds when you need them without waiting for unbonding periods
              </p>
            </Card>
          </div>
        </div>
      </section>
      {/* Why Us Section */}
      <section ref={whyUsAnimation.ref} className="py-24 bg-muted/30" data-testid="section-why-us">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 ${whyUsAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4" data-testid="heading-why-us">
              What Makes Us Different
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-why-us-subtitle">
              Leading the future of XRP liquid staking with innovation and security
            </p>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${whyUsAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.1s' }}>
            <Card className="p-6 glassmorphic transition-all hover:scale-105" data-testid="card-why-us-community">
              <div className="h-12 w-12 rounded-lg bg-chart-2/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-chart-2" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-why-us-community">Community Driven</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-why-us-community">
                Governed by our token holders with transparent on-chain voting
              </p>
            </Card>

            <Card className="p-6 glassmorphic transition-all hover:scale-105" data-testid="card-why-us-optimized">
              <div className="h-12 w-12 rounded-lg bg-chart-3/10 flex items-center justify-center mb-4">
                <Target className="h-6 w-6 text-chart-3" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-why-us-optimized">Optimized Returns</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-why-us-optimized">
                AI-powered validator selection maximizes your staking rewards
              </p>
            </Card>

            <Card className="p-6 glassmorphic transition-all hover:scale-105" data-testid="card-why-us-proven">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-why-us-proven">Security Audited</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-why-us-proven">
                Comprehensive security audit completed with all critical findings resolved
              </p>
            </Card>

            <Card className="p-6 glassmorphic transition-all hover:scale-105" data-testid="card-why-us-transparent">
              <div className="h-12 w-12 rounded-lg bg-chart-2/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-6 w-6 text-chart-2" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-why-us-transparent">Full Transparency</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-why-us-transparent">
                Real-time metrics and open-source contracts for complete visibility
              </p>
            </Card>
          </div>
        </div>
      </section>
      {/* Technical Advantages Section */}
      <section ref={technicalAnimation.ref} className="py-24" data-testid="section-technical">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 ${technicalAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4" data-testid="heading-technical">
              Built Different: Technical Advantages
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-technical-subtitle">
              Advanced engineering powering a superior liquid staking experience
            </p>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 ${technicalAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.1s' }}>
            <Card className="p-8 glassmorphic transition-all hover:scale-105" data-testid="card-technical-smart-accounts">
              <div className="flex gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Cpu className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-3" data-testid="title-technical-smart-accounts">ERC-4337 Smart Accounts</h3>
                  <p className="text-muted-foreground text-sm mb-3" data-testid="text-technical-smart-accounts">
                    Dual-SDK architecture with separate instances for gasless and direct gas payment transactions. Paymaster sponsorship covers all transaction costs for XRP depositors.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">Account Abstraction</span>
                    <span className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">Gasless UX</span>
                    <span className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">Paymaster</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-8 glassmorphic transition-all hover:scale-105" data-testid="card-technical-fdc">
              <div className="flex gap-4">
                <div className="h-12 w-12 rounded-lg bg-chart-2/10 flex items-center justify-center shrink-0">
                  <Network className="h-6 w-6 text-chart-2" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-3" data-testid="title-technical-fdc">Flare Data Connector Integration</h3>
                  <p className="text-muted-foreground text-sm mb-3" data-testid="text-technical-fdc">
                    Cross-chain verification with FDC attestation submission and proof generation. Sentinel-based locking prevents concurrent conflicts during critical operations.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 rounded-md bg-chart-2/10 text-chart-2 font-medium">FDC Proofs</span>
                    <span className="text-xs px-2 py-1 rounded-md bg-chart-2/10 text-chart-2 font-medium">Cross-Chain</span>
                    <span className="text-xs px-2 py-1 rounded-md bg-chart-2/10 text-chart-2 font-medium">Attestation</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-8 glassmorphic transition-all hover:scale-105" data-testid="card-technical-multi-strategy">
              <div className="flex gap-4">
                <div className="h-12 w-12 rounded-lg bg-chart-3/10 flex items-center justify-center shrink-0">
                  <BarChart3 className="h-6 w-6 text-chart-3" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-3" data-testid="title-technical-multi-strategy">Multi-Strategy Vault Architecture</h3>
                  <p className="text-muted-foreground text-sm mb-3" data-testid="text-technical-multi-strategy">
                    Intelligent yield optimization across Kinetic and Firelight strategies with automated compounding service for maximized returns.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 rounded-md bg-chart-3/10 text-chart-3 font-medium">ERC-4626</span>
                    <span className="text-xs px-2 py-1 rounded-md bg-chart-3/10 text-chart-3 font-medium">Auto-Compound</span>
                    <span className="text-xs px-2 py-1 rounded-md bg-chart-3/10 text-chart-3 font-medium">Optimized</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-8 glassmorphic transition-all hover:scale-105" data-testid="card-technical-transparency">
              <div className="flex gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Eye className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-3" data-testid="title-technical-transparency">Revenue Transparency Analytics</h3>
                  <p className="text-muted-foreground text-sm mb-3" data-testid="text-technical-transparency">
                    Real-time tracking of platform fees, buyback-burn events, protocol reserves, and staking boost distribution.
                  </p>
                  <Link href="/app/analytics">
                    <Button variant="outline" size="sm" className="mt-2" data-testid="button-view-analytics">
                      View Analytics Dashboard
                      <ArrowRight className="ml-2 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>
      {/* How It Works Section with Connecting Lines */}
      <section id="how-it-works" ref={howItWorksAnimation.ref} className="py-24 bg-muted/30" data-testid="section-how-it-works">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-8 ${howItWorksAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4" data-testid="heading-how-it-works">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6" data-testid="text-how-it-works-subtitle">
              Start earning rewards in four simple steps — completely gasless for XRP users
            </p>
            
            {/* Gasless Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20" data-testid="badge-gasless">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary" data-testid="text-gasless-badge">100% Gasless with Flare Smart Accounts</span>
            </div>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 ${howItWorksAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.1s' }}>
            <div className="text-center relative line-connector" data-testid="step-1">
              <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-6 relative z-10 transition-all hover:scale-110" data-testid="badge-step-1">
                1
              </div>
              <h3 className="text-xl font-semibold mb-3" data-testid="title-step-1">Deposit XRP</h3>
              <p className="text-muted-foreground text-sm mb-2" data-testid="text-step-1">
                Connect your Xaman or XRPL wallet and deposit XRP directly from the ledger
              </p>
              <p className="text-xs text-primary font-semibold" data-testid="text-step-1-highlight">
                No FLR tokens needed!
              </p>
            </div>

            <div className="text-center relative line-connector" data-testid="step-2">
              <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-6 relative z-10 transition-all hover:scale-110" data-testid="badge-step-2">
                2
              </div>
              <h3 className="text-xl font-semibold mb-3" data-testid="title-step-2">Auto-Bridge to Flare</h3>
              <p className="text-muted-foreground text-sm mb-2" data-testid="text-step-2">
                XRP automatically bridges to FXRP on Flare Network via FAssets protocol
              </p>
              <p className="text-xs text-primary font-semibold" data-testid="text-step-2-highlight">
                All gas fees covered
              </p>
            </div>

            <div className="text-center relative line-connector" data-testid="step-3">
              <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-6 relative z-10 transition-all hover:scale-110" data-testid="badge-step-3">
                3
              </div>
              <h3 className="text-xl font-semibold mb-3" data-testid="title-step-3">Receive shXRP</h3>
              <p className="text-muted-foreground text-sm mb-2" data-testid="text-step-3">
                Get liquid staking tokens instantly via ERC-4337 Smart Account
              </p>
              <p className="text-xs text-primary font-semibold" data-testid="text-step-3-highlight">
                Paymaster sponsored
              </p>
            </div>

            <div className="text-center" data-testid="step-4">
              <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-6 transition-all hover:scale-110" data-testid="badge-step-4">
                4
              </div>
              <h3 className="text-xl font-semibold mb-3" data-testid="title-step-4">Earn & Use</h3>
              <p className="text-muted-foreground text-sm mb-2" data-testid="text-step-4">
                Earn staking rewards while using your shXRP across DeFi protocols
              </p>
              <p className="text-xs text-primary font-semibold" data-testid="text-step-4-highlight">
                Maximize your yield
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* Mobile Experience Section */}
      <section ref={mobileExperienceAnimation.ref} className="py-24" data-testid="section-mobile-experience">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center transition-opacity duration-500 ${mobileExperienceAnimation.isVisible ? 'animate-fade-in-up opacity-100' : 'opacity-100'}`}>
            <div className="order-2 lg:order-1 flex flex-col gap-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 w-fit" data-testid="badge-mobile">
                <Smartphone className="h-3 w-3 text-primary" />
                <span className="text-xs font-semibold text-primary" data-testid="text-mobile-badge">Xaman xApp Native</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold" data-testid="heading-mobile-experience">
                Seamless Mobile Staking
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground" data-testid="text-mobile-subtitle">
                Open Shield Finance directly in Xaman wallet for the smoothest XRP staking experience with auto-connect and one-tap signing.
              </p>
              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="flex items-start gap-3" data-testid="mobile-feature-realtime">
                  <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold mb-1 text-sm sm:text-base" data-testid="title-mobile-realtime">Auto-Connect in xApp</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground" data-testid="text-mobile-realtime">
                      When opened in Xaman, your wallet connects automatically — no QR codes or manual setup needed
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3" data-testid="mobile-feature-multiasset">
                  <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold mb-1 text-sm sm:text-base" data-testid="title-mobile-multiasset">One-Tap Deposit Signing</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground" data-testid="text-mobile-multiasset">
                      Deposit XRP with a single tap — transactions open directly in Xaman for instant approval
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3" data-testid="mobile-feature-performance">
                  <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold mb-1 text-sm sm:text-base" data-testid="title-mobile-performance">Real-Time Portfolio Tracking</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground" data-testid="text-mobile-performance">
                      Monitor your positions, pending deposits, and bridge activity with live on-chain data
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <Link href="/app/portfolio">
                  <Button size="lg" className="group w-full sm:w-auto" data-testid="button-mobile-cta">
                    View Your Portfolio
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className={`order-1 lg:order-2 flex justify-center px-4 sm:px-0 transition-opacity duration-500 ${mobileExperienceAnimation.isVisible ? 'animate-fade-in-up opacity-100' : 'opacity-100'}`} style={{ animationDelay: '0.1s' }} data-testid="container-mobile-mockup">
              <IPhoneMockup 
                screenshot={mobileScreenshot} 
                alt="Shield Finance mobile portfolio interface"
                className="transition-transform hover:scale-105"
              />
            </div>
          </div>
        </div>
      </section>
      {/* Platform Intelligence Section */}
      <section ref={platformIntelligenceAnimation.ref} className="py-24 bg-muted/30" data-testid="section-platform-intelligence">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 ${platformIntelligenceAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4" data-testid="heading-platform-intelligence">
              Platform Intelligence: Always-On Protection
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-platform-intelligence-subtitle">
              Automated monitoring and recovery systems ensuring your transactions never get stuck
            </p>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 ${platformIntelligenceAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.1s' }}>
            <Card className="p-6 glassmorphic transition-all hover:scale-105" data-testid="card-intelligence-watchdog">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <RefreshCw className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-intelligence-watchdog">Deposit Watchdog Service</h3>
              <p className="text-sm text-muted-foreground mb-3" data-testid="text-intelligence-watchdog">
                Automatically detects and recovers stuck deposits at the XRPL confirmation stage. Runs every 5 minutes to ensure no transaction is left behind.
              </p>
              <div className="text-xs text-primary font-medium" data-testid="badge-intelligence-watchdog">✓ Auto-Recovery Active</div>
            </Card>

            <Card className="p-6 glassmorphic transition-all hover:scale-105" data-testid="card-intelligence-retry">
              <div className="h-12 w-12 rounded-lg bg-chart-2/10 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-chart-2" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-intelligence-retry">Withdrawal Retry Service</h3>
              <p className="text-sm text-muted-foreground mb-3" data-testid="text-intelligence-retry">
                Exponential backoff retry system for failed withdrawal confirmations. Automatically retries with increasing delays until success.
              </p>
              <div className="text-xs text-chart-2 font-medium" data-testid="badge-intelligence-retry">✓ Smart Retry Logic</div>
            </Card>

            <Card className="p-6 glassmorphic transition-all hover:scale-105" data-testid="card-intelligence-bridge">
              <div className="h-12 w-12 rounded-lg bg-chart-3/10 flex items-center justify-center mb-4">
                <Network className="h-6 w-6 text-chart-3" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-intelligence-bridge">Bridge Reconciliation</h3>
              <p className="text-sm text-muted-foreground mb-3" data-testid="text-intelligence-bridge">
                Comprehensive recovery logic for stuck cross-chain bridges. Handles all bridge statuses with automated and manual recovery options.
              </p>
              <div className="text-xs text-chart-3 font-medium" data-testid="badge-intelligence-bridge">✓ Multi-State Recovery</div>
            </Card>
          </div>

          <div className={`mt-12 text-center ${platformIntelligenceAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.2s' }}>
            <Card className="inline-block p-6 glassmorphic" data-testid="card-intelligence-stats">
              <p className="text-sm text-muted-foreground mb-2" data-testid="text-intelligence-stats-label">
                Platform Reliability Targets
              </p>
              <div className="flex gap-8">
                <div data-testid="stat-intelligence-uptime">
                  <div className="text-2xl font-bold text-primary" data-testid="value-intelligence-uptime">99.9%</div>
                  <div className="text-xs text-muted-foreground" data-testid="label-intelligence-uptime">Target Uptime</div>
                </div>
                <div data-testid="stat-intelligence-recovery">
                  <div className="text-2xl font-bold text-chart-2" data-testid="value-intelligence-recovery">Auto</div>
                  <div className="text-xs text-muted-foreground" data-testid="label-intelligence-recovery">Recovery</div>
                </div>
                <div data-testid="stat-intelligence-monitoring">
                  <div className="text-2xl font-bold text-chart-3" data-testid="value-intelligence-monitoring">24/7</div>
                  <div className="text-xs text-muted-foreground" data-testid="label-intelligence-monitoring">Monitoring</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>
      {/* Security Section with Glassmorphism */}
      <section id="security" ref={securityAnimation.ref} className="py-24 bg-muted/30" data-testid="section-security">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${securityAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-chart-2/10 border border-chart-2/20 mb-6" data-testid="badge-security-audit">
                <BadgeCheck className="h-4 w-4 text-chart-2" />
                <span className="text-sm font-semibold text-chart-2" data-testid="text-audit-badge">Audit Complete</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold mb-6" data-testid="heading-security">
                Security First Approach
              </h2>
              <p className="text-lg text-muted-foreground mb-8" data-testid="text-security-subtitle">
                Comprehensive security audit completed with all critical findings resolved. Your assets are protected by industry-leading measures.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3" data-testid="security-item-opensource">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1" data-testid="title-security-opensource">Open Source Smart Contracts</h4>
                    <p className="text-sm text-muted-foreground" data-testid="text-security-opensource">
                      ERC-4626 compliant vaults built with OpenZeppelin standards and battle-tested patterns
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3" data-testid="security-item-noncustodial">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1" data-testid="title-security-noncustodial">Non-Custodial Architecture</h4>
                    <p className="text-sm text-muted-foreground" data-testid="text-security-noncustodial">
                      You maintain full control of your assets at all times through your ERC-4337 Smart Account
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3" data-testid="security-item-transparent">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1" data-testid="title-security-transparent">Transparent Operations</h4>
                    <p className="text-sm text-muted-foreground" data-testid="text-security-transparent">
                      All transactions and strategies are verifiable on-chain with real-time monitoring
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3" data-testid="security-item-recovery">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1" data-testid="title-security-recovery">Automated Recovery Systems</h4>
                    <p className="text-sm text-muted-foreground" data-testid="text-security-recovery">
                      Built-in watchdog services monitor and recover stuck transactions automatically
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <Card className="p-8 glassmorphic transition-all hover:scale-105" data-testid="card-security-status">
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-border/50" data-testid="status-audit">
                    <span className="text-sm text-muted-foreground" data-testid="label-audit-status">Security Audit</span>
                    <span className="text-sm font-semibold text-chart-2" data-testid="value-audit-status">✓ Completed</span>
                  </div>
                  <div className="flex items-center justify-between pb-4 border-b border-border/50" data-testid="status-contract">
                    <span className="text-sm text-muted-foreground" data-testid="label-contract-status">Contract Standard</span>
                    <span className="text-sm font-semibold text-chart-2" data-testid="value-contract-status">✓ ERC-4626</span>
                  </div>
                  <div className="flex items-center justify-between pb-4 border-b border-border/50" data-testid="status-opensource">
                    <span className="text-sm text-muted-foreground" data-testid="label-opensource-status">Source Code</span>
                    <span className="text-sm font-semibold text-chart-2" data-testid="value-opensource-status">✓ Open Source</span>
                  </div>
                  <div className="flex items-center justify-between pb-4 border-b border-border/50" data-testid="status-watchdog">
                    <span className="text-sm text-muted-foreground" data-testid="label-watchdog-status">Watchdog Services</span>
                    <span className="text-sm font-semibold text-chart-2" data-testid="value-watchdog-status">✓ Active</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid="status-monitoring">
                    <span className="text-sm text-muted-foreground" data-testid="label-monitoring-status">24/7 Monitoring</span>
                    <span className="text-sm font-semibold text-chart-2" data-testid="value-monitoring-status">✓ Enabled</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>
      {/* SHIELD Token & Airdrop Section */}
      <section ref={airdropAnimation.ref} className="py-24" data-testid="section-airdrop">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${airdropAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6" data-testid="badge-fair-launch">
                <PartyPopper className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-primary" data-testid="text-fair-launch-badge">Fair Launch</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold mb-6" data-testid="heading-airdrop">
                SHIELD Token Airdrop
              </h2>
              <p className="text-lg text-muted-foreground mb-8" data-testid="text-airdrop-subtitle">
                Claim your SHIELD tokens and participate in protocol governance. Fair Launch price set at $0.01 per token.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3" data-testid="airdrop-item-eligibility">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1" data-testid="title-airdrop-eligibility">Check Eligibility</h4>
                    <p className="text-sm text-muted-foreground" data-testid="text-airdrop-eligibility">
                      Connect your wallet to verify if you qualify for the SHIELD token airdrop
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3" data-testid="airdrop-item-merkle">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1" data-testid="title-airdrop-merkle">On-Chain Verification</h4>
                    <p className="text-sm text-muted-foreground" data-testid="text-airdrop-merkle">
                      Claims verified through MerkleDistributor smart contract for transparent distribution
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3" data-testid="airdrop-item-governance">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1" data-testid="title-airdrop-governance">Governance Rights</h4>
                    <p className="text-sm text-muted-foreground" data-testid="text-airdrop-governance">
                      SHIELD holders can participate in protocol decisions and earn staking boost rewards
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link href="/app/airdrop">
                  <Button size="lg" className="group w-full sm:w-auto" data-testid="button-claim-airdrop">
                    Check Your Allocation
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <a href="https://faucet.shyield.finance/" target="_blank" rel="noopener noreferrer">
                  <Button size="lg" variant="outline" className="group w-full sm:w-auto" data-testid="button-faucet">
                    <Droplets className="mr-2 h-5 w-5" />
                    Get Test Tokens
                  </Button>
                </a>
              </div>
            </div>
            <div className="relative">
              <Card className="p-8 glassmorphic" data-testid="card-token-details">
                <div className="text-center mb-8">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Shield className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2" data-testid="title-token-name">$SHIELD</h3>
                  <p className="text-muted-foreground text-sm" data-testid="text-token-subtitle">Governance Token</p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b border-border/50" data-testid="token-fair-launch">
                    <span className="text-sm text-muted-foreground" data-testid="label-fair-launch-price">Fair Launch Price</span>
                    <span className="text-sm font-semibold text-primary" data-testid="value-fair-launch-price">$0.01</span>
                  </div>
                  <div className="flex items-center justify-between pb-4 border-b border-border/50" data-testid="token-boost">
                    <span className="text-sm text-muted-foreground" data-testid="label-staking-boost">Staking Boost</span>
                    <span className="text-sm font-semibold text-chart-2" data-testid="value-staking-boost">Up to 25%</span>
                  </div>
                  <div className="flex items-center justify-between pb-4 border-b border-border/50" data-testid="token-lock">
                    <span className="text-sm text-muted-foreground" data-testid="label-lock-period">Lock Period</span>
                    <span className="text-sm font-semibold" data-testid="value-lock-period">30 Days</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid="token-network">
                    <span className="text-sm text-muted-foreground" data-testid="label-network">Network</span>
                    <span className="text-sm font-semibold" data-testid="value-network">Flare Network</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>
      {/* How SHIELD Creates Value Section */}
      <section ref={valueAnimation.ref} className="py-24 bg-muted/30" data-testid="section-value">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 ${valueAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4" data-testid="heading-value">
              How SHIELD Creates Value for Users
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-value-subtitle">
              A sustainable revenue model that directly benefits our staking community
            </p>
          </div>

          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${valueAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.1s' }}>
            <div className="space-y-8">
              <div className="flex gap-4" data-testid="value-step-1">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Coins className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2" data-testid="title-value-step-1">Platform Fees</h3>
                  <p className="text-muted-foreground text-sm" data-testid="text-value-step-1">
                    A modest 0.2% protocol fee is generated from all staking transactions
                  </p>
                </div>
              </div>

              <div className="flex gap-4" data-testid="value-step-2">
                <div className="h-12 w-12 rounded-lg bg-chart-2/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-6 w-6 text-chart-2" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2" data-testid="title-value-step-2">50/50 Split Strategy</h3>
                  <p className="text-muted-foreground text-sm" data-testid="text-value-step-2">
                    50% of fees fund token buybacks and burns, reducing supply and increasing token value
                  </p>
                </div>
              </div>

              <div className="flex gap-4" data-testid="value-step-3">
                <div className="h-12 w-12 rounded-lg bg-chart-3/10 flex items-center justify-center shrink-0">
                  <Shield className="h-6 w-6 text-chart-3" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2" data-testid="title-value-step-3">Protocol Reserves</h3>
                  <p className="text-muted-foreground text-sm" data-testid="text-value-step-3">
                    The other 50% builds a robust reserve fund for platform stability and emergency coverage
                  </p>
                </div>
              </div>

              <div className="flex gap-4" data-testid="value-step-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Gift className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2" data-testid="title-value-step-4">Staking Boost Rewards</h3>
                  <p className="text-muted-foreground text-sm" data-testid="text-value-step-4">
                    Users receive additional yield through our staking boost mechanism powered by this flywheel
                  </p>
                </div>
              </div>
            </div>

            <Card className="p-8 glassmorphic" data-testid="card-value-flow">
              <div className="space-y-6">
                <div className="text-center pb-6 border-b border-border/50">
                  <div className="text-4xl font-bold text-primary mb-2" data-testid="value-metric-1">0.2%</div>
                  <p className="text-sm text-muted-foreground" data-testid="label-value-metric-1">Platform Fee</p>
                </div>
                
                <div className="flex items-center justify-between pb-6 border-b border-border/50">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-chart-2 mb-1" data-testid="label-buyback">50% Buyback & Burn</p>
                    <p className="text-xs text-muted-foreground" data-testid="text-buyback">Reduces supply, increases value</p>
                  </div>
                  <Flame className="h-5 w-5 text-chart-2 shrink-0 ml-4" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-primary mb-1" data-testid="label-reserves">50% Protocol Reserves</p>
                    <p className="text-xs text-muted-foreground" data-testid="text-reserves">Ensures stability & security</p>
                  </div>
                  <Shield className="h-5 w-5 text-primary shrink-0 ml-4" />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>
      {/* CTA Section with Glassmorphism */}
      <section 
        ref={ctaAnimation.ref} 
        className="py-24" 
        data-testid="section-cta"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 25, 51, 0.95) 0%, rgba(0, 51, 153, 0.8) 100%)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className={`bg-primary text-primary-foreground p-12 text-center glassmorphic transition-all ${ctaAnimation.isVisible ? 'animate-fade-in-up scale-100' : 'opacity-0 scale-95'}`}>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4" data-testid="heading-cta">
              Ready to Start Earning?
            </h2>
            <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto" data-testid="text-cta-subtitle">
              Start earning rewards while maintaining liquidity with our security-audited protocol
            </p>
            <Link href="/app">
              <Button size="lg" variant="secondary" data-testid="button-cta-launch" className="transition-all hover:scale-110">
                Launch App
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </Card>
        </div>
      </section>
      {/* Footer with Glassmorphism */}
      <footer className="glassmorphic-light py-12" data-testid="footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div data-testid="footer-brand">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-6 w-6 text-primary" />
                <span className="font-bold">Shield Finance</span>
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-footer-tagline">
                Liquid staking protocol for XRP Ledger
              </p>
            </div>
            <div data-testid="footer-product">
              <h4 className="font-semibold mb-4" data-testid="heading-footer-product">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-features">Features</a></li>
                <li><a href="#how-it-works" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-how-it-works">How It Works</a></li>
                <li><a href="#security" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-security">Security</a></li>
                <li><Link href="/app/airdrop" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-airdrop">Airdrop</Link></li>
              </ul>
            </div>
            <div data-testid="footer-resources">
              <h4 className="font-semibold mb-4" data-testid="heading-footer-resources">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="https://faucet.shyield.finance/" target="_blank" rel="noopener noreferrer" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-faucet">Testnet Faucet</a></li>
                <li><a href="https://docs.shyield.finance" target="_blank" rel="noopener noreferrer" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-documentation">Documentation</a></li>
                <li><a href="https://blog.shyield.finance" target="_blank" rel="noopener noreferrer" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-blog">Blog</a></li>
                <li><a href="https://shyield.finance/whitepaper.pdf" target="_blank" rel="noopener noreferrer" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-whitepaper">Whitepaper</a></li>
                <li><a href="https://vote.shyield.finance" target="_blank" rel="noopener noreferrer" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-governance">Governance</a></li>
                <li><a href="https://discord.gg/Vzs3KbzU" target="_blank" rel="noopener noreferrer" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-support">Support</a></li>
              </ul>
            </div>
            <div data-testid="footer-community">
              <h4 className="font-semibold mb-4" data-testid="heading-footer-community">Community</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="https://x.com/ShieldFinanceX" target="_blank" rel="noopener noreferrer" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-twitter">X (Twitter)</a></li>
                <li><a href="https://discord.gg/Vzs3KbzU" target="_blank" rel="noopener noreferrer" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-discord">Discord</a></li>
                <li><a href="https://t.me/ShieldFinanceOfficial" target="_blank" rel="noopener noreferrer" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-telegram">Telegram</a></li>
                <li><a href="https://t.me/ShieldFinanceCommunity" target="_blank" rel="noopener noreferrer" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-telegram-community">Telegram Community</a></li>
              </ul>
            </div>
          </div>
          {/* Regulatory Disclaimer */}
          <div className="border-t border-border/50 pt-6 mb-6">
            <div className="max-w-4xl mx-auto text-center">
              <p className="text-xs text-muted-foreground leading-relaxed mb-3" data-testid="text-regulatory-disclaimer">
                <strong>Risk Disclosure:</strong> Cryptocurrency investments involve significant risk, including potential loss of principal. 
                Smart contracts may contain vulnerabilities. Past performance is not indicative of future results. 
                Yield projections are estimates based on current network conditions and are not guaranteed.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-vara-disclaimer">
                <strong>Regulatory Notice:</strong> Shield Finance is not licensed as a VASP under VARA (Dubai). 
                Front-end access is restricted for UAE IP addresses. Users bear sole responsibility for compliance with local regulations.
                This service is not directed at UAE residents. Smart contract interactions remain permissionless per blockchain design.
              </p>
            </div>
          </div>
          
          <div className="border-t border-border/50 pt-8 text-center text-sm text-muted-foreground">
            <p data-testid="text-footer-copyright">&copy; 2025 Shield Finance. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
