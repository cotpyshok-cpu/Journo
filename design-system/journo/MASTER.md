# Journo — Master Design System (`MASTER.md`)

> Source of truth for all Journo screens (`S01`–`S22`) and flows (`F0`–`F9`).

## 1. Visual Direction
- **Style:** Warm Editorial Utility + Flat Spatial Clarity (zero clutter, high figure-ground contrast, crisp warm hairline borders instead of heavy drop shadows).
- **Primary Palette:**
  - Light Canvas: `#FAF6EA` (`--bg-cream`)
  - Elevated Surface: `#FFFFFF` (`--bg-surface`)
  - Subtle Surface: `#F2ECE0` (`--bg-muted`)
  - Dark Contrast & Primary Ink: `#163B32` (`--forest-deep`)
  - Terracotta Coral Accent: `#D9623B` (`--terracotta`)
  - Warm Border: `#E5DEC9` (`--border-subtle`)

## 2. Three-Layer Token Hierarchy
1. **Primitive:** Raw brand hex & spacing constants (`--journo-cream-50`, `--journo-forest-900`, `--journo-terracotta-500`).
2. **Semantic:** Role aliases (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--accent`, `--border`, `--status-safe`, `--status-warn`, `--status-danger`).
3. **Component:** Scoped variables (`--btn-primary-bg`, `--route-line-color`, `--map-anchor-pin`, `--map-flex-pin`).

## 3. Component Standards
- **Cards:** `bg-white border border-[#E5DEC9] rounded-2xl p-4` (flat elevation with crisp border; hover shifts border to `#D4C9AC`).
- **Dark Hero / Live Next-Step Card:** `bg-[#163B32] text-[#FAF6EA] rounded-2xl p-5` with terracotta `#D9623B` primary action button.
- **Primary CTA:** `bg-[#D9623B] hover:bg-[#C0512D] text-white font-semibold rounded-xl min-h-[44px] px-5 transition-colors duration-150`.
- **Secondary CTA:** `bg-[#F2ECE0] hover:bg-[#E7DFCE] text-[#163B32] font-medium rounded-xl min-h-[44px] px-4`.
- **Numeric Badges:** Always apply `tabular-nums` (`font-variant-numeric: tabular-nums`).
- **Route Polyline:** Dashed terracotta `#D9623B` path (`dashArray: "8, 8"`) with directional arrows and numbered stop badges (`#163B32` for Hard Anchors, `#D9623B` for Flexible Errands).

## 4. Responsive Layout Rules
- **Mobile (`375px`–`767px`):** Single-column flow, sticky bottom navigation (`<= 5` tabs + global `+` Quick Add FAB), collapsible map drawer/card above the Live Step card.
- **Desktop (`>= 1024px`):** Split-pane workspace in `/app` — left task/timeline panel + right interactive Leaflet route map, topped by the compact Jury / Dev control bar.
- **Motion:** Respect `prefers-reduced-motion: reduce`; keep state transitions crisp (`150ms–200ms ease-out`).
