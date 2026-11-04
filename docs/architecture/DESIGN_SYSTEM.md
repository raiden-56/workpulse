# WorkPulse – Design System

An original, calm, enterprise identity: deep charcoal, warm off-white, muted forest green,
warm amber and muted red. No purple/blue gradients.

## Tokens

Defined once in `workpulse-web/src/styles/_tokens.scss` (CSS custom properties) and mirrored
in the MUI theme (`src/styles/theme.ts`).

### Colour – light

| Token | Value | Use |
|---|---|---|
| `--wp-bg` | `#F6F6F2` | Page background |
| `--wp-surface` | `#FFFFFF` | Cards, tables, dialogs |
| `--wp-surface-muted` | `#EFF0EB` | Table headers, inset panels |
| `--wp-text` | `#252A27` | Primary text |
| `--wp-text-muted` | `#747C75` | Secondary text |
| `--wp-border` | `#E4E7E1` | Borders, dividers |
| `--wp-primary` | `#547B62` | Primary accent, buttons, active nav |
| `--wp-primary-hover` | `#476A54` | |
| `--wp-primary-soft` | `#E6EEE8` | Selected rows, chips |
| `--wp-positive` | `#4E8866` | Active / healthy |
| `--wp-warning` | `#C18B43` | Idle / degraded |
| `--wp-critical` | `#B75E56` | Offline / anomaly |
| `--wp-info` | `#5B7A8C` | Meeting / informational (slate) |
| `--wp-nav` | `#252B27` | Dark sidebar |
| `--wp-nav-text` | `#D9DED8` | |

### Colour – dark

| Token | Value |
|---|---|
| `--wp-bg` | `#1A1D1B` |
| `--wp-surface` | `#232724` |
| `--wp-surface-muted` | `#2B302C` |
| `--wp-text` | `#ECEEEA` |
| `--wp-text-muted` | `#9AA39C` |
| `--wp-border` | `#343A35` |
| `--wp-primary` | `#7AA98A` |
| `--wp-primary-soft` | `#2D3A31` |
| `--wp-nav` | `#141715` |

### Status colours (shared by charts, chips, timeline)

| Status | Colour |
|---|---|
| ACTIVE_APPLICATION | `--wp-positive` |
| FOCUS_SESSION | `#3F7A5A` (deeper green) |
| MEETING | `--wp-info` |
| IDLE | `--wp-warning` |
| BREAK | `#A89A6B` (sand) |
| LOCKED | `#8A8F8B` (slate grey) |
| OFFLINE | `--wp-critical` |
| UNKNOWN | `#B8BDB9` |

### Typography

* Font: `Inter` (variable) for UI, `JetBrains Mono` for identifiers and code.
* Scale: 12 / 13 / 14 (body) / 16 / 18 / 22 / 28 / 36 px. Line-height 1.5 body, 1.25 headings.
* Numbers in KPI tiles use `font-variant-numeric: tabular-nums`.

### Spacing, radius, elevation

* 4-pt grid: 4 · 8 · 12 · 16 · 24 · 32 · 48.
* Radius: 6 px controls, 10 px cards, 14 px dialogs, 999 px pills.
* Elevation: borders first; shadows only for popovers/dialogs
  (`0 8px 24px rgba(37,42,39,.12)`).

### Motion (Framer Motion)

| Element | Animation | Duration |
|---|---|---|
| Page transition | fade + 8 px rise | 180 ms |
| Sidebar collapse | width spring | 220 ms |
| Dashboard cards | staggered fade-up (40 ms stagger) | 160 ms |
| Dialog | scale 0.98 → 1 + fade | 150 ms |
| Dropdown | fade + 4 px drop | 120 ms |
| Table row hover | background colour only | 100 ms |

All animations are disabled when `prefers-reduced-motion: reduce` (`useReducedMotion`).

### Breakpoints

`xs 0` · `sm 600` · `md 900` · `lg 1200` · `xl 1536`. Management pages are designed
desktop-first; the employee self-service pages are verified at 360 px wide.

## Layout

* **AppShell**: collapsible dark sidebar (240 px / 72 px), top bar (global search,
  notification centre, theme toggle, profile menu), breadcrumb row, content area max 1600 px.
* **AuthLayout**: split screen, product narrative on the left, form on the right; stacks on mobile.
* **GuestLayout**: AppShell plus a persistent `DEMO` badge in the header and a diagonal
  watermark over the content for public guests.

## Components (`src/components`)

`common/` PageHeader · StatCard · StatusChip · EmptyState · ErrorState · LoadingSkeleton ·
ConfirmDialog · PermissionGate · DemoBadge · ThemeToggle
`charts/` TrendLineChart · StackedBarChart · DonutChart · ActivityTimeline
`tables/` DataTable (sorting, pagination, column visibility, row actions)
`filters/` DateRangePicker · DepartmentTeamFilter · SearchField · FilterPanel
`dialogs/` FormDialog
`layouts/` AppShell · AuthLayout · GuestLayout · Sidebar · TopBar · Breadcrumbs

## Accessibility

* 4.5:1 contrast for text; status never conveyed by colour alone (icon + label).
* Focus rings use `--wp-primary` 2 px outline.
* Tables have captions; charts have `aria-label` summaries and a data-table toggle.
