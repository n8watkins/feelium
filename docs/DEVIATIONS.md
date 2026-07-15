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

> **Note (post-MVP):** The central data-access module referenced above as `src/server/data.ts` has since been split into a directory, `src/server/data/` (one file per area, re-exported from `index.ts`). UI code still imports it from the single entry point `"@/server/data"`. The authorization guarantee is unchanged.

## ADR-002: Sign-in temporarily reduced to GitHub OAuth only

**Date:** 2026-07-10
**Status:** Accepted (temporary; reversible)
**Decision by:** General (fleet), post-deploy.
**Supersedes (in part):** ADR-001's "Email magic link is the default sign-in" for the deployed configuration.

### Context

ADR-001 established Auth.js with three sign-in paths: email magic link (default), optional email + password, and GitHub OAuth.
After deploying to Vercel ([feelium-sandy.vercel.app](https://feelium-sandy.vercel.app)), the magic-link path proved unusable in production: Resend on the current plan can only deliver email to the Resend account owner, so magic links never reach anyone else.
The GitHub OAuth callback is the only auth path fully wired up in production.

### Decision

**GitHub OAuth is the sole enabled sign-in provider**, in both production and local development.
The email magic-link and email/password providers are **disabled but preserved and reversible**:

- `src/auth.ts` keeps the magic-link (`emailProvider`) and `Credentials` provider definitions commented out, with a re-enable note at the top of the file.
- The server actions (`sendMagicLink`, `signInWithPassword`, `signUpWithPassword`) remain intact in `src/app/login/actions.ts`.
- `src/app/login/page.tsx` shows only the "Continue with GitHub" button; the email/password + magic-link UI was removed but is documented as the only thing to restore.

### Consequences

- **Local development now requires GitHub OAuth credentials** (`AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`) to sign in at all; the "magic link printed to the console" convenience is unavailable while the provider is disabled.
- The seed script (`npm run db:seed`) still creates a `demo@example.com` password account, but that login no longer works because the credentials provider is off. The seeded tracking data remains useful for local History/Insights.
- `AUTH_RESEND_KEY` / `AUTH_EMAIL_FROM` are not required while magic-link is disabled.

### Re-enabling

When a verified Resend sender domain (or an alternative email transport) is available, follow the re-enable note in `src/auth.ts`: uncomment the provider imports and definitions, add them back to the `providers` array, and restore the email/password + magic-link UI in `src/app/login/page.tsx`.
The development provider is a plain Auth.js `EmailConfig` that prints links to the server console, so restoring it does not require Nodemailer or an SMTP dependency.
No server-side rewrite is needed.

## ADR-003: CSP permits style attributes for Sonner runtime geometry

**Date:** 2026-07-14
**Status:** Accepted
**Decision by:** General (fleet), during hardening review.

### Context

Production uses a per-request nonce and `strict-dynamic` for scripts, and does not permit `unsafe-inline` in `script-src`.
Next.js applies the nonce to its framework scripts and generated style elements.
Sonner still requires dynamic style attributes for toast positions, offsets, heights, and swipe gestures, and injects a version-pinned stylesheet at runtime.

### Decision

Production keeps style elements restricted to the request nonce, same-origin stylesheets, and the exact SHA-256 hash of Sonner 2.0.7's injected stylesheet.
Only `style-src-attr` permits `unsafe-inline`, narrowly allowing Sonner's runtime geometry without weakening `script-src` or allowing arbitrary inline style elements.
First-party Insights charts use SVG geometry attributes, and the app's static Sonner theme variables live in `globals.css` instead of React style attributes.

### Consequences

An injection bug that controls an element's `style` attribute could alter presentation, but it cannot authorize scripts or new inline style elements under this policy.
The Sonner stylesheet hash test must be updated deliberately when upgrading Sonner.
Replace `style-src-attr 'unsafe-inline'` if Sonner gains nonce-aware or class-based runtime positioning.

## ADR-004: Behavior categories and multiple daily reminders extend the original MVP

**Date:** 2026-07-15
**Status:** Accepted
**Decision by:** Product owner, after the production MVP.

### Context

The immutable PRD defines one optional daily reminder and does not include behavior categories.
After using the production MVP, the product owner requested color-coded behavior organization, direct editing from Today, and any number of independently managed daily reminder times.
The original PRD remains unchanged as a historical record, while `docs/HANDOFF.md` describes the current product.

### Decision

Behaviors may belong to an ordered, user-owned category with a constrained color palette.
Today groups active behaviors by category, places Uncategorized last, and links directly to behavior editing with a return to Today after saving.
Each user may create any number of daily reminder schedules, with duplicate local times rejected and device subscriptions managed independently from schedules.

### Consequences

- Deleting a category preserves its behaviors and makes them uncategorized.
- Account export and tracking-data deletion include behavior categories and assignments.
- Reminder delivery identity includes the reminder, scheduled occurrence, and device subscription so multiple reminders on one local date remain independent.
- Profile timezone changes and enabled-reminder rescheduling are atomic and guarded against concurrent schedule or preference changes.
- The original PRD references to one daily reminder describe the shipped MVP baseline, not the current product behavior.
