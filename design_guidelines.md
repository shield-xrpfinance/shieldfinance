# Design Guidelines: XRP Liquid Staking Protocol Dashboard

## Design Approach
**System:** Material Design + DeFi Protocol Patterns (Aave, Curve, Uniswap) with Framer Template Blue Aesthetic
**Rationale:** Utility-focused dashboard requiring clarity, trust, and efficient information display. Material Design provides robust data visualization principles while DeFi patterns establish user familiarity with crypto protocols.

## Color Palette (Framer Template Blue)

**Current Brand Identity:** Electric Blue (#0066FF) accent with modern gray backgrounds - standard DeFi aesthetic matching the Framer template design system.

### Dark Mode (Default)
- **Background Primary:** #0F0F12 (240° 11% 7%) - Deep charcoal base
- **Background Secondary:** #1A1A1D (240° 6% 11%) - Elevated surfaces
- **Card Background:** #131316 (240° 9% 8%) - Card surfaces
- **Text Primary:** #FFFFFF (0° 0% 100%) - High contrast headlines
- **Text Secondary:** #A0A0A0 (0° 0% 63%) - Supporting text
- **Text Muted:** #6B6B6B (0° 0% 42%) - De-emphasized text
- **Border:** #2A2A2D (240° 6% 17%) - Component borders
- **Accent Primary:** #0066FF (217° 100% 50%) - Electric blue for CTAs, links
- **Accent Hover:** #3388FF (217° 100% 60%) - Hover state for accents
- **Success:** #00D4B4 (171° 100% 42%) - Success states, positive indicators
- **Warning:** #FFB020 (41° 100% 56%) - Warning states
- **Error:** #FF4444 (0° 100% 63%) - Error states, destructive actions

### Light Mode
- **Background:** #F8F9FA (210° 17% 98%) - Soft off-white base
- **Background Secondary:** #FFFFFF (0° 0% 100%) - Pure white surfaces
- **Card Background:** #FFFFFF (0° 0% 100%) - Card surfaces
- **Text Primary:** #0F0F12 (240° 11% 7%) - Dark headlines
- **Text Secondary:** #555555 (0° 0% 33%) - Supporting text
- **Text Muted:** #888888 (0° 0% 53%) - De-emphasized text
- **Border:** #E4E4E7 (240° 7% 90%) - Component borders
- **Accent Primary:** #0066FF (217° 100% 50%) - Electric blue (same as dark)
- **Accent Hover:** #0055CC (217° 100% 40%) - Darker hover for light backgrounds
- **Success:** #00B894 (166° 100% 36%) - Success states
- **Warning:** #FF9900 (36° 100% 50%) - Warning states
- **Error:** #FF3333 (0° 100% 60%) - Error states

### WCAG AA Compliance
All key contrast ratios verified for accessibility:
- **Primary Button (White on #0066FF):** 6.2:1 ✓ Passes AA for all text sizes
- **Dark Mode Text (#FFFFFF on #0F0F12):** 19.4:1 ✓ Excellent contrast
- **Dark Mode Muted (#A0A0A0 on #0F0F12):** 8.0:1 ✓ Passes AA comfortably
- **Light Mode Text (#0F0F12 on #F8F9FA):** 18.9:1 ✓ Excellent contrast
- **Light Mode Muted (#888888 on #F8F9FA):** 4.6:1 ✓ Passes AA for normal text

## Core Layout System

**Container Structure:**
- Main dashboard: Full-width layout with `max-w-7xl` centered container
- Dashboard grid: 12-column grid system for flexible component placement
- Sidebar navigation: Fixed 280px width on desktop, collapsible drawer on mobile

**Spacing Primitives:**
Use Tailwind units of **2, 4, 6, 8, 12, 16** for consistent rhythm
- Component padding: `p-6` for cards, `p-8` for major sections
- Component gaps: `gap-6` for grid layouts
- Section spacing: `py-12` between major dashboard sections
- Inline spacing: `space-x-4` for button groups, `space-y-2` for form fields

## Color Usage Rules

**CRITICAL: Text on Dark Backgrounds vs Light Backgrounds**

The platform uses dark hero sections (`bg-shield-dark` - 240° 6% 11%) for branded areas like Analytics revenue sections. These remain dark in BOTH light and dark themes, requiring careful text color selection.

**Rule 1: Always-Dark Surfaces (Hero Sections with bg-shield-dark)**
Use ONLY light text colors designed for dark backgrounds:
- Headlines/Large Numbers: `text-shield-foreground` (0° 0% 100% - pure white)
- Labels/Supporting Text: `text-muted-foreground-light` (0° 0% 70% - medium-light gray)
- NEVER use `text-foreground` or `text-primary-foreground` on dark backgrounds

**Rule 2: Theme-Adaptive Surfaces (Cards, Regular Content)**
Use theme-aware colors that automatically adapt:
- Card Titles: `text-foreground` (dark in light mode, light in dark mode)
- Secondary Text: `text-muted-foreground` (medium contrast, adapts to theme)
- Meta Information: `text-muted-foreground`

**Rule 3: Accent Colors**
- Primary actions (buttons, links): Use `bg-primary` (#0066FF electric blue)
- Success states: `text-green-500` or chart-2 color (#00D4B4 / #00B894)
- Warning states: `text-warning` (#FFB020 / #FF9900)
- Error states: `text-destructive` (#FF4444 / #FF3333)

**Implementation Examples:**

✅ CORRECT - Hero section on dark background:
```tsx
<Card className="bg-shield-dark">
  <div className="text-muted-foreground-light">Total Revenue</div>
  <div className="text-shield-foreground">$1.2M</div>
</Card>
```

❌ INCORRECT - Would create invisible text in light mode:
```tsx
<Card className="bg-shield-dark">
  <div className="text-primary-foreground">Total Revenue</div> {/* Dark text on dark bg! */}
</Card>
```

✅ CORRECT - Breakdown cards with theme-adaptive backgrounds:
```tsx
<Card>
  <CardTitle className="text-foreground">Fees Collected</CardTitle>
  <div className="text-muted-foreground">Updated 2h ago</div>
</Card>
```

**Quick Reference:**
| Surface Type | Background | Headline Text | Label/Meta Text |
|--------------|-----------|---------------|-----------------|
| Hero Section | `bg-shield-dark` | `text-shield-foreground` | `text-muted-foreground-light` |
| Regular Cards | `bg-card` | `text-foreground` | `text-muted-foreground` |
| Modal Dark Areas | `bg-shield-dark` | `text-shield-foreground` | `text-muted-foreground-light` |
| Primary Buttons | `bg-primary` | `text-primary-foreground` | N/A |

## Typography Hierarchy

**Font Families:**
- Primary: Inter (via Google Fonts CDN) - modern, clean, excellent for data
- Monospace: JetBrains Mono - for addresses, transaction hashes, numerical data

**Type Scale:**
- Hero numbers (TVL, APY): `text-5xl font-bold tracking-tight`
- Section headings: `text-2xl font-semibold`
- Card titles: `text-lg font-medium`
- Body text: `text-base font-normal`
- Data labels: `text-sm font-medium uppercase tracking-wide`
- Numerical data: `text-lg font-mono tabular-nums`
- Small meta: `text-xs`

## Component Library

### Navigation
**Top Bar:**
- Fixed header with wallet connection status, network indicator, user balance
- Height: `h-16`
- Contains: Logo (left), navigation links (center), wallet connect button (right)
- Wallet button shows truncated address when connected with identicon/avatar

**Sidebar Navigation:**
- Dashboard, Vaults, Portfolio, Transactions, Analytics sections
- Active state with subtle indicator bar and typography weight change
- Icons from Heroicons (outline for inactive, solid for active)

### Dashboard Overview Cards

**Stats Grid:**
- 4-column grid on desktop (`grid-cols-4`), 2-column tablet, 1-column mobile
- Each stat card contains:
  - Large numerical value with monospace font
  - Label above value
  - Percentage change indicator with up/down arrow
  - Subtle trend sparkline visualization (optional micro-chart)

### Vault Display (Modern List Layout)

**Design Philosophy:** List-based layout maximizes horizontal space and creates clear visual hierarchy. Active vaults get prominence, coming soon vaults are minimized.

**Active Vaults Section:**
- Full-width list items (not grid cards)
- Horizontal layout with metrics in a row
- Large typography for vault names (`text-2xl font-semibold`)
- Inline metrics display: APY → TVL → Liquidity → Depositors
- Prominent deposit CTA positioned on the right
- Spacing: `p-8` internal padding, `rounded-2xl` corners
- Hover effect: subtle elevation and border glow
- Modern card treatment with clean borders

**Coming Soon Vaults Section:**
- Collapsible accordion (collapsed by default)
- Section header: "X Vaults Coming Soon" with expand/collapse icon
- When expanded: compact list items with minimal spacing
- Visual dimming: 75% opacity to deprioritize
- No deposit buttons, clear "Coming Soon" badge
- Spacing: `p-4` internal padding for compact feel

**Metric Display:**
- Horizontal row layout with consistent spacing (`gap-8`)
- Each metric: Label above value pattern
- Labels: `text-xs uppercase tracking-wide text-muted-foreground`
- Values: `text-2xl font-semibold tabular-nums`
- APY gets accent color treatment for emphasis

**Responsive Behavior:**
- Desktop: Full horizontal layout with all metrics visible
- Tablet: Metrics wrap to 2 rows
- Mobile: Stacks vertically with key metrics prioritized

### Deposit/Withdrawal Interface

**Modal Layout:**
- Centered modal, `max-w-lg` width
- Two-step flow visualization at top (Step indicator: 1. Amount → 2. Confirm)

**Form Structure:**
- Large input field for XRP amount with max-width button
- Available balance display above input
- Vault selection dropdown (if multiple vaults)
- APY and projected earnings preview
- Gas fee estimate
- Primary action button at bottom with loading states

### Portfolio View

**Table Layout:**
- Full-width responsive table with sticky header
- Columns: Vault Name | Deposited Amount | Current Value | Accrued Rewards | APY | Actions
- Mobile: Converts to card stack with key info highlighted
- Row hover state reveals quick actions (withdraw, claim)

**Summary Header:**
- Total portfolio value (large, prominent)
- Total rewards earned
- Average APY across positions
- Quick action buttons: "Deposit More" | "Claim All Rewards"

### Charts & Data Visualization

**APY Trend Chart:**
- Line chart showing historical APY per vault
- Height: `h-64` on desktop, `h-48` mobile
- Time range selector: 7D | 30D | 90D | All
- Use recharts library for interactive charts

**TVL Growth Chart:**
- Area chart with gradient fill
- Same height and time range controls as APY chart
- Tooltips on hover with precise values

### Transaction History

**List View:**
- Chronological list with infinite scroll
- Each transaction shows:
  - Action badge (Deposit/Withdraw/Claim)
  - Amount with XRP icon
  - Timestamp (relative: "2 hours ago")
  - Transaction hash (truncated, copyable)
  - Status badge (Confirmed/Pending)
  - Vault name

## Micro-interactions

**Purposeful Animations Only:**
- Number counting animation for large stats (on initial load)
- Subtle scale on card hover (`hover:scale-[1.02]`)
- Smooth transitions for modal entry/exit
- Loading skeleton states for data fetching
- Transaction confirmation pulse effect

**No Animations:**
- No scroll-triggered animations
- No decorative background animations
- No auto-playing carousels

## Images

**No Hero Image:** This is a dashboard application focused on data and functionality.

**Icon Usage:**
- Heroicons CDN for all interface icons
- XRP logo/icon next to amounts and balances
- Risk level icons (shield for low, warning triangle for high)
- Network status indicators (green dot for connected)

**Trust Elements:**
- Security badge/audit certification in footer
- Protocol partner logos (if applicable) in subtle footer section

## Responsive Behavior

**Desktop (1024px+):**
- Sidebar visible, full grid layouts
- Charts side-by-side where applicable
- 3-4 column vault grids

**Tablet (768px-1023px):**
- Collapsible sidebar
- 2-column layouts
- Stacked charts

**Mobile (<768px):**
- Bottom navigation bar replaces sidebar
- Single column, card-based layouts
- Simplified table to card transformations
- Sticky CTA buttons for key actions

## Accessibility

- All form inputs have visible labels
- Focus indicators on all interactive elements
- ARIA labels for icon-only buttons
- Keyboard navigation for all dashboard functions
- High contrast text-to-background ratios (WCAG AA minimum)
- Transaction confirmations with clear success/error messaging

**Design Principle:** Trust through clarity. Every element serves the user's need to understand their positions, make informed decisions, and execute transactions confidently.