# Personal Behavior & Feeling Tracker

A mobile-first Progressive Web App for connecting what you do with how you feel.
The product name is a placeholder ("Untitled") for now and lives behind a single config module - see [Branding](#branding-single-config-point).

This repository currently contains the **Phase 1 Foundation** (per `docs/PRD.md`): the Next.js app shell, authentication, the full database schema, app-layer authorization, and the base design system.
It runs entirely locally - no Docker, no cloud services, and no external accounts.

> The stack deviates from the PRD's Supabase/Postgres/RLS recommendation. See [`docs/DEVIATIONS.md`](docs/DEVIATIONS.md) for the decision record.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** + **shadcn/ui** (Radix primitives, Lucide icons)
- **next-themes** for light / dark / system theming
- **Turso libSQL** (SQLite-compatible) with **Drizzle ORM** - local dev uses a plain SQLite file
- **Auth.js / NextAuth v5** with the Drizzle adapter (magic link + optional password)
- **App-layer authorization**: all DB access is server-side and scoped to the session user

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
   There are no cloud URLs or real secrets.

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

### Signing in locally

Email magic link is the default sign-in.
In local development there is no email server - the sign-in link is **printed to the server console** (the terminal running `npm run dev`).

1. Enter any email on `/login` and choose **Email me a magic link**.
2. Copy the URL printed in the `npm run dev` terminal (look for `Magic sign-in link for ...`) and open it in the browser.
3. The session is created and you land on `/today`.
   A profile row (with timezone and start of week) is created automatically on first sign-in.

Optional email + password sign-in and sign-up are also available on the same screen; passwords are bcrypt-hashed in the database.

## Scripts

| Script               | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Start the Next.js dev server                        |
| `npm run build`      | Production build                                    |
| `npm run typecheck`  | TypeScript type checking (`tsc --noEmit`)           |
| `npm run lint`       | ESLint                                              |
| `npm run db:generate`| Generate SQL migrations from the Drizzle schema     |
| `npm run db:migrate` | Apply migrations to the local SQLite file           |
| `npm run db:studio`  | Open Drizzle Studio to browse the local database    |
| `npm run db:reset`   | Delete and recreate the local database from migrations |

## Project structure

```
src/
  app/
    (app)/                # Authenticated app shell (bottom nav + sidebar)
      today/ history/ insights/ settings/
    api/auth/[...nextauth]/  # Auth.js route handlers
    login/                # Sign-in (magic link default + optional password)
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
  server/data.ts          # Central session-scoped data-access module
  lib/                    # Nav config, redirect guard, utils
drizzle/                  # Generated SQL migrations (committed)
```

## Branding (single config point)

All brand-facing identity - product name, PWA manifest fields, icon references, and key copy - lives in **`src/config/branding.ts`**.
Nothing else hardcodes the product name.
To rebrand, edit that one file.

## Database and authorization

The schema is defined in TypeScript with Drizzle (`src/db/schema`) and generated to SQL migrations under `drizzle/`.
It follows PRD section 22, mapped to SQLite.

- **App-layer authorization (no RLS).**
  All data access goes through `src/server/data.ts`, which scopes every query by the authenticated session user id (`auth()`), never by a client-supplied id.
  Data access is server-side only, so a user can only ever read or write their own records.
- **Unknown is never zero.**
  Boolean and numeric value columns are nullable and never default to `0`, so an explicit `0`/`No` stays distinct from "not recorded".
- Unique constraints enforce one behavior entry per behavior per day and one value per outcome metric per check-in.
- Every user-owned table keeps a `user_id`, so multi-user stays possible even though the product is single-user-first.
