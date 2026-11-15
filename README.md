# Journo — Smart Daily Route & Schedule Planner (PWA)

**Tasks + Time Windows + Live Routes = One Effortless Day.**

Journo turns scattered calendar commitments, fixed appointments (**Hard Anchors**), and flexible errands into a realistic, traffic-aware Walk + Transit route timeline with automatic conflict resolution, live day tracking, and real Google OAuth 2.0 + Calendar integration.

---

## 1. Quick Start for Jury & Local Reviewers (Zero Docker)

```bash
git clone <repo-url>
cd Hackdasha
npm install
npm run dev
```

Open **http://localhost:3000** cleanly in your browser:
- No Docker, no external database, and no sign-up keys are required to start.
- `scripts/setup-db.mjs` automatically creates `.env` (from `.env.example`), generates Prisma Client, initializes local SQLite (`prisma/dev.db`), and auto-seeds a complete demo day in **Astana (`Asia/Almaty`, `UTC+5`)** on first load.
- Click **"Try Live Demo (No Sign-Up)"** on the landing page (`S01`) to enter `/app` immediately, or inspect the built-in **Jury / Dev Panel** across the top of `/app`.

---

## 2. Production Environment Variables (`.env`)

Copy `.env.example` to `.env` and populate keys for external live APIs when deploying to production:

| Variable | Purpose | Fallback when omitted |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection URL in production (`postgresql://...`), or `file:./dev.db` locally. `scripts/setup-db.mjs` switches between `prisma/schema.prisma` (SQLite) and `prisma/schema.postgres.prisma` (Postgres) automatically. | Local SQLite `file:./dev.db` auto-created |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Real Google OAuth 2.0 login + `https://www.googleapis.com/auth/calendar.readonly` import. | Jury Sandbox Google Sync (`S18`) + OAuth token paste sync |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY_ID`, `STRIPE_PRICE_YEARLY_ID` | Live Stripe Test Checkout for Journo Pro (`$8/mo`, `$70/yr`). | Interactive Sandbox Checkout (`Pay & Upgrade`, `Webhook Delay`, `Payment Error`) in `S15` |
| `NEXT_PUBLIC_APP_URL` | Canonical deployment origin for OAuth & Stripe return URLs. | Request `origin` fallback |

---

## 3. Architecture & Core Capabilities

- **Stack:** Next.js 15 App Router, TypeScript (`strict`), Tailwind CSS, Prisma ORM (`5.22.0`), Leaflet interactive map, Chart.js 7-day analytics, PWA Service Worker (`public/sw.js`).
- **Routing Engine (`src/lib/routing-engine.ts`):**
  - TSPTW (Traveling Salesman with Time Windows) branch-and-bound solver supporting up to 14 stops in under 1 second.
  - Free open-source routing & geocoding stack: **OSRM → Local Urban Matrix Cache** (plus Photon / Nominatim address autocomplete, zero paid map API keys required).
  - Per-leg Walk vs. Transit comparison with `< 3 min` equal-speed rule (`isEqualSpeed`), `"Fastest"` label, and `"Chosen by you"` manual override + `"Restore fastest"`.
  - Conflict Resolution (`S10`): never drops tasks silently; offers Remove Flexible Stop, Shift Window `+45m`, or Enable Walk + Transit.
- **Calendars (`S18`, `S21`, `S22`):**
  - **Internal Calendar** (always active, Free & Pro).
  - **Google Calendar** (real OAuth 2.0 + PKCE + `calendar.readonly`, All-Day toggle, expired token `NEEDS_RECONNECT` state, Disconnect keeping planned tasks per Rule 14.1).
  - **Apple Calendar (`.ics`)** RFC 5545 parser & upload.
- **Notifications:** Real Service Worker Web Push registration + in-app toast & alert tray fallback.
- **Security Hardening:** Audited against OWASP API Top 10, BOLA, OAuth 2.0 PKCE + constant-time `state`, Open Redirect whitelist, XSS-safe DOM map popups, and CSP/security headers — documented in [`docs/SECURITY_AUDIT.md`](docs/SECURITY_AUDIT.md).

---

## 4. Implemented Screens & Flows (`S01–S22` / `F0–F9`)

| Screen | Name | Route / Trigger |
|---|---|---|
| **S01–S02** | Landing & Sign In Modal | `/` (`Try Live Demo` + `Continue with Google`) |
| **S03–S06** | 4-Step Onboarding (Transport, Home/Work, Calendars, Permissions) | `/app?onboarding=1` or Jury Panel `S03–S06` |
| **S07–S09** | Morning Plan, Draft Drawer, Task Form & Repeat Config, Built Timeline | `/app` (`Plan` tab) & `+ Add Task` |
| **S10** | Impossible Time Window Conflict Resolution | Triggered via `Test Conflict (S10)` or overlapping Hard Anchors |
| **S11** | Live Day Tracker (`MM:SS` timer, `+10m Extend`, Geofence Check-in `E4.1`, Nav Deep Links) | `/app` (`Live Day` tab) |
| **S12–S13** | Quick Add (`Cmd/Ctrl+K`, presets, top-3 detour picks) & Before/After Plan Diff Modal | `Quick Add` button / `⌘K` |
| **S14** | Evening Review (KPIs, Unfinished Triage, Chart.js 7-Day Pro Analytics) | `/app` (`Review` tab) |
| **S15** | Paywall & Stripe / Interactive Sandbox Checkout (`$8/mo` / `$70/yr`) | Jury Panel `S15`, Free 5-task cap, Pro features |
| **S16 & S20** | Settings, Export JSON, Delete Account & System States (Offline / 401 / 500) | `/app` (`Settings` tab) & Jury Panel toggles |
| **S17** | City & Timezone Switch (Astana / Almaty / London / Tokyo, Travel Base, Dual-TZ) | Top header city pill / Jury Panel `S17` |
| **S18, S19, S21, S22** | Connected Calendars (Google / Apple `.ics` / Internal), Color-Coded Grid, Recurring Series & People V2 Reserve | `/app` (`Calendars` tab) |

---

## 5. Verification Commands

```bash
npm run typecheck   # TypeScript strict check
npm run test        # Vitest unit tests (TSPTW solver, conflict resolution, parsers, security)
npm run build       # Production Next.js build
```
