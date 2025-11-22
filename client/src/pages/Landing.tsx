import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { Shield, TrendingUp, Lock, Zap, ArrowRight, CheckCircle2 } from "lucide-react";

export default function Landing() {
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
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2" data-testid="logo-header">
              <Shield className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">Shield Finance</span>
            </div>
            <nav className="hidden md:flex items-center gap-8" data-testid="nav-header">
              <a href="#features" className="text-sm text-muted-foreground hover-elevate px-3 py-2 rounded-md" data-testid="link-nav-features">
                Features
              </a>
              <a href="#how-it-works" className="text-sm text-muted-foreground hover-elevate px-3 py-2 rounded-md" data-testid="link-nav-how-it-works">
                How It Works
              </a>
              <a href="#security" className="text-sm text-muted-foreground hover-elevate px-3 py-2 rounded-md" data-testid="link-nav-security">
                Security
              </a>
            </nav>
            <Link href="/app">
              <Button data-testid="button-launch-app">
                Launch App
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden" data-testid="section-hero">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight mb-6" data-testid="heading-hero">
              Liquid Staking for{" "}
              <span className="text-primary">XRP Ledger</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto" data-testid="text-hero-subtitle">
              Stake your XRP and earn rewards while maintaining liquidity. Access DeFi opportunities without locking your assets.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/app">
                <Button size="lg" data-testid="button-hero-start">
                  Start Staking
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" data-testid="button-hero-learn">
                Learn More
              </Button>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20" data-testid="stats-container">
              <div data-testid="stat-tvl">
                <div className="text-4xl font-bold text-primary mb-2" data-testid="value-tvl">$24.5M</div>
                <div className="text-sm text-muted-foreground" data-testid="label-tvl">Total Value Locked</div>
              </div>
              <div data-testid="stat-apy">
                <div className="text-4xl font-bold text-primary mb-2" data-testid="value-apy">5.2%</div>
                <div className="text-sm text-muted-foreground" data-testid="label-apy">Average APY</div>
              </div>
              <div data-testid="stat-stakers">
                <div className="text-4xl font-bold text-primary mb-2" data-testid="value-stakers">12,400+</div>
                <div className="text-sm text-muted-foreground" data-testid="label-stakers">Active Stakers</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-muted/30" data-testid="section-features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4" data-testid="heading-features">
              Why Choose Shield Finance
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-features-subtitle">
              The most secure and efficient way to stake XRP on the ledger
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6" data-testid="card-feature-liquidity">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-feature-liquidity">Maintain Liquidity</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-feature-liquidity">
                Receive liquid staking tokens that can be used across DeFi while earning rewards
              </p>
            </Card>

            <Card className="p-6" data-testid="card-feature-security">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-feature-security">Secure & Audited</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-feature-security">
                Smart contracts audited by leading security firms, ensuring your assets are safe
              </p>
            </Card>

            <Card className="p-6" data-testid="card-feature-rewards">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="title-feature-rewards">Competitive APY</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-feature-rewards">
                Earn competitive staking rewards with our optimized validator selection
              </p>
            </Card>

            <Card className="p-6" data-testid="card-feature-instant">
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

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24" data-testid="section-how-it-works">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4" data-testid="heading-how-it-works">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-how-it-works-subtitle">
              Start earning rewards in three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center" data-testid="step-1">
              <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-6" data-testid="badge-step-1">
                1
              </div>
              <h3 className="text-xl font-semibold mb-3" data-testid="title-step-1">Deposit XRP</h3>
              <p className="text-muted-foreground" data-testid="text-step-1">
                Connect your wallet and deposit XRP into the staking vault
              </p>
            </div>

            <div className="text-center" data-testid="step-2">
              <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-6" data-testid="badge-step-2">
                2
              </div>
              <h3 className="text-xl font-semibold mb-3" data-testid="title-step-2">Receive stXRP</h3>
              <p className="text-muted-foreground" data-testid="text-step-2">
                Get liquid staking tokens representing your staked XRP plus rewards
              </p>
            </div>

            <div className="text-center" data-testid="step-3">
              <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-6" data-testid="badge-step-3">
                3
              </div>
              <h3 className="text-xl font-semibold mb-3" data-testid="title-step-3">Earn & Use</h3>
              <p className="text-muted-foreground" data-testid="text-step-3">
                Earn staking rewards while using your stXRP across DeFi protocols
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-24 bg-muted/30" data-testid="section-security">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
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
              <Card className="p-8" data-testid="card-security-status">
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b" data-testid="status-contract">
                    <span className="text-sm text-muted-foreground" data-testid="label-contract-status">Contract Status</span>
                    <span className="text-sm font-semibold text-chart-2" data-testid="value-contract-status">✓ Verified</span>
                  </div>
                  <div className="flex items-center justify-between pb-4 border-b" data-testid="status-audit">
                    <span className="text-sm text-muted-foreground" data-testid="label-audit-status">Security Audit</span>
                    <span className="text-sm font-semibold text-chart-2" data-testid="value-audit-status">✓ Passed</span>
                  </div>
                  <div className="flex items-center justify-between pb-4 border-b" data-testid="status-bounty">
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

      {/* CTA Section */}
      <section className="py-24" data-testid="section-cta">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="bg-primary text-primary-foreground p-12 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4" data-testid="heading-cta">
              Ready to Start Earning?
            </h2>
            <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto" data-testid="text-cta-subtitle">
              Join thousands of users who are already earning rewards while maintaining liquidity
            </p>
            <Link href="/app">
              <Button size="lg" variant="secondary" data-testid="button-cta-launch">
                Launch App
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30" data-testid="footer">
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
                <li><a href="#features" className="hover-elevate inline-block px-2 py-1 rounded-md" data-testid="link-footer-features">Features</a></li>
                <li><a href="#how-it-works" className="hover-elevate inline-block px-2 py-1 rounded-md" data-testid="link-footer-how-it-works">How It Works</a></li>
                <li><a href="#security" className="hover-elevate inline-block px-2 py-1 rounded-md" data-testid="link-footer-security">Security</a></li>
              </ul>
            </div>
            <div data-testid="footer-resources">
              <h4 className="font-semibold mb-4" data-testid="heading-footer-resources">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover-elevate inline-block px-2 py-1 rounded-md" data-testid="link-footer-documentation">Documentation</a></li>
                <li><a href="#" className="hover-elevate inline-block px-2 py-1 rounded-md" data-testid="link-footer-api">API</a></li>
                <li><a href="#" className="hover-elevate inline-block px-2 py-1 rounded-md" data-testid="link-footer-support">Support</a></li>
              </ul>
            </div>
            <div data-testid="footer-community">
              <h4 className="font-semibold mb-4" data-testid="heading-footer-community">Community</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover-elevate inline-block px-2 py-1 rounded-md" data-testid="link-footer-twitter">Twitter</a></li>
                <li><a href="#" className="hover-elevate inline-block px-2 py-1 rounded-md" data-testid="link-footer-discord">Discord</a></li>
                <li><a href="#" className="hover-elevate inline-block px-2 py-1 rounded-md" data-testid="link-footer-github">GitHub</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            <p data-testid="text-footer-copyright">&copy; 2024 Shield Finance. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
