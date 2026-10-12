---
name: Prep Cafe
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45474c'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#75777d'
  outline-variant: '#c5c6cd'
  surface-tint: '#545f73'
  primary: '#091426'
  on-primary: '#ffffff'
  primary-container: '#1e293b'
  on-primary-container: '#8590a6'
  inverse-primary: '#bcc7de'
  secondary: '#9a4614'
  on-secondary: '#ffffff'
  secondary-container: '#fd925b'
  on-secondary-container: '#712c00'
  tertiary: '#201100'
  on-tertiary: '#ffffff'
  tertiary-container: '#3c2300'
  on-tertiary-container: '#c88000'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e3fb'
  primary-fixed-dim: '#bcc7de'
  on-primary-fixed: '#111c2d'
  on-primary-fixed-variant: '#3c475a'
  secondary-fixed: '#ffdbcb'
  secondary-fixed-dim: '#ffb693'
  on-secondary-fixed: '#341000'
  on-secondary-fixed-variant: '#7a3000'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  espresso-dark: '#78350F'
  espresso-amber: '#D97706'
  surface-canvas: '#F8FAFC'
  surface-subtle: '#F1F5F9'
  surface-card: '#FFFFFF'
  text-primary: '#0F172A'
  text-muted: '#64748B'
  border-subtle: '#E2E8F0'
  border-strong: '#CBD5E1'
  metric-positive: '#10B981'
  metric-positive-surface: '#ECFDF5'
  metric-negative: '#EF4444'
  metric-negative-surface: '#FEF2F2'
  status-actual-bg: '#0F172A'
  status-actual-text: '#FFFFFF'
  status-projected-bg: '#FEF3C7'
  status-projected-text: '#92400E'
  takeout-badge-bg: '#EFF6FF'
  takeout-badge-text: '#1D4ED8'
  store-badge-bg: '#F3E8FF'
  store-badge-text: '#6B21A8'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  metric-stat-lg:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  metric-stat-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
  tabular-numeric:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-compact: 0.5rem
  margin: 1.5rem
  margin-mobile: 0.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 1.75rem
---

## Brand & Style

This design system delivers a high-density, pragmatic ERP and POS management experience tailored specifically for single-operator cafe owners. The operational reality of an independent cafe involves continuous context switching between counter service, kitchen prep, and back-office bookkeeping across both desktop and tablet terminals. The interface is engineered to eliminate cognitive friction, ambiguity, and input fatigue during high-volume rush hours and end-of-day reconciliation.

The aesthetic fuses **Modern Utilitarian SaaS** with **Warm Tactile Cafe Accents**. The foundational canvas relies on crisp, organized slate and off-white tones that prioritize data legibility, structured grids, and tabular metrics. Warm espresso undertones and golden honey accents inject a focused hospitality craft into an otherwise technical workspace, avoiding the sterile clinical look of legacy generic ERPs while avoiding decorative distractions.

## Colors

The palette establishes an unambiguous hierarchy between structural chrome, operational data streams, and accounting indicators:

- **Primary Slate (`#1E293B`)**: Serves as the authoritative structural backbone for navigation rails, table headers, modal frames, and primary high-priority actions.
- **Secondary Espresso (`#92400E`) & Espresso Dark (`#78350F`)**: Represents cafe operational metrics (recipes, ingredient costs, inventory catalogs), lending warm material grounding to the workspace.
- **Brand Accent Amber (`#F59E0B`)**: Used for warnings, attention markers, pending daily closings, and low-inventory triggers.
- **Data Surfaces (`#F8FAFC`, `#FFFFFF`)**: Pure white cards float over an off-white canvas, keeping dense tabular lines readable under changing ambient light at counter workstations.
- **Semantic Accounting States**: 
  - Revenue, gains, and positive margins strictly use Emerald (`#10B981`).
  - Expenses, cost spikes, waste, and deficits strictly use Rose/Red (`#EF4444`).
  - Confirmed figures (`확정 실적`) use dense solid slate tags, whereas estimated or unclosed records (`예상/미마감`) adopt a high-visibility amber pill to prevent premature financial assumptions.

## Typography

The type scale is built around systematic density, Korean-Latin balance, and financial precision:

- **Font Family**: Inter (complemented by standard Korean system fallbacks like Pretendard and Apple SD Gothic Neo) guarantees uniform baseline rendering, clean stroke terminal clarity, and native tabular digit variants (`font-feature-settings: "tnum"`).
- **Tabular Figures & Units**: All monetary and quantitative values must enforce `tnum` to align decimal points and thousands separators (`1,250,000`). Explicit unit markers (`원`, `g`, `ml`, `개`, `%`) must sit directly adjacent to numerical values in a fixed tone (`text-muted`, 11px/13px) to prevent layout shifting across rows.
- **Hierarchy Rules**: 
  - Section titles (`headline-lg`, `headline-md`) preserve a tight footprint to allocate maximum viewport real estate to operational data tables and forms.
  - KPI metric displays (`metric-stat-lg`) balance strong typographic weight with strict vertical lockups alongside delta badges (`+12.4%`).

## Layout & Spacing

The layout employs a high-density, 12-column responsive grid engineered for multi-column dashboards on desktop, 8-column arrangements on tablet counter terminals, and single-column stacked views on mobile smartphones:

- **Rhythm & Scale**: Built on a strict 4px/8px modular scale. Dashboard sections maintain a 16px (`gutter`) separation. Table rows and compact form entries utilize condensed `space-sm` (8px) and `space-xs` (4px) inner paddings to preserve vertical sightlines without scrolling.
- **Breakpoints**:
  - **Desktop (≥ 1280px)**: 12-column fluid grid, 24px canvas margins, persistent left navigation (240px fixed width), 4-column summary KPI rows.
  - **Tablet POS (768px - 1279px)**: 8-column layout, 16px canvas margins, collapsible icon-rail navigation (64px), 2-column or 3-column split metric cards. Form modals open as 80% screen sheets with expanded tap targets (minimum 44px height).
  - **Mobile (≤ 767px)**: Full-width fluid container, 12px outer canvas margin, bottom-anchored navigation bar, sticky primary action triggers, and single-card stacking for table rows with expandable details.

## Elevation & Depth

To preserve speed and prevent visual clutter on glare-heavy counter screens, elevation is achieved via **low-contrast outlines paired with restrained ambient drop shadows**:

- **Level 0 (Canvas Surface)**: `#F8FAFC` base background without borders or shadows.
- **Level 1 (Cards & Data Tables)**: `#FFFFFF` surface enclosed by a 1px solid `#E2E8F0` border. Shadow is extremely subtle: `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)`.
- **Level 2 (Dropdowns, Popovers & Filter Pickers)**: `#FFFFFF` surface with 1px solid `#CBD5E1` border and a crisp directional shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Quick Entry Modals & Alert Sheets)**: Centered or bottom-anchored dialogs sitting above a 40% `#0F172A` backdrop blur overlay, with a focused elevation: `0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08)`.

## Shapes

The design system embraces a **Soft (Level 1)** geometric silhouette:

- Standard input controls, table row hover containers, and buttons feature `4px` (`rounded-sm`) radius, maintaining an orderly, dense ERP grid aesthetic.
- Cards, modal containers, and elevated panels utilize `8px` (`rounded-lg`) radius.
- Status badges and contextual indicators use `4px` soft corners, except for operational phase pills (`확정`, `미마감`) which use fully rounded pill profiles (`9999px`) to immediately distinguish system classification states from actionable button controls.

## Components

### 1. KPI Summary Cards
- Constructed with `#FFFFFF` background and 1px `#E2E8F0` border.
- Card header contains label (`label-sm`, `#64748B`) and contextual filter badge (e.g., `전일 대비`, `목표 달성률`).
- Metric value (`metric-stat-lg`, `#0F172A`) paired with inline unit notation (`tabular-numeric`).
- Trend indicators display a colored pill: Emerald (`#ECFDF5` bg, `#059669` text) for revenue gains; Red (`#FEF2F2` bg, `#DC2626` text) for expense increases.

### 2. Tabular Data Grids
- **Header**: `#F1F5F9` background, 32px height, uppercase `label-sm` text (`#475569`).
- **Cells**: 40px row height for standard view, 32px for compact mode. Numbers right-aligned with fixed comma notation and right-appended units (`원`, `g`, `개`).
- **Row States**: Alternating background support with `#F8FAFC` on hover. Selected items highlight in `#EFF6FF` with a 2px left slate border accent.

### 3. Action Buttons
- **Primary Action (저장, 마감, 입력)**: `#1E293B` background, `#FFFFFF` text, 36px height (desktop) / 44px (tablet touch mode), hover state `#0F172A`.
- **Secondary Action (임시저장, 취소)**: `#FFFFFF` background, 1px `#CBD5E1` border, `#334155` text, hover `#F8FAFC`.
- **Accent Action (신규 등록, 빠른 판매)**: `#92400E` background, `#FFFFFF` text, active click `#78350F`.

### 4. Status Badges & Accounting Tags
- **Accounting Phase Tag**:
  - `확정 실적 (Actual)`: `#0F172A` fill with `#FFFFFF` text. Indicates completed, immutable reconciliations.
  - `예상/미마감 (Projected/Open)`: `#FEF3C7` fill with `#92400E` text and 1px border `#F59E0B`. Indicates ongoing shifts or estimates.
- **Fulfillment Tag**:
  - `매장 (Dine-in)`: `#F3E8FF` bg, `#6B21A8` text.
  - `포장 (Takeout)`: `#EFF6FF` bg, `#1D4ED8` text.
- **Stock Alert**:
  - `재고 부족`: `#FEF2F2` bg, `#DC2626` text, pulsing red dot icon.

### 5. Form Inputs & Quick Record Modals
- **Numeric Fields**: Right-aligned text input with permanent suffix indicator badge (`원`, `g`, `ml`). Focused state uses `#1E293B` border with a 1px slate ring.
- **Quick Recording Dialogs (`판매 입력`, `비용 입력`, `재고 입고`)**: Fixed max-width (520px) desktop modals or bottom-slide sheets on tablet/mobile with bold numeric keypads, instant subtotal calculation bars, and single-tap submit triggers.