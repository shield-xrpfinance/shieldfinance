import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  Download, 
  Copy, 
  Check, 
  Menu, 
  X,
  ExternalLink 
} from "lucide-react";
import { useShieldLogo } from "@/components/ShieldLogo";
import shieldLogoDark from "@assets/shield_logo_1763760253079.png";

const sections = [
  { id: "logos", label: "Logo & Symbol" },
  { id: "colors", label: "Colors" },
  { id: "typefaces", label: "Typefaces" },
  { id: "icons", label: "Icons" },
  { id: "images", label: "Images" },
];

const brandColors = [
  { name: "Sky Blue (Primary)", hex: "38BDF8", usage: "Primary accent, CTAs, links, glowing elements" },
  { name: "Deep Sky", hex: "0EA5E9", usage: "Gradient secondary, hover states" },
  { name: "Near Black", hex: "030303", usage: "Primary background" },
  { name: "Panel Dark", hex: "0F110E", usage: "Elevated surfaces, cards" },
  { name: "White", hex: "FFFFFF", usage: "Primary text, high contrast" },
  { name: "White 70%", hex: "FFFFFFB3", usage: "Secondary text" },
  { name: "White 40%", hex: "FFFFFF66", usage: "Muted text, labels" },
  { name: "Success", hex: "00D4B4", usage: "Success states, positive indicators" },
  { name: "Warning", hex: "FFB020", usage: "Warning states, caution" },
  { name: "Error", hex: "FF4444", usage: "Error states, destructive actions" },
];

export default function Brand() {
  const shieldLogo = useShieldLogo();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("logos");
  const [copiedColor, setCopiedColor] = useState<string | null>(null);

  const copyToClipboard = (hex: string) => {
    navigator.clipboard.writeText(`#${hex}`);
    setCopiedColor(hex);
    setTimeout(() => setCopiedColor(null), 2000);
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    document.title = "Brand Assets - Shield Finance";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", "Download Shield Finance brand assets including logos, colors, typography, and icons. Access our complete brand kit for press and partners.");
    }

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      
      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] text-white overflow-x-hidden selection:bg-primary selection:text-black relative">
      
      {/* Floating Pill Navigation */}
      <nav className="fixed left-1/2 -translate-x-1/2 flex w-full lg:w-fit max-w-[90vw] z-50 rounded-full ring-white/10 ring-1 py-1.5 pr-1.5 pl-4 top-6 backdrop-blur-xl items-center justify-between transition-all duration-300 hover:border-white/20 hover:shadow-primary/5 bg-gradient-to-br from-white/10 to-white/0 shadow-[0_2.8px_2.2px_rgba(0,_0,_0,_0.034),_0_6.7px_5.3px_rgba(0,_0,_0,_0.048),_0_12.5px_10px_rgba(0,_0,_0,_0.06),_0_22.3px_17.9px_rgba(0,_0,_0,_0.072),_0_41.8px_33.4px_rgba(0,_0,_0,_0.086),_0_100px_80px_rgba(0,_0,_0,_0.12)]" data-testid="nav-header">
        <Link href="/">
          <div className="flex gap-2.5 items-center mr-8 cursor-pointer">
            <img src={shieldLogo} alt="Shield Finance" className="h-6 w-6" data-testid="img-logo" />
            <span className="font-sans font-medium text-base tracking-tight text-white">Shield</span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-6 mr-8">
          <Link href="/" className="text-xs font-medium text-white/50 hover:text-white transition-colors" data-testid="link-nav-home">Home</Link>
          <Link href="/security" className="text-xs font-medium text-white/50 hover:text-white transition-colors" data-testid="link-nav-security">Security</Link>
          <a href="https://docs.shyield.finance" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-white/50 hover:text-white transition-colors" data-testid="link-nav-docs">Docs</a>
        </div>

        <button
          className="md:hidden text-white/70 hover:text-white p-2 mr-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          data-testid="button-mobile-menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link href="/app">
          <button className="flex gap-2 hover:bg-primary transition-colors group text-xs font-semibold text-black bg-white rounded-full py-2 px-4 items-center" data-testid="button-launch-app">
            Launch App
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </Link>
      </nav>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/90 backdrop-blur-sm pt-24 px-6" data-testid="nav-mobile-menu">
          <div className="flex flex-col gap-4">
            <Link href="/" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-white/80 hover:text-white py-2" data-testid="link-mobile-home">Home</Link>
            <Link href="/security" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-white/80 hover:text-white py-2" data-testid="link-mobile-security">Security</Link>
            <a href="https://docs.shyield.finance" target="_blank" rel="noopener noreferrer" className="text-lg font-medium text-white/80 hover:text-white py-2" data-testid="link-mobile-docs">Docs</a>
            <div className="border-t border-white/10 pt-4 mt-2">
              <p className="text-xs font-mono text-white/40 uppercase tracking-wider mb-3">Sections</p>
              {sections.map((section) => (
                <button 
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className="block w-full text-left text-lg font-medium text-white/60 hover:text-primary py-2"
                  data-testid={`link-mobile-${section.id}`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative pt-32 pb-16 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Left side - Title */}
            <div className="flex-1">
              <h1 className="text-5xl lg:text-7xl font-serif italic tracking-tight text-white mb-6" data-testid="text-page-title">
                Brand <span className="text-primary text-glow">Assets</span>
              </h1>
              <p className="text-lg lg:text-xl font-light text-white/70 leading-relaxed max-w-xl" data-testid="text-page-description">
                Download official Shield Finance brand assets for press, partnerships, and integrations. Our brand represents security, innovation, and trust in DeFi.
              </p>
            </div>

            {/* Right side - Section Navigation */}
            <div className="lg:w-64 shrink-0">
              <div className="lg:sticky lg:top-28">
                <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0" data-testid="nav-section-links">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`whitespace-nowrap text-left px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                        activeSection === section.id
                          ? 'bg-primary/20 text-primary border border-primary/30'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                      data-testid={`button-section-${section.id}`}
                    >
                      {section.label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos Section */}
      <section id="logos" className="py-24 px-6 lg:px-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl lg:text-5xl font-serif italic text-white text-glow mb-4" data-testid="text-section-logos">
            Logo & Symbol
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mb-12">
            The Shield Finance logo represents protection and security in the DeFi space. Use the appropriate variant based on your background color.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Dark Background Logo */}
            <div className="glass-card rounded-2xl p-8" data-testid="card-logo-dark">
              <div className="bg-[#030303] rounded-xl p-12 flex items-center justify-center mb-6 border border-white/10">
                <img src={shieldLogoDark} alt="Shield Finance Logo - Dark" className="h-24 w-auto" data-testid="img-logo-dark" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Primary Logo (Dark Backgrounds)</h3>
              <p className="text-sm text-white/50 mb-4">Use on dark backgrounds for maximum visibility.</p>
              <div className="flex gap-3 flex-wrap">
                <a href="/shield-logo.png" download className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors" data-testid="button-download-logo-dark-png">
                  <Download className="h-4 w-4" /> PNG
                </a>
              </div>
            </div>

            {/* Light Background Logo */}
            <div className="glass-card rounded-2xl p-8" data-testid="card-logo-light">
              <div className="bg-white rounded-xl p-12 flex items-center justify-center mb-6">
                <img src={shieldLogoDark} alt="Shield Finance Logo - Light" className="h-24 w-auto" data-testid="img-logo-light" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Symbol Mark</h3>
              <p className="text-sm text-white/50 mb-4">The shield symbol can be used independently when space is limited.</p>
              <div className="flex gap-3 flex-wrap">
                <a href="/logo.png" download className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors" data-testid="button-download-logo-light-png">
                  <Download className="h-4 w-4" /> PNG
                </a>
              </div>
            </div>
          </div>

          {/* Logo Usage Guidelines */}
          <div className="mt-12 glass-card rounded-2xl p-8" data-testid="card-logo-guidelines">
            <h3 className="text-xl font-semibold text-white mb-4">Usage Guidelines</h3>
            <ul className="grid md:grid-cols-2 gap-4 text-white/70">
              <li className="flex items-start gap-3">
                <span className="text-primary">✓</span>
                Maintain clear space around the logo equal to the height of the shield
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary">✓</span>
                Use the full-color logo whenever possible
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400">✗</span>
                Do not stretch, rotate, or distort the logo
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400">✗</span>
                Do not alter the logo colors or add effects
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Colors Section */}
      <section id="colors" className="py-24 px-6 lg:px-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl lg:text-5xl font-serif italic text-white text-glow mb-4" data-testid="text-section-colors">
            Colors
          </h2>
          <p className="text-lg text-white/60 max-w-3xl mb-12">
            Our Sky Blue primary color is vibrant and distinct, designed to stand out on dark backgrounds. Combined with near-black and white, it creates a minimalistic yet modern and bold aesthetic perfect for DeFi applications.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {brandColors.map((color) => (
              <button
                key={color.hex}
                onClick={() => copyToClipboard(color.hex)}
                className="group glass-card rounded-xl p-4 text-left hover:scale-[1.02] transition-all"
                data-testid={`button-color-${color.hex.toLowerCase()}`}
              >
                <div 
                  className="h-20 rounded-lg mb-4 border border-white/10"
                  style={{ backgroundColor: `#${color.hex.replace('B3', '').replace('66', '')}`, opacity: color.hex.includes('B3') ? 0.7 : color.hex.includes('66') ? 0.4 : 1 }}
                />
                <p className="font-mono text-sm text-white mb-1 flex items-center gap-2">
                  #{color.hex.substring(0, 6)}
                  {copiedColor === color.hex ? (
                    <Check className="h-3 w-3 text-primary" />
                  ) : (
                    <Copy className="h-3 w-3 opacity-0 group-hover:opacity-50" />
                  )}
                </p>
                <p className="text-xs text-white/60 font-medium">{color.name}</p>
                <p className="text-xs text-white/40 mt-1">{color.usage}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Typefaces Section */}
      <section id="typefaces" className="py-24 px-6 lg:px-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl lg:text-5xl font-serif italic text-white text-glow mb-4" data-testid="text-section-typefaces">
            Typefaces
          </h2>
          <p className="text-lg text-white/60 max-w-3xl mb-12">
            We use a carefully selected combination of fonts to convey both elegance and clarity. Newsreader provides sophisticated headlines while Inter ensures excellent readability for body text.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Newsreader */}
            <div className="glass-card rounded-2xl p-8" data-testid="card-font-newsreader">
              <h3 className="text-6xl font-serif italic text-white mb-4">Newsreader</h3>
              <p className="text-xl font-serif italic text-white/70 mb-6">Italic Headlines</p>
              <div className="space-y-2 text-white/50 text-sm">
                <p>Used for: Hero headlines, section titles, emphasis</p>
                <p>Weight: Regular Italic</p>
                <p className="pt-4">
                  <a 
                    href="https://fonts.google.com/specimen/Newsreader" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline"
                    data-testid="link-font-newsreader"
                  >
                    View on Google Fonts <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="font-serif italic text-3xl text-white leading-relaxed">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
            </div>

            {/* Inter */}
            <div className="glass-card rounded-2xl p-8" data-testid="card-font-inter">
              <h3 className="text-6xl font-sans font-medium text-white mb-4">Inter</h3>
              <p className="text-xl font-sans text-white/70 mb-6">Body & UI Text</p>
              <div className="space-y-2 text-white/50 text-sm">
                <p>Used for: Body text, navigation, buttons, labels</p>
                <p>Weights: Light (300), Regular (400), Medium (500), Semibold (600), Bold (700)</p>
                <p className="pt-4">
                  <a 
                    href="https://fonts.google.com/specimen/Inter" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline"
                    data-testid="link-font-inter"
                  >
                    View on Google Fonts <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
              <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
                <p className="font-sans font-light text-xl text-white">Light: The quick brown fox</p>
                <p className="font-sans font-normal text-xl text-white">Regular: The quick brown fox</p>
                <p className="font-sans font-semibold text-xl text-white">Semibold: The quick brown fox</p>
              </div>
            </div>
          </div>

          {/* JetBrains Mono */}
          <div className="mt-8 glass-card rounded-2xl p-8" data-testid="card-font-mono">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-4xl font-mono text-white mb-2">JetBrains Mono</h3>
                <p className="text-white/70">Monospace - Data & Code</p>
              </div>
              <a 
                href="https://fonts.google.com/specimen/JetBrains+Mono" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
                data-testid="link-font-mono"
              >
                View on Google Fonts <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="font-mono text-lg text-white/60 mb-4">
              Used for: Wallet addresses, numerical data, status indicators
            </p>
            <div className="bg-black/40 rounded-lg p-4 font-mono text-sm text-primary">
              0x1234...5678 | TVL: $12.5M | APY: 8.45%
            </div>
          </div>
        </div>
      </section>

      {/* Icons Section */}
      <section id="icons" className="py-24 px-6 lg:px-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl lg:text-5xl font-serif italic text-white text-glow mb-4" data-testid="text-section-icons">
            Icons
          </h2>
          <p className="text-lg text-white/60 max-w-3xl mb-12">
            Shield Finance uses the <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Lucide React</a> icon library for its flexibility, consistency, and open-source nature. These icons are perfect for finance, security, and DeFi applications.
          </p>

          <div className="glass-card rounded-2xl p-8" data-testid="card-icons">
            <div className="grid grid-cols-4 md:grid-cols-8 gap-6 mb-8">
              {/* Sample icons */}
              {[
                { Icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>, name: "Shield" },
                { Icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>, name: "Lock" },
                { Icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>, name: "Wallet" },
                { Icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, name: "Dollar" },
                { Icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>, name: "Megaphone" },
                { Icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>, name: "Chart" },
                { Icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, name: "Clock" },
                { Icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, name: "Users" },
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-white/5 transition-colors">
                  <div className="text-primary">
                    <item.Icon />
                  </div>
                  <span className="text-xs text-white/50">{item.name}</span>
                </div>
              ))}
            </div>
            
            <div className="border-t border-white/10 pt-6">
              <p className="text-white/60 mb-4">
                Lucide provides 1400+ icons with consistent 24x24 sizing, 2px stroke width, and rounded caps. All icons are open-source under the ISC license.
              </p>
              <a 
                href="https://lucide.dev/icons" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-sm font-medium transition-colors"
                data-testid="link-lucide-icons"
              >
                Browse All Icons <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Images Section */}
      <section id="images" className="py-24 px-6 lg:px-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl lg:text-5xl font-serif italic text-white text-glow mb-4" data-testid="text-section-images">
            Images
          </h2>
          <p className="text-lg text-white/60 max-w-3xl mb-12">
            Background textures and visual elements that define the Shield Finance aesthetic. Our imagery emphasizes security, technology, and innovation.
          </p>

          {/* Background Textures */}
          <div className="mb-12">
            <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              Background Textures
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="glass-card rounded-xl overflow-hidden" data-testid="card-texture-grid">
                <div className="h-48 bg-[#030303] grid-bg"></div>
                <div className="p-4">
                  <p className="text-sm font-medium text-white mb-1">Grid Pattern</p>
                  <p className="text-xs text-white/50">Subtle grid for page backgrounds</p>
                </div>
              </div>
              <div className="glass-card rounded-xl overflow-hidden" data-testid="card-texture-radial">
                <div className="h-48 bg-[#030303] radial-glow"></div>
                <div className="p-4">
                  <p className="text-sm font-medium text-white mb-1">Radial Glow</p>
                  <p className="text-xs text-white/50">Atmospheric lighting effect</p>
                </div>
              </div>
              <div className="glass-card rounded-xl overflow-hidden" data-testid="card-texture-glass">
                <div className="h-48 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-sm border border-white/10"></div>
                <div className="p-4">
                  <p className="text-sm font-medium text-white mb-1">Glass Morphism</p>
                  <p className="text-xs text-white/50">Card and panel styling</p>
                </div>
              </div>
            </div>
          </div>

          {/* Social Share */}
          <div>
            <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              Social Media Assets
            </h3>
            <div className="glass-card rounded-2xl p-8" data-testid="card-social-assets">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <img 
                    src="/social-share-image.jpg" 
                    alt="Shield Finance Social Share" 
                    className="rounded-xl border border-white/10 w-full"
                    data-testid="img-social-share"
                  />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Open Graph Image</h4>
                  <p className="text-white/60 text-sm mb-4">
                    Use this image for social media sharing and link previews. Optimized for Twitter, LinkedIn, and Facebook.
                  </p>
                  <p className="text-xs text-white/40 mb-4">Dimensions: 1200 × 630px</p>
                  <a 
                    href="/social-share-image.jpg" 
                    download 
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                    data-testid="button-download-social"
                  >
                    <Download className="h-4 w-4" /> Download
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 px-6 lg:px-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-serif italic text-white mb-4" data-testid="text-cta-title">
            Need something else?
          </h2>
          <p className="text-lg text-white/60 mb-8 max-w-xl mx-auto">
            For press inquiries, partnership requests, or custom brand assets, please reach out to our team.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="https://twitter.com/shield_finance" 
              target="_blank" 
              rel="noopener noreferrer"
              className="shiny-cta"
              data-testid="link-twitter"
            >
              Contact on X
            </a>
            <Link href="/app">
              <Button variant="outline" size="lg" className="rounded-full" data-testid="button-explore-app">
                Explore the App <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 lg:px-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={shieldLogo} alt="Shield Finance" className="h-5 w-5" />
            <span className="text-sm text-white/50">© 2025 Shield Finance. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="text-sm text-white/50 hover:text-white transition-colors" data-testid="link-terms">Terms</Link>
            <Link href="/privacy" className="text-sm text-white/50 hover:text-white transition-colors" data-testid="link-privacy">Privacy</Link>
            <Link href="/security" className="text-sm text-white/50 hover:text-white transition-colors" data-testid="link-security">Security</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
