# Deviations from the PRD

This document records intentional deviations from `docs/PRD.md`, with rationale, so the reasoning is not lost.

## ADR-001: Data and auth stack - Turso libSQL + Drizzle + Auth.js instead of Supabase/Postgres/RLS

**Date:** 2026-07-10
**Status:** Accepted
**Decision by:** General (fleet), during Phase 1 Foundation.

### Context

The PRD (sections 10, 21, 22 and the "Recommended stack" header) recommends Supabase, PostgreSQL, and Postgres Row Level Security (RLS) for data and authentication.
The Phase 1 Foundation was initially built on that stack.

### Decision

For Phase 1 Foundation onward, the project uses:

- **Database:** Turso libSQL (SQLite-compatible) via the libSQL client, with **Drizzle ORM**.
  Local development uses a local SQLite file (`file:./.data/local.db`) - no Docker, no containers.
- **Authentication:** **Auth.js / NextAuth v5** with the Drizzle adapter.
  Email magic link is the default sign-in; optional email and password is supported via a Credentials provider with bcrypt-hashed passwords.
- **Authorization:** **App-layer authorization** instead of Postgres RLS.
  All database access is server-side only and routed through a single central data-access module (`src/server/data.ts`) that scopes every query by the authenticated session user id.

### Rationale

- Local development needs no Docker or cloud account: a plain SQLite file replaces a containerized Postgres, which is faster and simpler on phone-tethered and low-resource machines.
- Turso libSQL keeps a clean path to a hosted database later while staying SQLite-compatible.
- Auth.js keeps sign-in flexible (magic link plus password) and, for local dev, prints the magic-link URL to the server console so no SMTP or email account is required.
- The deployment target simplifies to a standard Vercel deploy with no Docker.

### Privacy preservation (PRD section 21)

Dropping RLS does **not** relax any PRD privacy requirement.
The same guarantee - a user can only ever read or write their own records - is enforced at the application layer:

- Every user-owned table carries a `user_id`.
- All data access goes through `src/server/data.ts`, which derives the user id from the authenticated session (`auth()`), never from client input.
- A client-supplied user id is never trusted.
- Data access is server-side only (Server Components, Server Actions, Route Handlers); the database is never reachable from the browser.

Data remains private by default, with no public profiles or sharing.
Account and data deletion remain achievable via `on delete cascade` foreign keys keyed to the user.

### Consequences

- Postgres enums become text columns with TypeScript unions plus CHECK constraints.
- The Postgres "create profile" trigger is replaced by an app-side `ensureProfile()` call on first authenticated request.
- Booleans and numerics are nullable integers/reals so that "unknown" stays distinct from an explicit No or an explicit 0 (PRD 8.2) - unchanged in spirit from the original design.
- Multi-user remains possible: the schema keeps `user_id` everywhere even though the product is single-user-first.
