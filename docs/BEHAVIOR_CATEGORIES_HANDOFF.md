# Behavior Categories, Main-View Editing, and Preferences Handoff

## Purpose

This document is the reset-safe handoff for the next implementation context.
It covers two production bugs, the requested behavior-management feature set, and support for any number of reminders.
Read this document first, then read `AGENTS.md` and the relevant Next.js 16 documentation under `node_modules/next/dist/docs/` before editing code.

## Resume Point

The implementation has not started.
The repository is clean except for a pre-existing untracked `.vercelignore` that must not be modified, staged, or committed.
The working branch is `feature/behavior-categories`, created from the merged production baseline.

The work must be completed in this order:

1. Reproduce and fix the Preferences save failure through the authenticated UI.
2. Reproduce and fix the Pacific-time date mismatch through the authenticated UI.
3. Add behavior categories with automatically assigned colors.
4. Add direct behavior editing from Today and return users to Today after saving.
5. Replace the single daily reminder with an unlimited reminder list.
6. Verify the complete experience, update documentation, and commit each logical change separately.

The Preferences and timezone bugs may share a root cause.
Do not assume they are independent until the save request, persisted profile row, and rendered date have been traced end to end.

## Repository State

- The repository root is `/home/natkins/projects/feelium`.
- The GitHub repository is `https://github.com/n8watkins/feelium.git`.
- The current branch is `feature/behavior-categories`.
- The branch starts at commit `b406922`, which is also the current `main` and `origin/main` commit.
- Commit `b406922` is `Harden Feelium production reliability (#1)`.
- No source changes for this feature have been made yet.
- `.vercelignore` was already untracked and must remain untouched.
- The user has not asked to push this feature branch.

Run these checks immediately after resuming:

```sh
cd /home/natkins/projects/feelium
git status --short --branch
git log -5 --oneline --decorate
```

## Verified Production State

- Production is available at `https://feelium-sandy.vercel.app`.
- The most recent verified production deployment was Ready and returned HTTP 200.
- Production database migrations were current before this feature work began.
- Web Push VAPID variables are configured in Vercel production.
- The scheduled reminder workflow passed after the VAPID deployment.
- Post-merge CI on `main` passed.
- The previous no-mistakes run passed.

Do not expose environment variable values, database tokens, OAuth secrets, or VAPID private keys in logs or documentation.

## User-Reported Production Bugs

### Preferences do not save

The user reported that they tried to save Preferences and it did not work.
The report was made after noticing the incorrect Today date, so the failed timezone preference may explain the date mismatch.
There is currently no independent authenticated-browser reproduction because the automated browser session redirects protected pages to GitHub login.

The current Preferences form is in `src/app/(app)/settings/page.tsx`.
It posts to `updatePreferencesAction` in `src/app/(app)/settings/actions.ts`.
That action validates the form, calls `updateProfilePreferences`, and revalidates `/settings`.
The data update is in `src/server/data/profile.ts`.
The form currently has no pending state, success confirmation, or displayed action error, so even a successful update has weak user feedback.

Reproduce the problem as an end user before modifying it:

1. Sign in to production or an equivalent local environment.
2. Open Settings.
3. Change timezone to `America/Los_Angeles` and change the start of week.
4. Submit Save preferences.
5. Observe the request, response, visible feedback, and selected values after a hard refresh.
6. Verify the corresponding profile row directly using a safe query that does not print personal data.
7. Determine whether the failure is submission, validation, server-action routing, database persistence, cache refresh, or absent feedback.

The fix must provide a visible pending state and a clear success or error result.
It must not rely on a silent refresh as the only confirmation.
Add regression coverage at the closest useful layer and verify the real browser flow.

### Today shows the next date in Pacific time

On July 14 in Pacific time, the app asked the user to check in for July 15.
The environment date when reported was July 14, 2026 in `America/Los_Angeles`.
The most likely immediate explanation is that the stored profile timezone remained `UTC`, but this has not yet been proven.

`src/app/(app)/today/page.tsx` and `src/app/(app)/checkin/new/page.tsx` derive the local date from the stored profile timezone.
The date utilities already have Pacific boundary tests, so the date formatter itself is not the leading suspect.
`src/components/timezone-sync.tsx` performs browser timezone initialization only when `profile.autoSyncTimezone` is true.
`src/server/data/profile-operations.ts` turns that flag off after the first sync.
Legacy profiles received `auto_sync_timezone = false`, which currently cannot be distinguished from an intentional manual timezone choice.

Start diagnosis with a safe aggregate production query such as:

```sh
turso db shell feelium "select timezone, auto_sync_timezone, count(*) as users from profile group by timezone, auto_sync_timezone;"
```

Do not update a production user row until the affected account is safely identified and the user has authorized that production data change.

The durable fix must satisfy all of these conditions:

- At an instant such as `2026-07-15T03:00:00Z`, Today and new check-ins use `2026-07-14` for `America/Los_Angeles`.
- A deliberately selected manual timezone is respected.
- New accounts initialize from the browser timezone.
- A legacy account stuck on the migration default receives a reliable path to correct its timezone.
- Saving a timezone refreshes all date-dependent views.
- Tests cover the UTC-to-Pacific date boundary and the preference-sync state transitions.

A browser-detected timezone mismatch prompt may be more robust than silently overwriting a manual choice.
If schema state is needed to distinguish an uninitialized legacy default from a deliberate preference, generate a migration rather than overloading the existing boolean further.

## Requested Behavior Experience

The user wants behavior editing available from the main Today view.
The user also wants behavior categories and colors assigned to those categories.

The agreed product direction is:

- Add an accessible edit action to every Today behavior row.
- Open the existing behavior edit screen with a safe `from=/today` return destination.
- Return to Today after a successful edit initiated there.
- Allow users to create, rename, recolor, reorder, and delete behavior categories.
- Allow a category to be selected when creating or editing a behavior.
- Automatically assign a color from a curated accessible palette when a category is created.
- Allow the user to change the assigned category color.
- Group Today behaviors by category.
- Place uncategorized behaviors in an `Uncategorized` group last.
- Use category colors for restrained labels and section accents rather than full-card background tints.
- Show a category badge in the behavior-management list.
- Deleting a category must preserve its behaviors and make them uncategorized.

## Requested Reminder Experience

The user wants to be able to set any number of notifications.
The current product supports exactly one daily reminder per user, so this requires a data-model, delivery-coordination, server-action, UI, export, test, and documentation change.

The intended direction is:

- Allow a user to create any number of daily check-in reminders.
- Show reminders as a manageable list of local times.
- Allow each reminder to be enabled, disabled, edited, and deleted independently.
- Keep push subscription management device-scoped and separate from reminder schedule management.
- Prevent duplicate reminder times for the same user unless a deliberate product reason is documented.
- Keep all reminder times aligned with the user's intended IANA timezone.
- Preserve existing reminder schedules during migration.
- Keep the scheduled send job bounded, fair, retryable, and safe under overlapping invocations.
- Deliver multiple distinct reminders on the same local calendar day when the user configured them.

The existing `reminder_setting.user_id` column is unique and must stop being unique for one-to-many reminders.
Each reminder row already has an ID, which should become the identity used by scheduling and delivery operations.
The current delivery lease and subscription-attempt logic is substantially keyed by user and local date.
That design can suppress a second reminder on the same date and must be changed to key delivery state by reminder ID and occurrence, not merely by user and date.

Do not implement unlimited reminders as a JSON array or comma-separated field.
Use normalized reminder rows and explicit ownership checks.

## Proposed Data Model

Use a dedicated category table instead of storing arbitrary category strings on behaviors.
A robust starting model is:

- `behavior_category.id`
- `behavior_category.user_id`
- `behavior_category.name`
- `behavior_category.normalized_name`
- `behavior_category.color`
- `behavior_category.sort_order`
- `behavior_category.created_at`
- `behavior_category.updated_at`

Add nullable `behavior.category_id` with a foreign key that sets the value to null when a category is deleted.
Enforce category ownership in every query and mutation.
Enforce a case-insensitive or normalized unique category name per user.
Use stable palette tokens rather than accepting arbitrary CSS values.
Choose the least-used palette token for automatic assignment so adjacent categories are likely to differ.

Generate the Drizzle migration with the repository command.
Do not manually edit generated migrations or generated metadata.

```sh
npm run db:generate
```

Before applying the production migration, verify fresh migration, legacy migration, local behavior, and the generated SQL.

## Implementation Plan

### 1. Fix Preferences saving

- Reproduce the failure in an authenticated browser.
- Inspect the server-action response and production/runtime logs.
- Verify whether the selected values persist after a hard refresh.
- Verify the profile row without exposing user data.
- Fix the actual write or rendering issue.
- Add an accessible pending state and visible success/error feedback.
- Revalidate every route whose date behavior depends on the preference.
- Add focused automated tests.
- Run browser verification.
- Commit this logical fix before starting the next task.

### 2. Fix timezone date behavior

- Confirm the affected profile timezone and `auto_sync_timezone` state.
- Reproduce the next-day display at a UTC/Pacific boundary.
- Separate legacy-uninitialized state from an intentional manual preference if necessary.
- Add a safe device-timezone mismatch correction flow if automatic initialization cannot resolve legacy accounts.
- Confirm Today, Check-in, History, Insights, and reminder behavior use the intended timezone.
- Add boundary and state-transition tests.
- Run browser verification in Pacific time.
- Commit this logical fix separately.

### 3. Add category schema and server data operations

- Add the category table and nullable behavior category foreign key.
- Generate and inspect the migration.
- Add session-scoped create, list, update, reorder, and delete operations.
- Add category assignment to behavior create and update operations.
- Make category deletion leave behaviors uncategorized.
- Update account export to include categories and category assignments.
- Consider incrementing the export format version because the exported shape changes.
- Update tracking-data and account deletion operations in the correct foreign-key order.
- Add integration tests for ownership, uniqueness, deletion, ordering, and migration behavior.
- Commit the schema and data-layer change after verification.

### 4. Add category management and assignment UI

- Add a category-management route, preferably `/settings/behaviors/categories`.
- Add create, rename, color, reorder, and delete controls with accessible labels and confirmation where destructive.
- Add a native category select to the existing behavior form.
- Include an `Uncategorized` option.
- Link category management from the behavior settings page and behavior form.
- Display compact category badges in the behavior list.
- Verify mobile and desktop layouts, light and dark themes, keyboard focus, and color contrast.
- Commit the category-management UI after verification.

### 5. Group Today and add direct editing

- Preserve the current global behavior order within each category group unless a category-specific order is deliberately introduced.
- Sort category groups by category sort order and place Uncategorized last.
- Add restrained color accents to group headings or badges.
- Add an accessible edit icon or text action to `src/components/tracking/behavior-log-row.tsx`.
- Pass `from=/today` through the behavior edit page and update action.
- Validate the return path with the existing safe-redirect utility.
- Ensure editing does not make inline logging harder to tap on mobile.
- Verify direct editing, saving, returning, grouping, logging, empty states, and archived behavior handling.
- Commit this logical UI change separately.

### 6. Add unlimited reminders

- Reproduce and document the current single-reminder flow before changing it.
- Remove the one-reminder-per-user uniqueness constraint with a generated migration.
- Preserve every existing reminder row and its enabled state, time, timezone, and next occurrence.
- Refactor user-scoped queries from get/upsert-single semantics to list, create, update, enable, disable, and delete by reminder ID.
- Require both reminder ID and authenticated user ID for every reminder mutation.
- Refactor candidate, lease, retry, completion, invalid-schedule, and subscription-attempt logic to distinguish multiple reminders for one user on the same local date.
- Prefer a stable occurrence identity such as reminder ID plus scheduled occurrence or local date and time.
- Keep push subscriptions shared at the account/device level rather than duplicating subscriptions per reminder.
- Update timezone synchronization so all enabled reminders are rescheduled consistently when the applicable timezone changes.
- Replace the single-reminder UI with a mobile-friendly list and an Add reminder action.
- Provide per-row time editing, enabled state, deletion, pending state, success feedback, and error feedback.
- Keep notification permission, device subscription, remove-device, and test-send controls separate from schedule rows.
- Add tests for two reminders on the same day, overlapping cron runs, retries, dead subscriptions, invalid schedules, deletion, ownership, timezone changes, and migration preservation.
- Update account export so reminders are an array rather than a nullable single object and increment the export format version.
- Run authenticated browser verification with at least two reminder times.
- Commit schema and delivery refactoring separately from the reminder-list UI when practical.

### 7. Documentation and full verification

- Update `README.md` and `docs/HANDOFF.md` to describe categories and main-view editing.
- Update notification documentation and Settings copy to describe multiple reminders.
- Update the stale scheduler comment in `.env.local.example`, which says Vercel Cron runs every minute even though GitHub Actions runs every five minutes.
- Do not edit `docs/PRD.md` because it is the original immutable specification.
- Do not manually edit any generated changelog or generated file.
- Run all relevant tests, lint, typecheck, build, migration tests, and browser verification.
- Run the no-mistakes workflow only after the code and documentation are complete.
- Push only when the user asks.

## Primary File Map

- `src/app/(app)/settings/page.tsx` contains the Preferences form.
- `src/app/(app)/settings/actions.ts` contains Preferences and timezone server actions.
- `src/server/data/profile.ts` writes profile preferences.
- `src/server/data/profile-operations.ts` performs one-time timezone initialization.
- `src/components/timezone-sync.tsx` detects the browser timezone.
- `src/app/(app)/today/page.tsx` builds the Today date and behavior list.
- `src/app/(app)/checkin/new/page.tsx` chooses the new check-in date.
- `src/components/tracking/behavior-log-row.tsx` renders each Today behavior row.
- `src/app/(app)/settings/behaviors/page.tsx` lists behavior settings.
- `src/app/(app)/settings/behaviors/new/page.tsx` creates a behavior.
- `src/app/(app)/settings/behaviors/[id]/page.tsx` edits a behavior.
- `src/components/settings/behavior-form.tsx` contains shared behavior fields.
- `src/server/data/behaviors.ts` contains behavior data access.
- `src/server/data/account-ops.ts` contains account export and deletion logic.
- `src/components/notifications/notification-settings.tsx` currently contains the single-reminder UI and device controls.
- `src/app/(app)/settings/notifications/actions.ts` currently saves a single reminder.
- `src/server/data/notifications.ts` currently reads and upserts a single reminder and lists due candidates.
- `src/server/data/reminder-operations.ts` coordinates reminder scheduling updates.
- `src/server/data/reminder-delivery-operations.ts` coordinates leases and subscription delivery attempts.
- `src/app/api/notifications/send/route.ts` runs the guarded scheduled delivery loop.
- `docs/notifications-and-pwa.md` documents the current one-reminder delivery architecture.
- `src/db/schema/app.ts` contains product schema definitions.
- `tests/migrations.integration.test.ts` tests fresh and legacy migration paths.
- `tests/review-findings.integration.test.ts` currently tests profile synchronization behavior.
- `tests/date.unit.test.ts` tests timezone date boundaries.

Confirm exact file names with `rg --files` before editing because route organization may change.

## Next.js Requirement

This project uses a Next.js version with breaking changes.
Read the relevant local guides in `node_modules/next/dist/docs/` before writing code.
At minimum, review the current Server Actions, forms, caching, and revalidation documentation for the Preferences work.
Review the Server Component and Server Action guidance for the category pages and behavior mutations.

## Verification Checklist

Run focused tests after each logical change and the complete suite at the end.
The likely final command set is:

```sh
npm run typecheck
npm run lint
npm test
npm run test:data-operations
npm run test:migrations
npm run build
git diff --check
git status --short --branch
```

Use the project browser-verification instructions whenever a dev server is started.
The protected flow needs an authenticated session, so arrange a safe local test login or use the user's already authenticated browser session without exposing credentials.
Be picky about mobile layout, spacing, focus rings, theme behavior, color contrast, loading states, error states, and saved-state feedback.

## Commit Discipline

Commit after every verified logical change.
Use clear commit messages and never add an agent co-author.
Do not let the Preferences fix, timezone fix, schema work, and UI work accumulate into one commit.
Do not use an em dash in documentation, UI copy, or commit messages.
Do not stage `.vercelignore`.
Do not push until the user asks.

## Risks and Unknowns

- The exact reason Preferences saving failed is unknown until authenticated reproduction and persistence tracing are complete.
- The timezone date bug may be entirely downstream of the Preferences failure.
- The affected production profile state has not been queried yet.
- Automated browser verification currently reaches the GitHub login page rather than an authenticated Today page.
- Existing behavior sort order is global, so grouped rendering should preserve that order unless the product model is intentionally changed.
- Category colors need semantic light and dark theme variants with tested contrast.
- Category ownership must be enforced both when assigning a behavior and when updating or deleting a category.
- Adding categories changes account export and deletion behavior and must not be treated as UI-only work.
- Supporting multiple reminders changes the identity and idempotency assumptions in the delivery pipeline and must not be treated as a simple UI loop.
- The current per-user, per-date delivery state can incorrectly suppress later reminders on the same day unless it is redesigned around reminder occurrences.
- The immutable `docs/PRD.md` specifies one reminder and must remain unchanged even though the implemented product is intentionally moving beyond it.

## Exact Kickoff Prompt

Use this prompt in the next context:

> Continue the Feelium work from `/home/natkins/projects/feelium/docs/BEHAVIOR_CATEGORIES_HANDOFF.md`.
> Read that file and `AGENTS.md` completely, inspect the current Git state, and follow the ordered plan.
> Start by reproducing the authenticated Preferences save failure and the Pacific-time date mismatch end to end before making changes.
> Then implement behavior categories, direct Today editing, and unlimited reminders according to the ordered acceptance criteria.
> Commit every verified logical change separately, keep the pre-existing `.vercelignore` untouched, and do not push unless I ask.
