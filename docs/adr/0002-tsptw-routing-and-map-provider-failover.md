# ADR-0002: Server-Side TSPTW Routing & Multi-Provider Failover

**Date**: 2026-11-14  
**Status**: accepted  
**Deciders**: Journo Engineering Team

## Context

Route optimization (Traveling Salesperson Problem with Time Windows, TSPTW) across up to 20 daily tasks must complete under 1 second, compare Walk vs. Transit per leg, detect hard-anchor conflicts without silent dropping (`E6.1`), and survive API key absence or map quota exhaustion (`E6.2`, `E6.4`).

## Decision

We implement a server-side routing engine (`src/lib/routing-engine.ts`) executing a deterministic failover chain `Google Maps → HERE Routing v8 → OSRM Public API → Local Astana Matrix Cache`, paired with a branch-and-bound / feasible insertion TSPTW solver.

## Alternatives Considered

### Alternative 1: Client-Side Google Directions Only
- **Pros**: No server routing code.
- **Cons**: Exposes API keys, fails completely when keys are absent or quota is exhausted, and exceeds free tier rapidly for 2-mode matrices.
- **Why not**: Violates security and quota resilience rules (`E6.2`, `E6.4`).

## Consequences

### Positive
- Works seamlessly offline or without API keys by automatically tagging estimates `"Estimate without live traffic"`.
- Supports partial quota failover (`"Second mode not calculated"`) and user-locked leg overrides (`"Chosen by you"`).

### Negative
- Local cache matrix uses Haversine distance + urban speed/bridge heuristics rather than street-level turn geometry when upstream providers are unavailable.

### Risks
- Upstream API latency spikes: mitigated by strict 3.5s per-request `AbortSignal.timeout` before failing over to the next provider.
