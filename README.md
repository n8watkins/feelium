# Personal Behavior & Feeling Tracker

A mobile-first Progressive Web App for connecting what you do with how you feel.
The product name is a placeholder ("Untitled") for now and lives behind a single config module - see [Branding](#branding-single-config-point).

This repository currently contains the **Phase 1 Foundation** (per `docs/PRD.md`): the Next.js app shell, authentication, the full database schema with Row Level Security, and the base design system.
It runs entirely locally - no cloud services or external accounts.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** + **shadcn/ui** (Radix primitives, Lucide icons)
- **next-themes** for light / dark / system theming
- **Supabase** running **locally** via the Supabase CLI + Docker (Postgres, Auth, Studio, Inbucket)

## Prerequisites

- **Node.js 20.9+** (Node 24 is used here).
- **Docker Desktop** with WSL integration enabled for your distro (the local Supabase stack runs in Docker).
  Verify the daemon is reachable from your shell with `docker ps` before starting Supabase.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the local Supabase stack.
   The first run pulls Docker images and can take several minutes.

   ```bash
   npm run db:start
   ```

   This applies every migration in `supabase/migrations` to a fresh local Postgres and prints your local URL and keys.

3. Create your local environment file:

   ```bash
   cp .env.local.example .env.local
   ```

   Paste the `API URL` and `anon key` from the `npm run db:start` output (or `npm run db:status`) into `.env.local`.
   These are standard, non-secret local values - never commit a cloud URL or a real `service_role` key.

4. Start the app:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).
   You will be redirected to `/login`.

### Signing in locally (magic link)

Email magic link is the default sign-in.
Local Supabase does not send real email - it captures every auth email in **Inbucket** at [http://localhost:54324](http://localhost:54324).

1. Enter any email on `/login` and choose **Email me a magic link**.
2. Open Inbucket at [http://localhost:54324](http://localhost:54324), open the newest message, and click the **Sign in** link.
3. You are redirected to `/auth/confirm`, the session cookie is set, and you land on `/today`.

Optional email + password sign-in and sign-up are also available on the same screen.
A `profiles` row (with `timezone` and `week_starts_on`) is created automatically for every new user via a database trigger.

### Useful local URLs

| Service            | URL                                              |
| ------------------ | ------------------------------------------------ |
| App                | http://localhost:3000                            |
| Supabase Studio    | http://localhost:54323                           |
| Inbucket (email)   | http://localhost:54324                           |
| Supabase API       | http://127.0.0.1:54321                           |

## Scripts

| Script               | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Start the Next.js dev server                        |
| `npm run build`      | Production build                                    |
| `npm run typecheck`  | TypeScript type checking (`tsc --noEmit`)           |
| `npm run lint`       | ESLint                                              |
| `npm run db:start`   | Start local Supabase and apply migrations           |
| `npm run db:stop`    | Stop local Supabase                                 |
| `npm run db:status`  | Print local Supabase URLs and keys                  |
| `npm run db:reset`   | Drop and recreate the local DB from migrations      |

## Project structure

```
src/
  app/
    (app)/                # Authenticated app shell (bottom nav + sidebar)
      today/ history/ insights/ settings/
    auth/confirm/         # Magic-link verification route handler
    login/                # Sign-in (magic link default + optional password)
    layout.tsx            # Root layout: theme provider, fonts, metadata
    manifest.ts           # PWA manifest (reads from branding config)
  components/             # App shell + shadcn/ui components
  config/branding.ts      # Single source of truth for brand identity
  lib/
    supabase/             # Browser, server, and session-refresh clients
    nav.ts                # Shared navigation items
  proxy.ts                # Session refresh + protected-route guard (Next 16)
supabase/
  config.toml             # Local Supabase configuration
  migrations/             # SQL schema, constraints, and RLS policies
  templates/              # Custom auth email templates
```

## Branding (single config point)

All brand-facing identity - product name, PWA manifest fields, icon references, and key copy - lives in **`src/config/branding.ts`**.
Nothing else hardcodes the product name.
To rebrand, edit that one file.

## Database

The schema is defined as SQL migrations under `supabase/migrations` and follows PRD section 22.

- **Row Level Security** is enabled on every user-scoped table.
  Users can only read, insert, update, and delete their own rows (`auth.uid() = user_id`).
  `check_in_values` and `check_in_tags` are scoped through their parent check-in's ownership.
- **Unknown is never zero.**
  Numeric and boolean value columns are nullable and never default to `0`, so an explicit `0`/`No` stays distinct from "not recorded".
- Unique constraints enforce one behavior entry per behavior per day and one value per outcome metric per check-in.
