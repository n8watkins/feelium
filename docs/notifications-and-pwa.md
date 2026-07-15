# Notifications and PWA (Phase 6)

This document covers the Progressive Web App and the daily-reminder notification system (PRD sections 17, 18, 19).

## What is included

- A web app manifest driven from `src/config/branding.ts`, served at `/manifest.webmanifest`.
- Installable PWA: standalone display, home-screen install, rasterized icons plus a maskable icon and an iOS apple-touch icon.
- A service worker (`public/sw.js`) with basic static-asset caching, Web Push handling, and deep links from notifications.
- Exactly one optional daily reminder per user (enabled, time, timezone), stored in `reminder_setting`.
- Web Push subscriptions stored in `push_subscription`, with permission handling and graceful fallbacks.
- A `Settings > Notifications` screen to enable the reminder, pick a time, view permission status, and send a test.
- A scheduled send endpoint that a production cron drives.

Offline data entry is intentionally out of scope for this MVP (PRD 18).

## Icons

The brand mark is `public/icon.svg`.
The raster PWA icons are derived from it, so artwork stays a one-file change:

```
node scripts/generate-pwa-icons.mjs
```

This writes `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`, and `src/app/apple-icon.png`.
The manifest icon list lives in `src/config/branding.ts` (`MANIFEST_ICONS`).

## Environment variables

Web Push uses VAPID keys.
Generate a key pair once:

```
npx web-push generate-vapid-keys
```

Then set these (locally in `.env.local`, in production as project environment variables):

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | client + server | Public key the browser subscribes with. Safe to expose. |
| `VAPID_PRIVATE_KEY` | server only | Signs push messages. Secret. Never commit or expose. |
| `VAPID_SUBJECT` | server only | Contact URI (`mailto:` or `https:`) sent to push services. |
| `CRON_SECRET` | server only | Bearer token guarding the scheduled send endpoint. |

`.env.local` is git-ignored.
`.env.local.example` documents all of the above.
Everything degrades gracefully when the keys are absent: the app still runs, and the settings screen explains that delivery is unavailable.

## Service worker

`public/sw.js` is a plain static file, registered on the client by `src/components/pwa/service-worker-registrar.tsx` (mounted in the root layout).

- Caching: same-origin static assets (`/_next/static/*`, images, fonts, the manifest) use stale-while-revalidate. HTML navigations are not cached, so authenticated pages are always fresh.
- Push: the `push` handler shows the reminder notification. The `notificationclick` handler focuses an existing app window or opens one, deep-linking to the check-in screen (`/checkin/new`).

`next.config.ts` sends `/sw.js` with `Cache-Control: no-cache` and the correct JavaScript content type so clients never get stuck on a stale worker.
`src/proxy.ts` (the auth route guard) excludes `sw.js` so the worker is publicly fetchable rather than redirected to the login screen.

## Reminder delivery (production)

The actual scheduled send needs a server trigger.
The committed GitHub Actions workflow calls the endpoint every five minutes, which keeps Vercel Hobby deployments compatible with their once-daily cron limit.
Scheduled workflows run from the default branch, so merge the workflow before expecting automatic delivery.

`POST` or `GET` `/api/notifications/send`:

- Authenticated in production with `Authorization: Bearer <CRON_SECRET>`, which the scheduled workflow attaches.
- Local development also accepts a `?secret=<CRON_SECRET>` query parameter for manual testing, but production never accepts secrets in URLs.
- The database stores each reminder's next UTC occurrence, so cron reads at most 100 candidates instead of scanning every enabled reminder.
- If a candidate's resolved UTC occurrence is within `window` minutes (default 10), the job begins pushing the gentle reminder to its subscribed devices, including at the first valid minute after a skipped spring-forward time.
- Each user's delivery has a two-minute atomic lease, so overlapping cron invocations do not process it concurrently and an interrupted invocation becomes retryable automatically.
- Delivery progress mutations are fenced by the active lease, but Web Push dispatch and its database marker cannot be atomic; a crash or lease loss between them can cause a successful push to be retried, so dispatch remains intentionally at least once.
- Each invocation attempts at most 25 subscriptions per user and records successful devices individually.
- Unattempted and transiently failed devices remain pending in a fair resumable queue, even when other devices succeeded or expired subscriptions were pruned.
- A subscription is quarantined after three consecutive transient failures so a permanently failing endpoint cannot block later daily occurrences; refreshing its browser subscription clears the quarantine.
- Incomplete deliveries release their lease and move one minute later in the due queue without losing the original local occurrence or starving other candidates.
- Invalid legacy schedules are disabled with an atomic snapshot check, so they cannot permanently occupy the bounded queue or disable a concurrently corrected reminder.
- Push requests have a one-second socket timeout and run with bounded user and subscription concurrency, so unreachable endpoints cannot hold the scheduled invocation open one subscription at a time.
- Subscriptions the push service reports as gone (404/410) are pruned automatically.
- `?dryRun=1` reports who is due without sending. `?window=N` widens the match (clamped to 60).

The committed schedule runs every five minutes and retries transient HTTP failures without allowing overlapping workflow runs.
Configure these GitHub repository settings before enabling reminders in production:

- Set the `REMINDER_CRON_URL` Actions variable to the production deployment origin, such as `https://feelium.example`.
- Set the `CRON_SECRET` Actions secret to the same random value as the production deployment's `CRON_SECRET` environment variable.

GitHub may delay scheduled workflows during periods of high load.
The endpoint's ten-minute due window tolerates one delayed five-minute invocation, and the persisted due queue plus retry-safe delivery state protects overlapping or retried requests.

A manual test send (to the current user's own devices, ignoring the schedule) is available from the `Settings > Notifications` screen via "Send a test".

## Local testing

1. Copy `.env.local.example` to `.env.local` and fill in the VAPID keys, a `CRON_SECRET`, and `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` (GitHub is the only sign-in method - see [DEVIATIONS ADR-002](DEVIATIONS.md)).
2. `npm run db:migrate` then `npm run db:seed` for demo tracking data. (The seeded `demo@example.com` password login no longer works - sign in with GitHub.)
3. `npm run dev -- -p 3002` (or any port).
4. Sign in with GitHub, open `Settings > Notifications`, allow notifications, and turn on the daily reminder.
5. Trigger a scheduled send locally:

```
curl -X POST "http://localhost:3002/api/notifications/send?secret=$CRON_SECRET&dryRun=1&window=60"
curl -X POST "http://localhost:3002/api/notifications/send?secret=$CRON_SECRET"
```

Web Push and service workers require a secure context.
`http://localhost` counts as secure, so no HTTPS is needed for local development.

## Browser support and graceful degradation (PRD 23)

- If the browser lacks service workers, `PushManager`, or the Notification API, the settings screen shows that reminders are unavailable and that the user can still check in anytime.
- If the user denies (blocks) notification permission, the screen shows a clear "blocked" status with instructions to re-allow, and the reminder cannot be delivered until they do. Checking in is never blocked.
- If the server has no VAPID keys, the screen explains that delivery is unavailable.
- iOS supports Web Push only for apps installed to the home screen (iOS 16.4+). Installing the PWA is required there before reminders can be delivered.

## Verification notes

Verified locally against a real Chromium over CDP:

- Manifest and service worker serve correctly; the worker registers and reaches the `activated` state with no console errors.
- The reminder settings save and the permission status reflects the browser state.
- Enabling the reminder creates a real Web Push subscription (FCM endpoint), stored in `push_subscription`.
- The scheduled send endpoint delivers to the subscription (`sent: 1`) with timezone-aware due matching.
- The notification deep-link target (`/checkin/new`) renders.
- Denied permission and unsupported browsers are handled gracefully.

Browser-limited: displaying and clicking an actual OS-level notification cannot be automated headlessly, so the `notificationclick` deep-link is exercised by rendering the target route directly; the push delivery is confirmed by the push service accepting the message (`sent: 1`).
