# Journo Security Audit & Hardening Report

**Scope:** `C:\Study\Hackdasha` — Next.js App Router API routes, Google OAuth 2.0 + `calendar.readonly`, Apple `.ics` parser, Leaflet map DOM sinks, Prisma data access, HTTP security headers, and Stripe/billing controls.  
**Audit Date:** 2026-11-14

## Executive Summary

A systematic security audit was conducted covering OWASP API Security Top 10 (2023), OAuth 2.0 / OIDC hardening, Broken Object Level Authorization (BOLA), Broken Access Control, XSS, CORS misconfiguration, Sensitive Data Exposure, Open Redirects, and secret hygiene.

Zero critical secrets or unvalidated SQL queries were found (`prisma.$queryRawUnsafe` / `$executeRawUnsafe` and `dangerouslySetInnerHTML` are absent across `src/`). During the audit, three hardening improvements were applied directly in code before verification:

1. **Eliminated HTML String Sinks in Leaflet Popups (`src/components/map/JournoMap.tsx`):** Replaced template-interpolated HTML strings passed to `marker.bindPopup(...)` with programmatic DOM elements built via `document.createElement` and `textContent` (`createSafePopupElement`), preventing Stored XSS from imported Google/Apple `.ics` event titles or addresses.
2. **Quota & Session Guard on Places Search (`src/app/api/places/search/route.ts`):** Added `await getActiveUser()` verification and bounded search input (`trim().slice(0, 120)`) before querying local presets or external Google Places APIs.
3. **Aligned OAuth Callback Query Handling (`src/components/app/JournoApp.tsx`):** Handled `?oauth=connected`, `?oauth=unconfigured`, `?oauth=invalid_state`, and `?oauth=denied` cleanly in UI notifications.

---

## Domain Control Verification Matrix

| Security Domain | Controls Verified | Status |
|---|---|---|
| **OAuth 2.0 & PKCE** | Cryptographic 24-byte `state` checked with `crypto.timingSafeEqual` (`src/lib/oauth-security.ts`), 32-byte `S256` PKCE verifier (`code_challenge_method=S256`), short-lived `HttpOnly` + `SameSite=Lax` cookies (`maxAge: 600`), strict minimal Google Calendar scope (`calendar.readonly`). | Verified |
| **Open Redirect Prevention** | `sanitizeRedirectPath()` rejects `//evil.com`, explicit URL schemes (`:`), backslashes (`\`), and `@` authority confusion, allowing only `/` or `/app/*`. Covered by unit tests (`tests/parsers-and-security.test.ts`). | Verified |
| **BOLA / IDOR (OWASP API1)** | Every single-record read/update/delete across `tasks`, `series`, `calendars`, and `route/solve` first queries with `{ id, userId: user.id }` (`findFirst` / `updateMany` / `deleteMany`) before acting, returning `404` for unowned IDs. | Verified |
| **Session & Access Control (API2 / A01)** | Session cookie (`journo_uid`) issued as `HttpOnly`, `SameSite=Lax`, `Secure` in production. Account deletion (`DELETE /api/user`) requires explicit `{ confirm: "DELETE" }` and clears session cookie. Pro-gated sync endpoints (`google/sync`, `ics`) check `user.tier` server-side (`ForbiddenError 403`). | Verified |
| **Sensitive Data Exposure (API3)** | DTO mappers (`toSafeUserDto`, `toSafeCalendarConnectionDto` in `src/lib/dto.ts`) explicitly whitelist safe fields and strip OAuth `accessToken` and `refreshToken` from all client responses and JSON exports. API error handler (`handleApiError`) suppresses stack traces in HTTP JSON. | Verified |
| **Input Validation & Injection** | All API route inputs parsed with strict `zod` schemas (bounds on coordinates, times, string lengths, enums). `.ics` parser strips HTML/control chars via `sanitizeText()`. All DB access uses parameterized Prisma queries. | Verified |
| **XSS & Security Headers** | Security headers configured in `next.config.mjs`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(self)`. Leaflet popups use pure `textContent` DOM nodes. | Verified |
| **CORS Policy** | No permissive `Access-Control-Allow-Origin: *` or arbitrary `Origin` reflection with credentials exists; API routes operate under Next.js same-origin defaults. | Verified |
| **Secret Hygiene** | No hardcoded API keys or client secrets in `src/`. `.env` is excluded via `.gitignore`; `.env.example` contains empty placeholders only. Map & OAuth upstream calls remain server-side only (zero `NEXT_PUBLIC_*` secret keys). | Verified |
| **Service Worker (`/sw.js`)** | Serves with `Cache-Control: no-cache, no-store, must-revalidate` and explicitly bypasses caching for all `/api/*` paths so user PII and tokens are never stored in browser `CacheStorage`. | Verified |
