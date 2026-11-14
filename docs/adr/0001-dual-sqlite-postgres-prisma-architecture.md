# ADR-0001: Dual SQLite & PostgreSQL Persistence via Prisma

**Date**: 2026-11-14  
**Status**: accepted  
**Deciders**: Journo Engineering Team

## Context

Journo must satisfy two deployment environments simultaneously: (1) immediate local evaluation by international jury members right after `git clone` with zero Docker or database setup, and (2) production deployment on a managed cloud host backed by PostgreSQL via `DATABASE_URL`.

## Decision

We use Prisma ORM with string-backed domain enumerations validated by Zod schemas, maintaining identical SQLite (`prisma/schema.prisma`) and PostgreSQL (`prisma/schema.postgres.prisma`) schemas plus an automated bootstrap script (`scripts/setup-db.mjs`) and runtime `ensureSeeded()` guard.

## Alternatives Considered

### Alternative 1: Browser `localStorage` Only
- **Pros**: Zero backend setup.
- **Cons**: Cannot support real Google OAuth token persistence, server-side TSPTW plan versioning, or multi-device production sync.
- **Why not**: Fails end-to-end production requirement.

### Alternative 2: Docker Compose PostgreSQL Only
- **Pros**: Single database engine everywhere.
- **Cons**: Requires Docker running locally for every jury reviewer.
- **Why not**: Adds friction for `git clone` evaluation.

## Consequences

### Positive
- `npm install && npm run dev` works out of the box with auto-created and auto-seeded Astana demo data in `prisma/dev.db`.
- Switching to production PostgreSQL requires only setting `DATABASE_URL="postgresql://..."`.

### Negative
- Both schema files must stay synchronized when modifying columns or indexes.

### Risks
- SQLite single-writer lock under heavy concurrent writes: mitigated by Prisma singleton pooling and lightweight per-user transactions.
