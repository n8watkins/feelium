# feelium - Developer Handoff

A zero-context onboarding doc for the next developer.
Read this first, then `README.md` for setup detail and `docs/DEVIATIONS.md` for the "why" behind the stack.
`docs/PRD.md` is the original, immutable product spec; this handoff describes what was actually built against it.

---

## 1. What feelium is

feelium is a mobile-first Progressive Web App for personal behavior and feeling tracking.
The core loop: record what you did (behaviors), check in with how you felt (outcomes), and see whether the two appear connected.
It answers one question for the user: "What did I do, how did I feel, and are they connected?"

Design principles that show up throughout the code:

- **Private by default.** No sharing, no public profiles, no selling or training on user data.
- **Unknown is never zero.** A blank is stored as `null`, distinct from an explicit `0` or `No`.
- **Association, not causation.** Insights copy is deliberately non-causal ("on days you did X, mood tended to be higher").
- **Single-user-first, multi-user-ready.** Every owned row carries a `user_id`, so the schema already supports many users.

### Current deployed state

**All seven PRD phases are shipped, and the app is live in production.**

- **Live URL:** <https://feelium-sandy.vercel.app>
- **Repo:** `n8watkins/feelium` on GitHub (public), Git-connected to Vercel.
- **Deploy:** pushing to `main` auto-builds and deploys on Vercel. There is no manual deploy step.
- Phases: 1 Foundation, 2 Tracking Setup, 3 Daily Tracking, 4 History, 5 Analytics, 6 Notifications/PWA, 7 Privacy & Release Polish - all complete.

---

## 2. Stack and architecture

### Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict).
- **Tailwind CSS v4** + **shadcn/ui** (Radix primitives, Lucide icons), **next-themes** for light/dark/system.
- **Turso libSQL** (SQLite-compatible) via `@libsql/client`, with **Drizzle ORM**. Local dev uses a plain SQLite file; production uses cloud Turso over HTTP.
- **Auth.js / NextAuth v5** (currently the `5.0.0-beta.31` line) with the Drizzle adapter and a **JWT session strategy**.
- **Vercel** hosting with Git-connected auto-deploy.

### Architecture map

```
src/
  app/
    (app)/                  # Authenticated shell (bottom nav + sidebar)
      today/ history/ insights/ settings/ checkin/
    api/                    # Route handlers: auth, account export/signout, notifications/send
    login/                  # Sign-in page (GitHub OAuth only right now)
    onboarding/             # First-run starter behaviors/outcomes
    manifest.ts             # PWA manifest, driven by branding config
  auth.ts                   # Full Auth.js config: DrizzleAdapter + providers + callbacks
  auth.config.ts            # Edge-safe subset (JWT strategy, callbacks) shared with the route guard
  proxy.ts                  # Next 16 route guard (the middleware equivalent)
  config/branding.ts        # Single source of truth for all brand identity/copy
  db/
    index.ts                # libSQL client: picks Turso when TURSO_* set, else local file
    schema/                 # Drizzle schema: auth.ts (adapter tables) + app.ts (product tables)
    migrate.ts              # Standalone migration runner
    seed.ts                 # Local demo-data seed
  server/
    data/                   # Session-scoped data-access module (see below)
    push/                   # Web Push transport (VAPID)
  lib/                      # Nav config, safe-redirect guard, utils
drizzle/                    # Generated SQL migrations (committed)
tests/                      # Unit and integration regression coverage
scripts/                    # Local persistence test and PWA icon utilities
```

### The authorization model (important)

There is **no database-level row security**. Authorization is enforced at the **application layer**:

- All product data access goes through the `src/server/data/` module. UI code imports from the single entry point `"@/server/data"` (see `src/server/data/index.ts`), never from a submodule.
- Every function there derives the user id from the authenticated session (`auth()`), never from client input, and scopes each query by that id.
- The module is `server-only`; the database is never reachable from the browser.
- The one intentional exception: a few explicitly system-scoped helpers in `data/notifications.ts` take a `userId` directly, used only by the guarded reminder-send job.

This is the deliberate replacement for the PRD's Postgres RLS. See `docs/DEVIATIONS.md` ADR-001 for the reasoning and the privacy-equivalence argument.

### Data-access submodules (`src/server/data/`)

`profile`, `profile-operations`, `behaviors`, `categories`, `outcomes`, `tags`, `entries`, `checkins`, `checkin-writes`, `history`, `analytics`, `starter`, `notifications`, `reminder-schedule-operations`, `reminder-operations`, `reminder-delivery-operations`, `account`, `account-ops`, plus `session`/`errors` helpers.
The `*-operations.ts` modules are kept **session-free** on purpose so integration tests can exercise atomic data operations against a scratch libSQL/Turso target without the Next runtime.

### Auth flow

- `src/auth.ts` builds NextAuth with the DrizzleAdapter and a single provider today: **GitHub OAuth**.
- The magic-link and email/password providers are commented out but preserved, with a re-enable note at the top of the file.
- `src/auth.config.ts` is the dependency-light, edge-safe config (JWT strategy, session callback that copies the user id onto the token/session). It is shared with `src/proxy.ts`, the route guard.
- Session strategy is **JWT** (required by the credentials provider and honored by the others). The token carries `id`; the session callback surfaces it as `session.user.id`.

### Database schema (`src/db/schema/`)

Auth tables (adapter): `user` (includes a `passwordHash` column for the disabled credentials flow), `account`, `sessions`, `verification_token`.

Product tables:

- `profile` - one per user: display name, timezone, one-time device-timezone sync state, and week-starts-on.
- `behavior_category` - user-owned category names, constrained colors, and explicit sort order.
- `behavior` - boolean or numeric; optional category; desired direction (increase/reduce/neutral); optional unit and custom prompt; sort order; archive flag.
- `daily_behavior_entry` - one per behavior per day (unique); boolean and numeric values both nullable.
- `outcome_metric` - rating (1-5), boolean, or numeric; optional desired direction; sort order; archive flag.
- `check_in` - a point-in-time entry (local date + timestamp + note).
- `check_in_value` - one per outcome metric per check-in (unique); rating/boolean/numeric all nullable.
- `tag` and `check_in_tag` - free-form tags (unique name per user) linked many-to-many to check-ins.
- `reminder_setting` - any number of daily reminders per user, each with independent enabled, time, timezone, scheduling, and lease state.
- `reminder_delivery_attempt` - per-reminder, per-occurrence, per-device delivery progress used for retry-safe multi-reminder sends.
- `push_subscription` - Web Push subscriptions per user/endpoint.

---

## 3. Running it and how deploy works

Full setup is in `README.md`; the short version:

- **Local:** `npm install`, copy `.env.local.example` to `.env.local`, set `AUTH_SECRET` (`npx auth secret`) and GitHub OAuth credentials, `npm run db:migrate`, `npm run dev`. Optionally `npm run db:seed` for demo tracking data.
- **Sign-in is GitHub-only** right now, locally and in production, so you need a GitHub OAuth app (callback `http://localhost:3000/api/auth/callback/github`) even for local dev.
- **Deploy:** push to `main` and Vercel auto-deploys. Production reads Turso via `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`; those take precedence over the local `DATABASE_URL` file.
- **Migrations are not run during `next build`.** When the schema changes, run `npm run db:generate` locally, commit the SQL, then apply it against Turso once: `TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:migrate`.
- **Env vars** (secrets, Turso, GitHub OAuth, and the Web Push/cron set) are documented in `README.md` and `docs/notifications-and-pwa.md`.

Useful scripts: `dev`, `build`, `typecheck`, `lint`, `test`, `test:data-operations`, `test:categories`, `test:migrations`, `test:persistence`, `test:persistence:local`, `db:generate`, `db:migrate`, `db:seed`, `db:studio`, and `db:reset`.

---

## 4. What's built (feature set by area)

### Onboarding (first run)

- New users land on `/onboarding` (gated: once any behavior or outcome exists, it never shows again).
- A curated starter set is offered (behaviors like Exercise, Doomscrolling, Reading, Coffee; outcomes like Mood, Anxiety, Energy, Focus). Each can be toggled on/off and renamed before submitting.
- Requires at least one behavior and one outcome to continue.
- A profile row (timezone, week-starts-on) is created automatically on first authenticated request via `ensureProfile()`.

### Today

- Primary "Check in now" action into the check-in flow.
- Active behaviors are grouped by ordered, color-coded categories, with Uncategorized last and behavior order preserved inside each group.
- Inline logging for each active behavior directly on Today: Yes/No for boolean behaviors, a numeric stepper (with unit pluralization) for numeric behaviors.
- Every Today behavior has a direct edit action that returns to Today after saving.
- Add a new behavior inline without leaving Today.
- Shows the latest check-in and a count of today's check-ins.

### Check-in (create and edit)

- Records outcome values: rating 1-5 with anchored labels (direction-aware, e.g. Worse/Better vs Low/High), boolean Yes/No, or numeric with unit.
- Explicit `0` is kept distinct from "not recorded" (`null`).
- Optional free-text note (whitespace preserved).
- Tags: search existing tags or create new ones inline; new tags are written atomically with the check-in.
- Add a new outcome metric inline during check-in.
- Optional quick behavior logging in the same form.
- Writes use `db.batch()` for atomicity (see the Turso gotcha in section 6).
- Editing loads the check-in with its values, including any archived metrics that already have values on it, and returns to the originating screen (Today or a history day).

### History

- Reverse-chronological list of days that have data, each summarizing behaviors, check-ins, outcome averages, tags, and a note preview.
- Days are grouped under week headings that honor the profile's chosen start of week.
- Day detail view: per-behavior state (with inline logging for active behaviors on past dates), all check-ins for the day, each editable and deletable.
- Archived behaviors/metrics still render their historical data, badged "Archived".

### Insights (analytics)

- Time ranges: 7 / 30 / 90 days / all time (default 30).
- **Comparisons:** for each behavior-outcome pair with enough overlapping days, a plain-language summary of how the outcome differed on days the behavior did vs did not happen, with a difference badge and a decorative bar chart. Pairs with partial data show "need N more days" progress.
- **Behavior stats:** frequency (boolean) or average (numeric) plus a simple trend.
- **Outcome stats:** average plus a trend descriptor.
- Copy is explicitly non-causal, with a disclaimer that these are associations in the user's own data, not medical advice.
- Active metrics rank above archived ones.

### Settings

- **Behaviors / Outcomes:** full CRUD, reorder, archive-with-confirmation, and reactivate. Input type locks once entries/values exist (to protect stored data).
- **Behavior categories:** create, rename, recolor, reorder, and delete categories without deleting assigned behaviors.
- **Tags:** list, rename, delete.
- **Notifications:** create, edit, pause, enable, and delete any number of daily reminders; manage Web Push permission and device subscriptions separately; and send a test push.
- **Data:** export everything as JSON, delete all tracking data (keeps the account), or delete the account entirely.
- **Privacy:** a static explainer page.
- **Preferences:** theme (light/dark/system), timezone, and start of week are editable.

### Notifications / PWA

- Installable PWA (manifest from `config/branding.ts`, standalone display, raster + maskable + apple-touch icons).
- Service worker (`public/sw.js`): stale-while-revalidate for static assets, HTML never cached (auth pages stay fresh), Web Push handling, notification deep-link to the check-in screen.
- A guarded send endpoint (`/api/notifications/send`) that a five-minute GitHub Actions schedule drives.
  It queries a bounded due queue, uses timezone-aware and daylight-saving-safe occurrences, retries transient failures fairly, bounds stalled push requests, and prunes dead subscriptions.
  Full detail is in `docs/notifications-and-pwa.md`.

### Account / privacy

- JSON export route (`/api/account/export`), guarded against a stale JWT for a deleted user.
- Tracking-data deletion and full account deletion, both atomic via `db.batch()`, with cascade to owned rows.

---

## 5. How to improve it / what's next

### Deferred follow-ups (known, scoped)

- **Re-enable email magic-link + password sign-in** once a verified Resend sender domain (or another email transport) is in place. Everything is preserved and reversible - follow the re-enable note in `src/auth.ts` and restore the login UI in `src/app/login/page.tsx`. See `docs/DEVIATIONS.md` ADR-002.
- **Whole-number vs decimal numeric steppers.** Numeric inputs could distinguish integer-only quantities (e.g. cups) from decimals (e.g. hours) for a nicer stepper experience.
- **Upgrade next-auth v5 from beta to the stable release** when it lands, and drop the beta pin.
- **Complete the PWA PNG icon set.** Add any remaining resolutions/variants for full install fidelity across platforms (the generator is `scripts/generate-pwa-icons.mjs`, driven by the single SVG).
- **Custom domain.** `feelium.vercel.app` was taken, so production currently lives at `feelium-sandy.vercel.app`; a proper domain (and matching `AUTH_URL` + GitHub callback) would be a clean upgrade.

### Post-MVP product opportunities (PRD section 30)

These are intentionally out of scope for the MVP and should only be built once the core check-in/comparison loop shows consistent use:

- Custom date ranges and tag filtering in history/insights.
- **Tag analytics** (patterns by tag).
- Morning-vs-evening comparisons and **time-of-day patterns**.
- Next-day outcome comparisons.
- **Numeric correlation analysis** (beyond the current group-average comparison; scatter plots, coefficients).
- Custom behavior goals and range-based targets.
- Behavior-specific reminders, distinct from the configurable daily check-in reminder list.
- Formal personal experiments.
- **Weekly reports.**
- Health and screen-time integrations.
- Local-only mode and encrypted notes.
- Native mobile applications.

---

## 6. Known limitations and gotchas

- **Sign-in is GitHub-only.** The seeded `demo@example.com` / password account no longer works because the credentials provider is disabled. Local dev now requires GitHub OAuth credentials to log in at all.
- **Turso + serverless transactions (the P0 lesson).** An interactive `db.transaction()` does **not** reliably commit over Turso/libSQL HTTP in Vercel's serverless runtime: the connection is not sticky, so the `COMMIT` can be dropped and the whole write silently rolls back ("check-in saved but nothing persists"). The fix, and the rule going forward, is to use a single atomic `db.batch()` for multi-statement writes. See `src/server/data/checkin-writes.ts` and `tests/checkin-persistence.test.ts`.
- **Production has no seed/demo data.** Turso in prod starts empty; every account is a fresh GitHub sign-in. `npm run db:seed` is local-only.
- **Migrations are manual against Turso.** They are not run during `next build`. Apply schema changes explicitly (section 3).
- **Offline data entry is out of scope** for this MVP by design (PRD 18). The service worker caches assets, not HTML.
- **Browser automation requires an auth setup.** Supply a disposable `AUTH_SECRET` and an authenticated test session before verifying protected routes.
- **Coverage is focused rather than exhaustive.** Unit tests cover dates, reminders, analytics, validation, and security headers; integration tests cover behavior categories, multi-reminder ownership and delivery, atomic data operations, fresh and legacy migrations, plus real Turso HTTP persistence.

---

## 7. Recommended quick-wins

Small, high-value polishes (listed, not implemented):

- **Whole-number stepper for integer units** (e.g. cups) to avoid decimal input where it makes no sense.
- **Ship a favicon.ico.** `config/branding.ts` references `/favicon.ico`, but only `icon.svg` and the PNGs exist in `public/`.
- **Point at a custom domain** and update `AUTH_URL` + the GitHub OAuth callback, retiring the `-sandy` suffix.
- **Add a lightweight smoke/E2E test** for the core loop (sign in, add behavior, check in, see it in history/insights) so regressions surface without a real browser.
