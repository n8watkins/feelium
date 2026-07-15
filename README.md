# feelium

A mobile-first Progressive Web App for connecting what you do with how you feel.
All brand-facing identity lives behind a single config module - see [Branding](#branding-single-config-point).

This repository implements the **full MVP** per `docs/PRD.md` - all seven phases (foundation, tracking setup, daily tracking, history, analytics, PWA/notifications, and privacy/release polish) are shipped.
It is **deployed and live** at [feelium-sandy.vercel.app](https://feelium-sandy.vercel.app); pushes to `main` auto-deploy via Vercel's Git integration.
Local development runs entirely offline against a plain SQLite file; production runs on Vercel with a cloud Turso database.

> **Sign-in is currently GitHub OAuth only.** The email magic-link and email/password providers are built and preserved but temporarily disabled (see [Signing in](#signing-in), [`src/auth.ts`](src/auth.ts), and [`docs/DEVIATIONS.md`](docs/DEVIATIONS.md) ADR-002).

> The stack deviates from the PRD's Supabase/Postgres/RLS recommendation. See [`docs/DEVIATIONS.md`](docs/DEVIATIONS.md) for the decision record.

> New to the codebase? Start with [`docs/HANDOFF.md`](docs/HANDOFF.md) for a zero-context tour of what is built, how it is architected, and what to improve next.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** + **shadcn/ui** (Radix primitives, Lucide icons)
- **next-themes** for light / dark / system theming
- **Turso libSQL** (SQLite-compatible) with **Drizzle ORM** - local dev uses a plain SQLite file
- **Auth.js / NextAuth v5** with the Drizzle adapter (currently GitHub OAuth; magic link + password preserved but disabled)
- **App-layer authorization**: all DB access is server-side and scoped to the session user
- Deployed on **Vercel** (Git-connected auto-deploy) with a cloud **Turso** database

## Prerequisites

- **Node.js 20.9+** (Node 24 is used here). That is all - there is no Docker or database server to run.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local environment file and generate an auth secret:

   ```bash
   cp .env.local.example .env.local
   npx auth secret   # prints an AUTH_SECRET; paste it into .env.local
   ```

   `.env.local` needs a `DATABASE_URL` (the local SQLite file, already set to `file:./.data/local.db`) and an `AUTH_SECRET`.
   Because sign-in is currently GitHub-only, you also need `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` from a GitHub OAuth app (callback URL `http://localhost:3000/api/auth/callback/github`) to actually log in - see [Signing in](#signing-in).
   There are no other cloud URLs or real secrets required for local dev.

3. Create and migrate the local database:

   ```bash
   npm run db:migrate
   ```

   This applies every migration in `drizzle/` to the local SQLite file at `.data/local.db`.

4. Start the app:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).
   You will be redirected to `/login`.

### Signing in

**Sign-in is currently GitHub OAuth only.** On `/login` there is a single **Continue with GitHub** button.

1. Create a GitHub OAuth app (<https://github.com/settings/developers>) with the callback URL `http://localhost:3000/api/auth/callback/github`, and put its client id/secret in `.env.local` as `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`.
2. Click **Continue with GitHub** and authorize.
3. The session is created and you land on `/today`.
   A profile row (with timezone and start of week) is created automatically on first sign-in.

> **Why GitHub-only?** Production only has the GitHub callback wired up, and Resend on the current plan can only email the account owner, so the magic-link flow was broken for everyone else. The email magic-link and email/password providers are fully built and **reversible** - the server actions remain in `src/app/login/actions.ts` and the providers are commented in `src/auth.ts` with a re-enable note. See [`docs/DEVIATIONS.md`](docs/DEVIATIONS.md) ADR-002.

## Scripts

| Script               | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Start the Next.js dev server                        |
| `npm run build`      | Production build                                    |
| `npm run typecheck`  | TypeScript type checking (`tsc --noEmit`)           |
| `npm run lint`       | ESLint                                              |
| `npm test`           | Run the fast unit-test suite                         |
| `npm run db:generate`| Generate SQL migrations from the Drizzle schema     |
| `npm run db:migrate` | Apply migrations to the local SQLite file           |
| `npm run db:seed`    | Seed local demo tracking data (see note below)      |
| `npm run db:studio`  | Open Drizzle Studio to browse the local database    |
| `npm run db:reset`   | Delete and recreate the local database from migrations |
| `npm run test:data-operations` | Verify atomic profile and reminder operations |
| `npm run test:categories` | Verify behavior-category ownership, ordering, and deletion |
| `npm run test:migrations` | Verify fresh migrations and legacy-data upgrades |
| `npm run test:persistence` | Integration test for Turso-safe check-in writes (`db.batch`) |
| `npm run test:persistence:local` | Start disposable Turso HTTP and run persistence integration |

GitHub Actions runs install, lint, type checking, unit tests, atomic data-operation tests, fresh and upgrade migrations, real Turso HTTP persistence, and the production build for every pull request and push to `main`.
The lower-level `test:persistence` command still accepts `TEST_LIBSQL_URL` when you want to exercise a separately managed disposable libSQL or Turso database.

> `npm run db:seed` populates demo behaviors, outcomes, and historical check-ins for local exploration. It also creates a `demo@example.com` password account, but that password login no longer works because the credentials provider is disabled (GitHub-only). The seeded tracking data is still useful for exercising History and Insights locally.

## Deployment (Vercel + Turso)

The app is **deployed and live** at [feelium-sandy.vercel.app](https://feelium-sandy.vercel.app), running on Vercel with a cloud [Turso](https://turso.tech) libSQL database.
Deploys are **Git-connected**: pushing to the `main` branch of the GitHub repo triggers an automatic Vercel build and deploy.
Local development is unchanged (a plain SQLite file).

Nothing in this repository provisions cloud resources - provisioning (the Turso database, the Vercel project, and the GitHub OAuth app) is done separately.
Production has no seeded/demo data; accounts are created by fresh GitHub sign-ins.

### Runtime and database

- The libSQL client (`src/db/index.ts`) uses the cloud Turso database when `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set, and the local `DATABASE_URL` file otherwise.
- `@libsql/client` talks to Turso over HTTP, so it runs in Vercel's default Node.js serverless runtime with no extra configuration.
- Auth.js runs with `trustHost: true` for Vercel's proxy; it derives its base URL from `AUTH_URL` and, because that is `https` in production, automatically issues secure, host-prefixed session cookies.

### Running migrations against Turso

Migrations are not run during `next build`.
Apply them once against the Turso database (from your machine or CI) whenever the schema changes:

```bash
TURSO_DATABASE_URL=libsql://<db>.turso.io TURSO_AUTH_TOKEN=<token> npm run db:migrate
```

The same migration files in `drizzle/` apply to both local SQLite and cloud Turso.

### OAuth and email in production

- Add the production callback URL `https://<your-domain>/api/auth/callback/github` to the GitHub OAuth app (alongside the local one). This is the only sign-in method currently enabled.
- **Email magic link is currently disabled** and Resend is not required. If you re-enable the email provider (see [`docs/DEVIATIONS.md`](docs/DEVIATIONS.md) ADR-002), Resend requires a **verified sender domain**; set `AUTH_EMAIL_FROM` to an address on that domain. The default (`feelium <onboarding@resend.dev>`) is Resend's shared testing sender and only delivers to the Resend account owner - which is exactly why magic-link was disabled.

### Production environment variables

Set these in the Vercel project (never commit real values).
"Secret" marks values that must be kept confidential.

| Variable             | Required | Secret | Description                                                                                  |
| -------------------- | -------- | ------ | -------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`        | Yes      | Yes    | Session-encryption secret. Generate with `npx auth secret`.                                   |
| `AUTH_URL`           | Yes      | No     | Canonical base URL, e.g. `https://feelium.example.com`. Drives callback URLs and secure cookies. |
| `TURSO_DATABASE_URL` | Yes      | No     | Cloud Turso database URL (`libsql://…`). Takes precedence over `DATABASE_URL`.                 |
| `TURSO_AUTH_TOKEN`   | Yes      | Yes    | Turso database auth token.                                                                     |
| `AUTH_GITHUB_ID`     | Yes      | No     | GitHub OAuth app client ID (public). Required - GitHub is the only sign-in method.             |
| `AUTH_GITHUB_SECRET` | Yes      | Yes    | GitHub OAuth app client secret.                                                               |
| `AUTH_RESEND_KEY`    | No       | Yes    | Resend API key for magic-link emails. Not needed while magic-link is disabled.                |
| `AUTH_EMAIL_FROM`    | No       | No     | From address for magic-link emails (verified Resend domain). Only relevant if magic-link is re-enabled. Defaults to `feelium <onboarding@resend.dev>`. |

`DATABASE_URL` is not used in production when the `TURSO_*` variables are set.
Web Push notifications additionally need `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and `CRON_SECRET` - see [`docs/notifications-and-pwa.md`](docs/notifications-and-pwa.md).

## Project structure

```
src/
  app/
    (app)/                # Authenticated app shell (bottom nav + sidebar)
      today/ history/ insights/ settings/
    api/                  # Route handlers: auth, account export/signout, notifications/send
    login/                # Sign-in (GitHub OAuth; magic-link/password UI disabled)
    onboarding/           # First-run starter behaviors/outcomes
    layout.tsx            # Root layout: theme provider, fonts, metadata
    manifest.ts           # PWA manifest (reads from branding config)
  auth.ts                 # Auth.js config (adapter, providers, callbacks)
  auth.config.ts          # Edge-safe auth config used by the proxy
  proxy.ts                # Route guard (Next 16 middleware)
  components/             # App shell + shadcn/ui components
  config/branding.ts      # Single source of truth for brand identity
  db/
    index.ts              # libSQL client + Drizzle instance
    schema/               # Drizzle schema (auth + app tables)
    migrate.ts            # Standalone migration runner
    seed.ts               # Local demo-data seed (npm run db:seed)
  server/
    data/                 # Central session-scoped data-access module (import from "@/server/data")
    push/                 # Web Push transport
  lib/                    # Nav config, redirect guard, utils
drizzle/                  # Generated SQL migrations (committed)
tests/                    # Unit, migration-upgrade, and Turso HTTP persistence tests
```

## Branding (single config point)

All user-facing brand identity - product name, PWA manifest fields, icon references, and key copy - lives in **`src/config/branding.ts`**.
The npm package identity is owned separately by `package.json` and propagated to the generated lockfile.
To rebrand the product, edit the branding config; rename the package only when its package-manager identity should also change.

## Database and authorization

The schema is defined in TypeScript with Drizzle (`src/db/schema`) and generated to SQL migrations under `drizzle/`.
It follows PRD section 22, mapped to SQLite.

- **App-layer authorization (no RLS).**
  All data access goes through the `src/server/data/` module (import from `"@/server/data"`), which scopes every query by the authenticated session user id (`auth()`), never by a client-supplied id.
  Data access is server-side only, so a user can only ever read or write their own records.
- **Unknown is never zero.**
  Boolean and numeric value columns are nullable and never default to `0`, so an explicit `0`/`No` stays distinct from "not recorded".
- Unique constraints enforce one behavior entry per behavior per day and one value per outcome metric per check-in.
- Behavior categories are normalized user-owned rows with a stable color palette, explicit ordering, and optional behavior assignments.
- Each user can own any number of daily reminder rows, with duplicate local times rejected and delivery attempts tracked per reminder occurrence and device.
- Every user-owned table keeps a `user_id`, so multi-user stays possible even though the product is single-user-first.
