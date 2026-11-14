# ADR-0003: Real Google OAuth 2.0 (`calendar.readonly`) & Instant Demo Mode

**Date**: 2026-11-14  
**Status**: accepted  
**Deciders**: Journo Engineering Team

## Context

Jury members visiting the public deployment must be able to authorize via Google and pull real Google Calendar events into their daily plan (`F8`), while evaluators who prefer zero-friction exploration need an immediate pre-seeded Astana workspace from the landing page (`S01`). Microsoft Calendar has been explicitly removed from scope.

## Decision

We implement standard OAuth 2.0 Authorization Code flow with PKCE (`S256`) and cryptographic `state` validation in `/api/auth/google` and `/api/auth/google/callback` alongside a deterministic instant demo session seeded in Astana (`UTC+5`).

## Alternatives Considered

### Alternative 1: Mandatory Login Gate Before `/app`
- **Pros**: Standard SaaS onboarding.
- **Cons**: Blocks jury evaluators who lack OAuth credentials configured locally.
- **Why not**: Directly contradicts the frictionless demo requirement.

## Consequences

### Positive
- Public deployments with `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` sync real user calendars securely.
- Local `git clone` deployments still support full calendar UI testing via `.ics` Apple Calendar import and sandbox Google Calendar event sync.

### Negative
- Requires keeping OAuth state cookies (`httpOnly`, `sameSite: lax`) aligned with the configured `GOOGLE_REDIRECT_URI`.

### Risks
- CSRF or Open Redirect attacks on OAuth callback: mitigated by strict `state` constant-time verification and allowlisted post-login redirect paths.
