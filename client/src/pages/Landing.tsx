import { useEffect } from "react";
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
  Network
} from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

export default function Landing() {
  const heroAnimation = useScrollAnimation();
  const partnersAnimation = useScrollAnimation();
  const featuresAnimation = useScrollAnimation();
  const whyUsAnimation = useScrollAnimation();
  const howItWorksAnimation = useScrollAnimation();
  const securityAnimation = useScrollAnimation();
  const valueAnimation = useScrollAnimation();
  const testimonialsAnimation = useScrollAnimation();
  const blogAnimation = useScrollAnimation();
  const ctaAnimation = useScrollAnimation();

  useEffect(() => {
    document.title = "Shield Finance - XRP Liquid Staking Protocol | Earn Rewards While Maintaining Liquidity";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "Stake your XRP and earn rewards while maintaining liquidity with Shield Finance. Access DeFi opportunities without locking your assets. Secure, audited, and trusted by 12,400+ stakers."
      );
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'Stake your XRP and earn rewards while maintaining liquidity with Shield Finance. Access DeFi opportunities without locking your assets. Secure, audited, and trusted by 12,400+ stakers.';
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
        "Stake your XRP and earn rewards while maintaining liquidity. Join 12,400+ users earning competitive APY on $24.5M TVL."
      );
    } else {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:description');
      meta.content = 'Stake your XRP and earn rewards while maintaining liquidity. Join 12,400+ users earning competitive APY on $24.5M TVL.';
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

      {/* Glassmorphic Header */}
      <header className="glassmorphic-light sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2" data-testid="logo-header">
              <Shield className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">Shield Finance</span>
            </div>
            <nav className="hidden md:flex items-center gap-8" data-testid="nav-header">
              <a href="#features" className="text-sm text-muted-foreground hover-elevate px-3 py-2 rounded-md transition-all" data-testid="link-nav-features">
                Features
              </a>
              <a href="#how-it-works" className="text-sm text-muted-foreground hover-elevate px-3 py-2 rounded-md transition-all" data-testid="link-nav-how-it-works">
                How It Works
              </a>
              <a href="#security" className="text-sm text-muted-foreground hover-elevate px-3 py-2 rounded-md transition-all" data-testid="link-nav-security">
                Security
              </a>
            </nav>
            <Link href="/app">
              <Button data-testid="button-launch-app" className="transition-all">
                Launch App
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section with Animated Coins */}
      <section 
        className="relative overflow-hidden" 
        data-testid="section-hero"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--primary) / 0.12) 0%, hsl(var(--primary) / 0.04) 50%, transparent 100%)'
        }}
      >
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
          <div 
            className="absolute top-60 left-[50%] w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 animate-pulse-glow"
            style={{ backdropFilter: 'blur(2px)' }}
          />
        </div>

        <div ref={heroAnimation.ref} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 relative z-10">
          <div className={`text-center max-w-4xl mx-auto ${heroAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight mb-6" data-testid="heading-hero">
              Liquid Staking for{" "}
              <span className="text-primary">XRP Ledger</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto" data-testid="text-hero-subtitle">
              Stake your XRP and earn rewards while maintaining liquidity. Access DeFi opportunities without locking your assets.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/app">
                <Button size="lg" data-testid="button-hero-start" className="transition-all hover:scale-105">
                  Start Staking
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" data-testid="button-hero-learn" className="glassmorphic-light transition-all hover:scale-105">
                Learn More
              </Button>
            </div>
            
            {/* Glassmorphic Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20" data-testid="stats-container">
              <div className="glassmorphic rounded-2xl p-6 transition-all hover:scale-105" data-testid="stat-tvl">
                <div className="text-4xl font-bold text-primary mb-2" data-testid="value-tvl">$24.5M</div>
                <div className="text-sm text-muted-foreground" data-testid="label-tvl">Total Value Locked</div>
              </div>
              <div className="glassmorphic rounded-2xl p-6 transition-all hover:scale-105" data-testid="stat-apy">
                <div className="text-4xl font-bold text-primary mb-2" data-testid="value-apy">5.2%</div>
                <div className="text-sm text-muted-foreground" data-testid="label-apy">Average APY</div>
              </div>
              <div className="glassmorphic rounded-2xl p-6 transition-all hover:scale-105" data-testid="stat-stakers">
                <div className="text-4xl font-bold text-primary mb-2" data-testid="value-stakers">12,400+</div>
                <div className="text-sm text-muted-foreground" data-testid="label-stakers">Active Stakers</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partner Logos Section */}
      <section ref={partnersAnimation.ref} className="py-16 bg-muted/30" data-testid="section-partners">
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${partnersAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <p className="text-center text-sm text-muted-foreground mb-8" data-testid="text-partners-heading">
            Powered by leading blockchain technologies
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
            <div className="glassmorphic-light rounded-xl px-8 py-4 text-lg font-semibold transition-all hover:scale-110" data-testid="partner-flare">
              Flare
            </div>
            <div className="glassmorphic-light rounded-xl px-8 py-4 text-lg font-semibold transition-all hover:scale-110" data-testid="partner-xrpl">
              XRPL
            </div>
            <div className="glassmorphic-light rounded-xl px-8 py-4 text-lg font-semibold transition-all hover:scale-110" data-testid="partner-sparkdex">
              SparkDEX
            </div>
            <div className="glassmorphic-light rounded-xl px-8 py-4 text-lg font-semibold transition-all hover:scale-110" data-testid="partner-firelight">
              Firelight
            </div>
            <div className="glassmorphic-light rounded-xl px-8 py-4 text-lg font-semibold transition-all hover:scale-110" data-testid="partner-wallet-connect">
              Wallet Connect
            </div>
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
              <h3 className="text-lg font-semibold mb-2" data-testid="title-feature-security">Secure & Audited</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-feature-security">
                Smart contracts audited by leading security firms, ensuring your assets are safe
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
              <h3 className="text-lg font-semibold mb-2" data-testid="title-why-us-proven">Proven Track Record</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-why-us-proven">
                Over 2 years of reliable operations with zero security incidents
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

      {/* How It Works Section with Connecting Lines */}
      <section id="how-it-works" ref={howItWorksAnimation.ref} className="py-24" data-testid="section-how-it-works">
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
              <h3 className="text-xl font-semibold mb-3" data-testid="title-step-3">Receive stXRP</h3>
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
                Earn staking rewards while using your stXRP across DeFi protocols
              </p>
              <p className="text-xs text-primary font-semibold" data-testid="text-step-4-highlight">
                Maximize your yield
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section with Glassmorphism */}
      <section id="security" ref={securityAnimation.ref} className="py-24 bg-muted/30" data-testid="section-security">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${securityAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold mb-6" data-testid="heading-security">
                Security First Approach
              </h2>
              <p className="text-lg text-muted-foreground mb-8" data-testid="text-security-subtitle">
                Your assets are protected by industry-leading security measures and best practices.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3" data-testid="security-item-audited">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1" data-testid="title-security-audited">Audited Smart Contracts</h4>
                    <p className="text-sm text-muted-foreground" data-testid="text-security-audited">
                      Contracts audited by leading blockchain security firms
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3" data-testid="security-item-noncustodial">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1" data-testid="title-security-noncustodial">Non-Custodial</h4>
                    <p className="text-sm text-muted-foreground" data-testid="text-security-noncustodial">
                      You maintain full control of your assets at all times
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3" data-testid="security-item-transparent">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1" data-testid="title-security-transparent">Transparent Operations</h4>
                    <p className="text-sm text-muted-foreground" data-testid="text-security-transparent">
                      All transactions and validator selections are verifiable on-chain
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <Card className="p-8 glassmorphic transition-all hover:scale-105" data-testid="card-security-status">
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-border/50" data-testid="status-contract">
                    <span className="text-sm text-muted-foreground" data-testid="label-contract-status">Contract Status</span>
                    <span className="text-sm font-semibold text-chart-2" data-testid="value-contract-status">✓ Verified</span>
                  </div>
                  <div className="flex items-center justify-between pb-4 border-b border-border/50" data-testid="status-audit">
                    <span className="text-sm text-muted-foreground" data-testid="label-audit-status">Security Audit</span>
                    <span className="text-sm font-semibold text-chart-2" data-testid="value-audit-status">✓ Passed</span>
                  </div>
                  <div className="flex items-center justify-between pb-4 border-b border-border/50" data-testid="status-bounty">
                    <span className="text-sm text-muted-foreground" data-testid="label-bounty-status">Bug Bounty</span>
                    <span className="text-sm font-semibold text-chart-2" data-testid="value-bounty-status">✓ Active</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid="status-insurance">
                    <span className="text-sm text-muted-foreground" data-testid="label-insurance-status">Insurance Coverage</span>
                    <span className="text-sm font-semibold text-chart-2" data-testid="value-insurance-status">✓ $10M</span>
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

      {/* Testimonials Section */}
      <section ref={testimonialsAnimation.ref} className="py-24" data-testid="section-testimonials">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 ${testimonialsAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4" data-testid="heading-testimonials">
              Trusted by the Community
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-testimonials-subtitle">
              See what our users have to say about Shield Finance
            </p>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${testimonialsAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.1s' }}>
            <Card className="p-6 glassmorphic transition-all hover:scale-105" data-testid="card-testimonial-1">
              <Quote className="h-8 w-8 text-primary mb-4" />
              <p className="text-sm mb-4" data-testid="text-testimonial-1-quote">
                "Shield Finance has revolutionized how I manage my XRP holdings. The ability to earn rewards while maintaining liquidity is a game-changer."
              </p>
              <div className="border-t border-border/50 pt-4">
                <p className="font-semibold" data-testid="text-testimonial-1-name">Sarah Chen</p>
                <p className="text-sm text-muted-foreground" data-testid="text-testimonial-1-role">DeFi Investor</p>
              </div>
            </Card>

            <Card className="p-6 glassmorphic transition-all hover:scale-105" data-testid="card-testimonial-2">
              <Quote className="h-8 w-8 text-primary mb-4" />
              <p className="text-sm mb-4" data-testid="text-testimonial-2-quote">
                "The security measures and transparency of Shield Finance give me complete confidence. Best liquid staking platform I've used."
              </p>
              <div className="border-t border-border/50 pt-4">
                <p className="font-semibold" data-testid="text-testimonial-2-name">Michael Rodriguez</p>
                <p className="text-sm text-muted-foreground" data-testid="text-testimonial-2-role">Crypto Analyst</p>
              </div>
            </Card>

            <Card className="p-6 glassmorphic transition-all hover:scale-105" data-testid="card-testimonial-3">
              <Quote className="h-8 w-8 text-primary mb-4" />
              <p className="text-sm mb-4" data-testid="text-testimonial-3-quote">
                "Amazing platform with consistent returns. The instant unstaking feature has saved me multiple times during market opportunities."
              </p>
              <div className="border-t border-border/50 pt-4">
                <p className="font-semibold" data-testid="text-testimonial-3-name">Alex Thompson</p>
                <p className="text-sm text-muted-foreground" data-testid="text-testimonial-3-role">Portfolio Manager</p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Blog/News Section */}
      <section ref={blogAnimation.ref} className="py-24 bg-muted/30" data-testid="section-blog">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 ${blogAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4" data-testid="heading-blog">
              Latest Updates
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-blog-subtitle">
              Stay informed about our latest developments and partnerships
            </p>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${blogAnimation.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.1s' }}>
            <Card className="overflow-hidden glassmorphic transition-all hover:scale-105" data-testid="card-blog-1">
              <div className="p-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Calendar className="h-4 w-4" />
                  <span data-testid="text-blog-1-date">March 15, 2024</span>
                </div>
                <h3 className="text-lg font-semibold mb-2" data-testid="title-blog-1">
                  Q1 2024 Roadmap Update
                </h3>
                <p className="text-sm text-muted-foreground mb-4" data-testid="text-blog-1-excerpt">
                  Discover our exciting plans for the first quarter including new features, partnerships, and protocol upgrades.
                </p>
                <Button variant="outline" size="sm" className="w-full" data-testid="button-blog-1">
                  Read More
                </Button>
              </div>
            </Card>

            <Card className="overflow-hidden glassmorphic transition-all hover:scale-105" data-testid="card-blog-2">
              <div className="p-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Calendar className="h-4 w-4" />
                  <span data-testid="text-blog-2-date">March 8, 2024</span>
                </div>
                <h3 className="text-lg font-semibold mb-2" data-testid="title-blog-2">
                  Partnership with Flare Network
                </h3>
                <p className="text-sm text-muted-foreground mb-4" data-testid="text-blog-2-excerpt">
                  We're thrilled to announce our strategic partnership with Flare Network to bring enhanced functionality to our users.
                </p>
                <Button variant="outline" size="sm" className="w-full" data-testid="button-blog-2">
                  Read More
                </Button>
              </div>
            </Card>

            <Card className="overflow-hidden glassmorphic transition-all hover:scale-105" data-testid="card-blog-3">
              <div className="p-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Calendar className="h-4 w-4" />
                  <span data-testid="text-blog-3-date">February 28, 2024</span>
                </div>
                <h3 className="text-lg font-semibold mb-2" data-testid="title-blog-3">
                  New Yield Strategies Available
                </h3>
                <p className="text-sm text-muted-foreground mb-4" data-testid="text-blog-3-excerpt">
                  Explore our newly launched yield strategies designed to maximize your staking rewards with optimized risk management.
                </p>
                <Button variant="outline" size="sm" className="w-full" data-testid="button-blog-3">
                  Read More
                </Button>
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
              Join thousands of users who are already earning rewards while maintaining liquidity
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
              </ul>
            </div>
            <div data-testid="footer-resources">
              <h4 className="font-semibold mb-4" data-testid="heading-footer-resources">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-documentation">Documentation</a></li>
                <li><a href="#" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-api">API</a></li>
                <li><a href="#" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-support">Support</a></li>
              </ul>
            </div>
            <div data-testid="footer-community">
              <h4 className="font-semibold mb-4" data-testid="heading-footer-community">Community</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-twitter">Twitter</a></li>
                <li><a href="#" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-discord">Discord</a></li>
                <li><a href="#" className="hover-elevate inline-block px-2 py-1 rounded-md transition-all" data-testid="link-footer-github">GitHub</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border/50 pt-8 text-center text-sm text-muted-foreground">
            <p data-testid="text-footer-copyright">&copy; 2024 Shield Finance. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
