# Graph Report - src  (2026-11-14)

## Corpus Check
- Corpus is ~37,972 words - fits in a single context window. You may not need a graph.

## Summary
- 252 nodes · 927 edges · 12 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Module Cluster 0
- Module Cluster 1
- Module Cluster 2
- Module Cluster 3
- Module Cluster 4
- Module Cluster 5
- Module Cluster 6
- Module Cluster 7
- Module Cluster 8
- Module Cluster 9
- Module Cluster 10
- Module Cluster 11

## God Nodes (most connected - your core abstractions)
1. `handleApiError()` - 41 edges
2. `getActiveUser()` - 40 edges
3. `Button()` - 30 edges
4. `Badge()` - 27 edges
5. `JournoApp()` - 22 edges
6. `TaskItem` - 20 edges
7. `prisma` - 19 edges
8. `UserProfile` - 19 edges
9. `Modal()` - 18 edges
10. `getDateInTimezone()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `syncGoogleEventsForUser()` --calls--> `searchPlacesLocal()`  [EXTRACTED]
  app/api/auth/google/callback/route.ts → lib/astana-places.ts
- `syncGoogleEventsForUser()` --calls--> `sanitizeText()`  [EXTRACTED]
  app/api/auth/google/callback/route.ts → lib/utils.ts
- `GET()` --calls--> `sanitizeText()`  [EXTRACTED]
  app/api/auth/google/callback/route.ts → lib/utils.ts
- `POST()` --calls--> `handleApiError()`  [EXTRACTED]
  app/api/billing/checkout/route.ts → lib/errors.ts
- `POST()` --calls--> `getActiveUser()`  [EXTRACTED]
  app/api/billing/checkout/route.ts → lib/session.ts

## Import Cycles
- None detected.

## Communities (12 total, 0 thin omitted)

### Community 0 - "Module Cluster 0"
Cohesion: 0.13
Nodes (41): AppWorkspacePage(), dynamic, DEMO_STOPS, LandingPage(), CalendarsAndSeriesView(), CalendarsSubTab, CitySwitchModal(), EveningReviewView() (+33 more)

### Community 1 - "Module Cluster 1"
Cohesion: 0.09
Nodes (36): CalendarsAndSeriesViewProps, CitySwitchModalProps, EveningReviewViewProps, BootstrapResponse, JuryControlBarProps, SCREEN_OPTIONS, LiveDayViewProps, MorningPlanViewProps (+28 more)

### Community 2 - "Module Cluster 2"
Cohesion: 0.20
Nodes (17): createEventSchema, DELETE(), POST(), createSeriesSchema, GET(), PATCH(), patchSeriesSchema, POST() (+9 more)

### Community 3 - "Module Cluster 3"
Cohesion: 0.20
Nodes (15): GET(), GET(), ALLOWED_RETURN_PATHS, derivePkceChallenge(), generateOAuthState(), generatePkceVerifier(), sanitizeRedirectPath(), verifyStateConstantTime() (+7 more)

### Community 4 - "Module Cluster 4"
Cohesion: 0.22
Nodes (9): checkoutSchema, POST(), verifySchema, POST(), pushPayloadSchema, subSchema, solveSchema, globalForPrisma (+1 more)

### Community 5 - "Module Cluster 5"
Cohesion: 0.26
Nodes (17): POST(), buildTravelMatrix(), computeCacheCell(), evaluateLegMode(), getCell(), getEffectiveTravelMin(), LegMatrixCell, MatrixPoint (+9 more)

### Community 6 - "Module Cluster 6"
Cohesion: 0.17
Nodes (9): POST(), quickAddSchema, RFC-5545, ParsedIcsEvent, parseIcsContent(), parseIcsDateTime(), ParsedQuickAdd, parseQuickAddText() (+1 more)

### Community 7 - "Module Cluster 7"
Cohesion: 0.23
Nodes (9): POST(), citySwitchSchema, POST(), DELETE(), GET(), PATCH(), updateUserSchema, toSafeUserDto() (+1 more)

### Community 8 - "Module Cluster 8"
Cohesion: 0.35
Nodes (10): syncGoogleEventsForUser(), GET(), POST(), POST(), syncSchema, GET(), POST(), toSafeCalendarConnectionDto() (+2 more)

### Community 9 - "Module Cluster 9"
Cohesion: 0.29
Nodes (5): icsSchema, POST(), AppError, ForbiddenError, UnauthorizedError

### Community 10 - "Module Cluster 10"
Cohesion: 0.28
Nodes (6): dmSans, metadata, plusJakarta, RootLayout(), viewport, ServiceWorkerRegister()

### Community 11 - "Module Cluster 11"
Cohesion: 0.39
Nodes (6): GET(), CITY_PRESETS, CityPreset, parseShareLocationUrl(), PlacePreset, searchPlacesLocal()

## Knowledge Gaps
- **1 isolated node(s):** `RFC-5545`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 59 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `handleApiError()` connect `Module Cluster 2` to `Module Cluster 4`, `Module Cluster 5`, `Module Cluster 6`, `Module Cluster 7`, `Module Cluster 8`, `Module Cluster 9`, `Module Cluster 11`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `RFC-5545` to the rest of the system?**
  _1 weakly-connected nodes found - possible missing edges._
- **Should `Module Cluster 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13005464480874318 - nodes in this community are weakly interconnected._
- **Why does `getDateInTimezone()` connect `Module Cluster 8` to `Module Cluster 0`, `Module Cluster 2`, `Module Cluster 3`, `Module Cluster 6`, `Module Cluster 7`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Should `Module Cluster 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09080841638981174 - nodes in this community are weakly interconnected._
- **Why does `getActiveUser()` connect `Module Cluster 8` to `Module Cluster 2`, `Module Cluster 3`, `Module Cluster 4`, `Module Cluster 5`, `Module Cluster 6`, `Module Cluster 7`, `Module Cluster 9`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._