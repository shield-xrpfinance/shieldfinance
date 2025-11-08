# Design Guidelines: XRP Liquid Staking Protocol Dashboard

## Design Approach
**System:** Material Design + DeFi Protocol Patterns (Aave, Curve, Uniswap)
**Rationale:** Utility-focused dashboard requiring clarity, trust, and efficient information display. Material Design provides robust data visualization principles while DeFi patterns establish user familiarity with crypto protocols.

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

### Vault Cards

**Layout:** 3-column grid (`lg:grid-cols-3 md:grid-cols-2 grid-cols-1`)

Each vault card includes:
- Vault name and protocol badge (top)
- Large APY display (center, `text-4xl font-bold`)
- Key metrics grid (2x2):
  - Total Value Locked
  - Liquidity Available
  - Lock Period
  - Risk Rating (badge with icon)
- Action button: "Deposit XRP" (full-width, prominent)
- Footer: Current depositors count, vault status badge

**Card Spacing:** `p-6` internal padding, `rounded-xl` corners, subtle border

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