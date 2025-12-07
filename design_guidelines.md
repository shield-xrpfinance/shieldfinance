# Design Guidelines: Shield Finance - XRP Liquid Staking Protocol

## Design Approach
**System:** Aura Financial Dark Mode Aesthetic + Modern DeFi Protocol Patterns
**Rationale:** Premium, futuristic dark theme with sky blue accents that conveys trust, security, and sophistication. Inspired by high-end fintech landing pages with glass morphism, subtle animations, and serif headline typography.

## Color Palette (Aura Financial Sky Blue)

**Brand Identity:** Sky Blue (#38BDF8) accent with near-black backgrounds - premium DeFi aesthetic with glowing text effects and animated elements.

### Dark Mode (Primary Theme)
- **Background Primary:** #030303 (0° 0% 2%) - Near-black base
- **Background Panel:** #0F110E (80° 7% 6%) - Elevated surfaces/cards
- **Card Background:** rgba(255, 255, 255, 0.1) with backdrop blur - Glass morphism
- **Text Primary:** #FFFFFF (0° 0% 100%) - High contrast headlines
- **Text Secondary:** rgba(255, 255, 255, 0.7) - Supporting text
- **Text Muted:** rgba(255, 255, 255, 0.4) - De-emphasized text
- **Border:** rgba(255, 255, 255, 0.1) - Subtle glass borders
- **Accent Primary:** #38BDF8 (199° 89% 60%) - Sky blue for CTAs, links, glowing elements
- **Accent Secondary:** #0EA5E9 (199° 89% 48%) - Deeper sky blue for gradients
- **Success:** #00D4B4 (171° 100% 42%) - Success states
- **Warning:** #FFB020 (41° 100% 56%) - Warning states
- **Error:** #FF4444 (0° 100% 63%) - Error states

### Light Mode
- **Background:** #F8F9FA (210° 17% 98%) - Soft off-white base
- **Card Background:** #FFFFFF (0° 0% 100%) - Pure white surfaces
- **Text Primary:** #0F0F12 (240° 11% 7%) - Dark headlines
- **Text Secondary:** #555555 (0° 0% 33%) - Supporting text
- **Accent Primary:** #38BDF8 (199° 89% 60%) - Sky blue (consistent)
- **Note:** Light mode is secondary; the landing page is designed for dark mode experience

### WCAG AA Compliance
All key contrast ratios verified for accessibility:
- **Primary Text (#FFFFFF on #030303):** 21:1 ✓ Maximum contrast
- **Secondary Text (rgba(255,255,255,0.7) on #030303):** 12.6:1 ✓ Excellent contrast
- **Accent Text (#38BDF8 on #030303):** 9.8:1 ✓ Passes AA comfortably

## Typography Hierarchy

**Font Families:**
- **Sans-serif:** Inter (Google Fonts) - Modern, clean UI text
- **Serif:** Newsreader (Google Fonts) - Elegant italic headlines for hero sections
- **Monospace:** JetBrains Mono - Status indicators, addresses, numerical data

**Type Scale - Landing Page:**
- Hero headline: `text-5xl lg:text-7xl font-serif italic tracking-tight text-glow`
- Section headings: `text-4xl lg:text-5xl font-serif italic text-primary text-glow`
- Card titles: `text-xl font-semibold text-white`
- Body text: `text-lg lg:text-2xl font-light text-white/70 leading-relaxed`
- Data labels: `text-xs font-mono tracking-[0.2em] text-white/40 uppercase`
- Numerical data (stats): `text-2xl lg:text-3xl font-bold text-primary`
- Small meta: `text-xs text-white/50`

## Visual Effects & Utilities

### Text Glow Effect
Use for primary headlines to create a luminous effect:
```css
.text-glow {
  text-shadow: 0 0 25px rgba(56, 189, 248, 0.4);
}
```
Apply: `className="text-primary text-glow"`

### Grid Background
Subtle grid pattern for the page background:
```css
.grid-bg {
  background-size: 100px 200px;
  background-image: linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  mask-image: radial-gradient(circle at center, black 40%, transparent 100%);
}
```

### Radial Glow
Atmospheric lighting effect:
```css
.radial-glow {
  background: radial-gradient(circle at 70% 50%, rgba(56, 189, 248, 0.25) 0%, rgba(5, 5, 5, 0) 60%);
}
```

### Glass Card
Modern glass morphism for cards:
```css
.glass-card {
  background: linear-gradient(to bottom right, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0));
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### Shiny CTA Button
Animated border gradient button for primary CTAs:
- Spinning conic gradient border animation
- Near-black fill with glowing hover state
- Pill-shaped (`rounded-full`)
- Apply: `className="shiny-cta"`

### Gradient Border Button
Secondary button with subtle gradient border:
- Dark semi-transparent fill
- Subtle gradient border using mask technique
- Apply: `className="gradient-border-btn"`

### Monotone Logo Filter
Grayscale partner logos that brighten on hover:
```css
.monotone-logo {
  filter: grayscale(100%) brightness(150%) contrast(0.5);
  opacity: 0.5;
}
.monotone-logo:hover {
  opacity: 1;
  filter: grayscale(100%) brightness(200%);
}
```

## Navigation

### Floating Pill Navigation
- Fixed position, centered horizontally at `top-6`
- Pill-shaped container with `rounded-full`
- Glass effect with `nav-pill` class (gradient background + shadow)
- Ring border: `ring-white/10 ring-1`
- Backdrop blur: `backdrop-blur-xl`
- Contains: Logo, nav links, CTA button
- Mobile: Hamburger menu with expandable dropdown

### Navigation Links
- Desktop: Horizontal row of links
- Style: `text-xs font-medium text-white/50 hover:text-white transition-colors`
- Spacing: `gap-6` between links

## Section Structure

### Hero Section
- Full viewport height: `min-h-screen`
- Two-column layout on desktop: Copy left, visualization right
- Status badge with pinging indicator
- Large serif italic headline with text-glow on accent portion
- Descriptive paragraph in light weight
- CTA row with shiny-cta and gradient-border-btn
- Stats grid at bottom with glass-card styling

### Feature Sections
- Section heading: Serif italic with text-glow
- Centered header with max-width description
- Grid of glass-card feature cards
- Card structure: Icon container, title, description
- Hover effect: `hover:scale-[1.02] transition-all`

### Partner/Logo Section
- Centered text heading in mono uppercase
- Flex row of monotone logos
- Border-top separator

## Spacing System

**Container:** `max-w-7xl mx-auto px-6 lg:px-12`

**Section Spacing:**
- Vertical padding: `py-24`
- Border separator: `border-t border-white/5`

**Component Spacing:**
- Card padding: `p-8` for feature cards
- Stats card padding: `p-4`
- Button gap: `gap-6` for CTA rows
- Feature grid gap: `gap-6`

## Animations

### Scroll-triggered Fade
Elements fade in and slide up on scroll visibility:
```css
.animate-fade-in-up {
  animation: fade-in-up 0.6s ease-out forwards;
}
```

### Status Indicator Ping
Pulsing dot for "live" status:
```html
<span class="relative flex h-2 w-2">
  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
  <span class="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
</span>
```

### Beam Animation
SVG path animation for connecting lines in hero visualization

### Sonar Animation
Expanding circle waves from central node

### Spin Animations
- `animate-spin` with custom duration for rotating rings
- Reverse direction option for visual interest

## Responsive Behavior

**Desktop (1024px+):**
- Two-column hero layout
- 3-column feature grid
- Floating pill nav with full links

**Tablet (768px-1023px):**
- 2-column feature grid
- Condensed navigation

**Mobile (<768px):**
- Single column layouts
- Hamburger menu navigation
- Stacked CTA buttons
- Reduced hero visualization size

## Implementation Notes

### CSS Classes Location
All custom CSS utilities are defined in `client/src/index.css`:
- Text effects: `.text-glow`, `.text-glow-strong`
- Backgrounds: `.grid-bg`, `.radial-glow`
- Buttons: `.shiny-cta`, `.gradient-border-btn`
- Cards: `.glass-card`
- Logos: `.monotone-logo`
- Animations: `.animate-fade-in-up`, `.animate-beam`, `.animate-sonar`

### Tailwind Configuration
Custom colors and animations in `tailwind.config.ts`:
- Brand colors: `primary`, `brand.sky`, `brand.dark`, `brand.panel`
- Font families: `font-sans`, `font-serif`
- Custom animations: `spin-slow`, `spin-slow-reverse`, `pulse-fast`

### Key Design Principle
**Trust through elegance.** The dark theme with sky blue accents creates a premium, professional appearance that inspires confidence. Glass morphism and subtle animations add depth without distraction. Serif headlines provide sophistication while maintaining readability.
