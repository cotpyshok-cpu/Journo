# Journo — Brand Guidelines & Visual Identity

**Product:** Journo (formerly RouteFlow) — Smart Daily Route & Schedule Planner  
**Language:** 100% English (international jury & global release)  
**Default Demo Location:** Astana, Kazakhstan (`UTC+5` / `Asia/Almaty`)

---

## 1. Visual Philosophy & Brand Character
Journo turns scattered tasks, fixed appointments, and live city transit into one calm, navigable day. The interface blends editorial warmth with tactical spatial clarity: warm paper cream surfaces reduce outdoor/commute glare, deep forest green provides high-contrast legibility on the move, and terracotta coral highlights the active route path and primary actions.

### Signature Brand Mark
- **Loop-Arrow Route Path:** A continuous curved path looping forward into a directional arrowhead, representing flexible errands woven seamlessly between fixed anchors.
- **Route Line Motif:** Dashed terracotta coral polyline (`#D9623B`, `stroke-dasharray: 7 5`) terminating in a crisp directional arrow.

---

## 2. Color System

| Role | Token | Hex | Usage |
|---|---|---|---|
| Background Canvas | `--bg-cream` | `#FAF6EA` | Global canvas, warm paper surface |
| Card Surface | `--bg-surface` | `#FFFFFF` | Task cards, modals, plan drawers |
| Muted Surface | `--bg-muted` | `#F2ECE0` | Inputs, secondary badges, map inset frame |
| Primary Ink & Dark Surface | `--forest-deep` | `#163B32` | Primary headings, body ink, dark contrast cards, active navigation shell |
| Secondary Dark Surface | `--forest-muted` | `#245246` | Elevated controls inside dark contrast cards |
| Primary Accent & Route Line | `--terracotta` | `#D9623B` | Primary CTAs, dashed route line + arrows, active highlights |
| Accent Hover | `--terracotta-hover` | `#C0512D` | Hover/pressed state for primary buttons |
| Accent Tint | `--terracotta-soft` | `#FBECE7` | Soft callout fills, active badges |
| Subtle Border | `--border-subtle` | `#E5DEC9` | Hairline warm borders between cards |
| Safe / On Track | `--status-safe` | `#1E7A56` | Positive buffer, on-track indicator |
| Tight / Warning | `--status-warn` | `#D97706` | Tight buffer (< 8 min), traffic caution |
| Conflict / Risk | `--status-danger` | `#C93B2B` | Hard anchor collision, delay alert, offline critical |

### Strict Anti-Slop Guardrails
- **Zero purple/indigo AI gradients** or neon glows.
- **Zero emoji characters** as UI icons — use SVG icons exclusively (`lucide-react` / `better-icons`).
- **Never use raw hex values** directly in UI components when a semantic CSS variable or Tailwind token applies.

---

## 3. Typography & Numeric Precision
- **Display / Headings:** Geometric grotesque (`Plus Jakarta Sans`, `Space Grotesk`, system geometric sans fallback). Tight tracking (`-0.02em`), confident weights (`600`, `700`).
- **Body / Controls:** `DM Sans` / `Inter` / system sans. Base size `16px`, comfortable `1.5` line height.
- **Tabular Numbers (`tabular-nums`):** MANDATORY on all departure times (`09:15`), ETAs (`10:04`), timers (`14:28`), buffers (`+18 min`), distances (`3.4 km`), task limit counters (`3 / 5`), and pricing (`$8/mo`).

---

## 4. Spatial Geometry & Ergonomics (Mobile-First PWA)
- **Concentric Border Radii:** Outer containers use `rounded-2xl` (`16px`) with `16px` (`p-4`) padding and inner cards/controls use `rounded-xl` (`12px`) or `rounded-lg` (`8px`).
- **Touch Targets:** Minimum `44px × 44px` (`min-h-[44px]`) on every interactive button, chip, toggle, and list action so Live Day controls work one-handed while walking or commuting.
- **Contrast:** Minimum `4.5:1` contrast ratio for all text (`#163B32` on `#FAF6EA` exceeds `11:1`; `#FFFFFF` on `#163B32` exceeds `12:1`).
