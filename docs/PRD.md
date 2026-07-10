# Personal Behavior & Feeling Tracker

## Product Requirements Document

**Working title:** Untitled
**Product type:** Mobile-first web application / Progressive Web App
**Status:** MVP definition
**Primary platform:** Mobile web
**Secondary platform:** Desktop web
**Recommended stack:** Next.js, TypeScript, Tailwind CSS, shadcn/ui, Supabase, PostgreSQL, Vercel

---

# 1. Product Summary

The product is a flexible personal tracking app that helps users record:

1. What they did
2. How they currently feel
3. Relevant context
4. Patterns between their behaviors and outcomes over time

Unlike a traditional habit tracker, the product does not focus primarily on streaks, task completion, or total volume.

Its central purpose is to help users answer questions such as:

* Is my anxiety higher on days when I doomscroll?
* Is my mood better on days when I exercise?
* How does my energy change with coffee consumption?
* Do I feel more focused on days when I read?
* What behaviors tend to occur on my better or worse days?

The app should make check-ins fast, flexible, and available at any time. It should then present straightforward analytics without making causal or medical claims.

---

# 2. Product Vision

Create the simplest useful way for someone to connect what they do with how they feel.

The product should sit between:

* A habit tracker
* A mood tracker
* A lightweight journal
* A personal analytics tool

It should not become a complex life-management platform.

The core product loop is:

> Record what happened → record how you feel → review patterns over time.

---

# 3. Problem Statement

Traditional habit trackers typically answer:

* Did I complete the habit?
* How many days did I complete it?
* What is my current streak?

They generally do not answer:

* Did completing this behavior appear to affect how I felt?
* What happens on days when I engage in an unwanted behavior?
* Are certain behaviors associated with better mood, focus, energy, or anxiety?
* Are my assumptions about my behaviors supported by the data I have recorded?

Mood trackers have the opposite limitation. They record feelings but often provide little structured information about what the user did.

Users are therefore left with separate systems:

* Habit tracking
* Mood tracking
* Journaling
* Screen-time data
* Personal notes

This product combines the most useful parts of those systems into one lightweight experience.

---

# 4. Target User

## Primary User

An individual who wants to better understand the relationship between their daily behaviors and how they feel.

Examples include someone trying to understand:

* Doomscrolling and anxiety
* Exercise and mood
* Coffee and sleep or energy
* Reading and focus
* Porn use and motivation
* Social activity and loneliness
* Work habits and stress
* Screen time and mental clarity

## User Characteristics

The primary user:

* Is comfortable self-reporting behavior
* Does not want a complicated journaling process
* Wants more insight than a basic checkbox tracker provides
* May check in once or several times per day
* Values privacy
* Does not necessarily care about streaks or gamification
* Wants understandable observations rather than advanced statistics

---

# 5. Jobs to Be Done

## Core Job

> When I am trying to improve or understand an area of my life, help me track what I did and how I felt so I can see whether meaningful patterns emerge.

## Supporting Jobs

> Help me record my current state without needing to write a full journal entry.

> Help me track both behaviors I want to increase and behaviors I want to reduce.

> Help me compare days when a behavior occurred with days when it did not.

> Help me remember what was happening through optional tags and notes.

> Help me review my history without punishing me for missed days.

---

# 6. Goals

## MVP Goals

The MVP must allow users to:

1. Create custom behaviors.
2. Track positive, negative, and neutral behaviors.
3. Create custom feeling and outcome metrics.
4. Check in at any time.
5. Complete multiple check-ins on the same day.
6. Record optional tags and notes.
7. Review and edit historical data.
8. View basic trends.
9. Compare outcomes when a behavior occurred versus when it did not.
10. Receive one optional daily reminder.
11. Install the app on a mobile device as a Progressive Web App.

## Product Goals

The product should:

* Make a normal check-in take less than one minute.
* Produce useful analytics without requiring technical knowledge.
* Clearly distinguish missing data from a negative response.
* Preserve historical data when metrics are changed or archived.
* Avoid guilt-based design.
* Protect sensitive personal data.

---

# 7. Non-Goals

The MVP will not include:

* AI-generated summaries
* AI coaching
* Medical advice
* Diagnostic claims
* Causal claims
* Social feeds
* Friends or accountability partners
* Leaderboards
* Public profiles
* Complex streak systems
* Achievement badges
* Health platform integrations
* Wearable integrations
* Automatic screen-time collection
* Advanced statistical modeling
* Multi-variable predictive analysis
* Formal experiments
* Native iOS or Android applications
* Team or family accounts
* Required skip reasons
* Preset explanation lists
* Complex dashboards
* Dozens of chart types

---

# 8. Product Principles

## 8.1 Record What Happened

The database should store the actual observation.

Good:

* Doomscrolling: Yes
* Exercise: No
* Coffee: 2 cups
* Short-form video: 65 minutes

Avoid storing confusing double negatives such as:

* Completed "No doomscrolling": False

The behavior goal and the behavior observation must remain separate.

---

## 8.2 Unknown Is Not No

An unanswered behavior must not be interpreted as:

* No
* Skipped
* Failed
* Zero

It must remain unknown.

This is essential for trustworthy analytics.

The app must distinguish between:

* Explicit yes
* Explicit no
* Numeric value
* Not recorded

---

## 8.3 No Causal Language

The app may identify associations in the user's recorded data.

Allowed:

> Your reported anxiety was higher on days when you recorded doomscrolling.

Not allowed:

> Doomscrolling caused your anxiety.

The app must use language such as:

* Associated with
* Higher on days when
* Lower on days when
* Tended to occur alongside
* Based on your recorded check-ins

---

## 8.4 Logging Must Be Easier Than Journaling

The product should prioritize:

* Large tap targets
* One-tap yes/no responses
* Simple rating controls
* Minimal required typing
* Autosaving or fast saving
* Mobile keyboard avoidance where possible

Notes and tags must always remain optional.

---

## 8.5 Missed Days Are Data Gaps, Not Failures

The app should not:

* Shame the user
* Emphasize broken streaks
* Display large red failure states
* Send repeated guilt-based notifications

Preferred language:

> You recorded data on 18 of the last 30 days.

Avoid:

> You failed to check in for 12 days.

---

# 9. Core Product Concepts

## 9.1 Behaviors

Behaviors represent actions, events, or consumption that the user wants to observe.

Examples:

* Exercised
* Doomscrolled
* Read
* Drank coffee
* Watched porn
* Walked
* Took medication
* Used short-form video
* Socialized
* Worked late

### Behavior Direction

Each behavior has a desired direction:

* Increase
* Reduce
* Neutral

Examples:

| Behavior      | Desired direction |
| ------------- | ----------------- |
| Exercise      | Increase          |
| Doomscrolling | Reduce            |
| Coffee        | Neutral or reduce |
| Reading       | Increase          |
| Social event  | Neutral           |

Direction affects how progress is presented. It does not change the underlying observation.

### Behavior Types

The MVP supports two behavior input types.

#### Yes / No

Examples:

* Did you exercise today?
* Did you doomscroll today?
* Did you read today?
* Did you drink coffee today?

Available values:

* Yes
* No
* Unknown

Unknown is represented by no entry.

#### Number With Unit

Examples:

* Coffee: 2 cups
* Short-form video: 45 minutes
* Exercise: 30 minutes
* Sleep: 7.5 hours

A number behavior contains:

* Metric name
* Numeric value
* Unit
* Desired direction

Suggested units include:

* Minutes
* Hours
* Cups
* Servings
* Times
* Pages
* Miles
* Custom unit

The app may provide common units while allowing a custom text unit.

---

## 9.2 Feelings and Outcomes

Outcomes represent the user's emotional, mental, physical, or functional state.

Examples:

* Anxiety
* Mood
* Energy
* Focus
* Motivation
* Mental clarity
* Irritability
* Cravings
* Stress
* Loneliness
* Physical pain
* Sleepiness
* Overall day quality

### Outcome Types

The MVP supports three outcome types.

#### 1–5 Rating

Used for most feelings and subjective states.

Example:

```text
Anxiety: 4/5
Energy: 2/5
Mood: 3/5
```

A rating may optionally define whether:

* Higher is generally better
* Lower is generally better
* Direction is neutral

This direction is used only for visual interpretation.

#### Yes / No

Used for binary states.

Examples:

* Headache
* Felt sick
* Panic episode
* Felt socially connected

#### Number With Unit

Used for measurable outcomes.

Examples:

* Weight
* Hours slept
* Resting heart rate
* Productivity hours

Number-based outcomes will receive basic trend analytics in the MVP. More advanced correlation analysis may be limited until sufficient data exists.

---

## 9.3 Daily Behavior Record

Behaviors are recorded against a calendar day.

A user can update the current day's behavior values throughout the day.

For each behavior and date, there is one current daily value.

Examples:

```text
July 10
Doomscrolling: No
Exercise: Yes
Coffee: 2 cups
Short-form video: 45 minutes
```

If the user changes an entry later that day, the latest value becomes the active value.

The system should preserve updated timestamps for auditing and future product use.

---

## 9.4 Check-In

A check-in is a timestamped snapshot of how the user feels.

Users can check in whenever they want.

The app does not require fixed periods such as morning, afternoon, or evening.

A user may complete:

* No check-ins on a day
* One check-in
* Several check-ins

Each check-in can include:

* One or more outcome values
* Optional tags
* One optional note
* Optional updates to the current day's behaviors

Example:

```text
3:42 PM

Anxiety: 4/5
Energy: 2/5
Focus: 3/5

Tags:
Work
Poor sleep

Note:
Felt distracted after lunch.
```

---

## 9.5 Tags

Tags provide lightweight context.

Examples:

* Weekend
* Work
* Poor sleep
* Sick
* Social event
* Argument
* Deadline
* Travel
* Stayed home
* Ate out

Tags are:

* User-created
* Reusable
* Optional
* Selectable during a check-in

For the MVP, tags appear in history but do not require their own analytics dashboard.

Tag-based filtering may be included if implementation remains simple.

---

## 9.6 Notes

Each check-in can contain one optional freeform note.

Notes are intended for memory and context.

The MVP does not:

* Analyze note text
* Extract tags automatically
* Generate insights from notes
* Require notes for skipped or missed behaviors

---

# 10. Primary User Experience

## 10.1 Navigation

Mobile bottom navigation should include:

* Today
* History
* Insights
* Settings

A persistent or prominent "Check in" action should be accessible from the Today screen.

Desktop may use a sidebar while retaining the same information architecture.

---

# 11. Onboarding

## 11.1 Account Creation

The user can:

* Create an account
* Log in
* Log out
* Reset access
* Delete their account

Recommended MVP authentication:

* Email magic link
* Optional email and password

Social login is not required for the first release.

---

## 11.2 Initial Setup

The onboarding flow should avoid presenting a completely blank system.

The user should be able to:

1. Choose a starter setup.
2. Customize the selected items.
3. Create a completely custom setup.

### Suggested Starter Setup

Behaviors:

* Exercise
* Doomscrolling
* Reading
* Coffee

Outcomes:

* Mood
* Anxiety
* Energy
* Focus

The user may remove or rename any starter item before completing setup.

### Onboarding Success State

The onboarding process is complete when the user has:

* At least one behavior
* At least one outcome
* Reached the Today screen

---

# 12. Today Screen

The Today screen is the primary application screen.

It should display:

* Current date
* Today's behavior list
* Whether each behavior has been recorded
* The user's most recent outcome check-in
* Number of check-ins today
* Check-in button
* Optional reminder state

## 12.1 Behavior List

Example:

```text
Today

Doomscrolling
[No] [Yes]

Exercise
[No] [Yes]

Coffee
[−] 2 cups [+]

Short-form video
45 minutes
```

Each entry should save immediately or with minimal delay.

The UI must make unanswered entries visibly different from "No."

Example:

* Unknown: no selection
* No: selected No button
* Yes: selected Yes button

---

## 12.2 Latest Check-In

The Today screen should show a compact summary of the latest check-in.

Example:

```text
Latest check-in · 3:42 PM

Mood        3/5
Anxiety     4/5
Energy      2/5
```

The user may tap this section to view or edit that check-in.

---

## 12.3 Check-In Action

The user can tap "Check in now" at any time.

The form should contain:

1. Outcome metrics
2. Optional behavior updates
3. Optional tags
4. Optional note
5. Save button

Outcome metrics should be the primary focus.

The form should not require every outcome to be completed. Unanswered metrics remain unknown.

---

# 13. Behavior Management

The user can:

* Create a behavior
* Edit a behavior
* Archive a behavior
* Reorder behaviors
* Reactivate an archived behavior

## 13.1 Create Behavior Fields

Required:

* Name
* Input type
* Desired direction

Conditional:

* Unit, for number behaviors

Optional:

* Short description
* Custom logging prompt

Example:

```text
Name: Doomscrolling
Type: Yes / No
Desired direction: Reduce
Prompt: Did you doomscroll today?
```

## 13.2 Behavior Archiving

Archiving a behavior:

* Removes it from active tracking
* Preserves all historical data
* Does not delete previous entries
* Does not alter old analytics

---

# 14. Outcome Management

The user can:

* Create an outcome metric
* Edit its name
* Edit its desired direction
* Reorder metrics
* Archive a metric
* Reactivate an archived metric

## 14.1 Create Outcome Fields

Required:

* Name
* Input type

Optional:

* Desired direction
* Unit
* Description

Example:

```text
Name: Anxiety
Type: 1–5 rating
Desired direction: Lower is better
```

## 14.2 Scale Changes

The MVP should not allow an existing metric to change between incompatible input types after data has been recorded.

For example:

* A 1–5 rating cannot become a yes/no metric.
* A yes/no behavior cannot become a numeric behavior.

Instead, the user should archive the old metric and create a new one.

This protects historical data integrity.

---

# 15. History

The History section should allow users to review previous data.

## 15.1 History List

Display days in reverse chronological order.

Each day may show:

* Date
* Number of behaviors recorded
* Number of check-ins
* Latest or average outcome summary
* Tags used that day
* Note preview

A calendar view is optional and may be added after the list view is complete.

## 15.2 Day Detail

The user can open a date and see:

* All daily behavior values
* All check-ins in chronological order
* Tags
* Notes
* Missing values
* Edit controls

## 15.3 Editing History

Users can edit:

* Past behavior values
* Past check-ins
* Tags
* Notes

The app should record `updated_at` timestamps.

Deleted check-ins should be removed from analytics.

---

# 16. Analytics and Insights

Analytics must be useful but visually simple.

The MVP should prioritize plain-language summaries over large dashboards.

## 16.1 Supported Time Ranges

Users can view:

* Last 7 days
* Last 30 days
* Last 90 days
* All recorded data

Custom date ranges can be deferred.

---

## 16.2 Behavior Analytics

### Yes / No Behaviors

Display:

* Number of explicit Yes days
* Number of explicit No days
* Number of unrecorded days
* Percentage of recorded days where the behavior occurred
* Basic trend over time

For a behavior the user wants to reduce, the interface may emphasize No days positively.

Example:

```text
Doomscrolling

Occurred on 9 of 23 recorded days.
Did not occur on 14 of 23 recorded days.
7 days had no entry.
```

The denominator must only include explicitly recorded days.

### Numeric Behaviors

Display:

* Average value
* Total value where meaningful
* Minimum
* Maximum
* Number of recorded days
* Trend over time

Example:

```text
Short-form video

Average: 48 minutes
Highest day: 132 minutes
Recorded on 21 of 30 days
```

---

## 16.3 Outcome Analytics

For each outcome, display:

* Average value
* Lowest recorded value
* Highest recorded value
* Number of check-ins
* Trend over time

When multiple check-ins exist on the same day:

* The primary daily analytics value should be the average of that day's recorded check-ins.
* The interface should disclose that it is displaying a daily average.
* Individual check-ins remain visible in history.

---

## 16.4 Behavior-to-Outcome Comparison

This is the key MVP analytics feature.

For each yes/no behavior, the app compares the user's average outcome values on:

* Days where the behavior was explicitly Yes
* Days where the behavior was explicitly No

Example:

```text
Doomscrolling and anxiety

Days with doomscrolling:
Average anxiety: 4.1

Days without doomscrolling:
Average anxiety: 2.9

Difference:
+1.2
```

The app may summarize this as:

> Your reported anxiety was 1.2 points higher on days when you recorded doomscrolling.

The app should also allow the inverse presentation:

> Your reported anxiety was lower on days when you did not doomscroll.

Both statements use the same underlying data.

---

## 16.5 Minimum Data Requirements

Do not display a behavior comparison unless:

* The behavior has at least five explicit Yes days
* The behavior has at least five explicit No days
* The selected outcome has values on enough overlapping days

Before the threshold is reached, display:

> More recorded days are needed before this comparison is available.

The interface may show progress such as:

```text
5 Yes days needed: 3 recorded
5 No days needed: 5 recorded
```

---

## 16.6 Missing Data Rules

The analytics engine must follow these rules:

* No behavior entry means unknown.
* No outcome entry means unknown.
* Unknown values are excluded.
* Archived metrics remain in historical analytics.
* Deleted entries are excluded.
* A day is only included in a behavior-outcome comparison when both values exist.
* A day with several outcome check-ins uses the daily average for that outcome.
* Zero is a valid numeric value and must not be treated as missing.

---

## 16.7 Numeric Behavior Relationships

The first release should not calculate advanced statistical correlations.

For numeric behaviors, the MVP may show:

* Behavior trend
* Outcome trend
* Side-by-side daily values
* Average outcome on zero-value versus nonzero-value days, where relevant

Example:

```text
Coffee and anxiety

Days with no coffee:
Average anxiety: 2.8

Days with coffee:
Average anxiety: 3.4
```

More advanced relationships, thresholds, scatter plots, and correlation coefficients are post-MVP features.

---

## 16.8 Analytics Language

Preferred phrases:

* Based on your recorded data
* On days when
* Your average was
* Associated with
* Tended to be higher
* Tended to be lower

Avoid:

* Caused
* Proved
* Leads to
* Prevents
* Predicts
* Diagnoses
* Improves your health

---

# 17. Notifications

The MVP should support one optional daily reminder.

The user can configure:

* Enabled or disabled
* Reminder time
* Notification permission
* Timezone

Example notification:

> Ready for a quick check-in?

Tapping the notification should open the check-in screen.

The MVP should not include:

* Repeated reminders
* Behavior-specific reminders
* Missed-check-in warnings
* Smart reminder timing
* Multiple daily schedules
* Weekly insight notifications

Users may still check in at any time regardless of the reminder setting.

---

# 18. Progressive Web App Requirements

The application should be installable as a Progressive Web App.

Requirements:

* Web app manifest
* App name and icon
* Mobile home-screen installation
* Standalone display mode
* Responsive mobile layout
* Service worker
* Basic asset caching
* Deep links from notifications

Offline data entry is desirable but not required for the first MVP release.

---

# 19. Settings

The Settings section should include:

## Account

* Email
* Log out
* Delete account

## Tracking

* Manage behaviors
* Manage outcomes
* Manage tags
* Reorder tracking items

## Notifications

* Enable reminder
* Select reminder time
* View notification permission status

## Preferences

* Timezone
* Start of week
* Light, dark, or system theme

## Data

* Export data
* Delete all tracking data
* Delete account

---

# 20. Data Export

Users should be able to export their data in CSV or JSON format.

The export should include:

* Behaviors
* Daily behavior values
* Outcome metrics
* Check-ins
* Check-in outcome values
* Tags
* Notes
* Timestamps

Data export is important because the app stores private and potentially sensitive information.

---

# 21. Privacy and Security

The product may contain sensitive information about:

* Mental state
* Sexual behavior
* Substance use
* Health symptoms
* Personal habits
* Daily routines

The MVP must include:

* Private-by-default data
* No public profiles
* No public sharing links
* Row Level Security
* User-specific database policies
* Secure authentication
* Encrypted network traffic
* Account deletion
* Data deletion
* No sale of personal tracking data
* No use of personal entries for public model training
* Clear privacy language

Users must only be able to access their own records.

---

# 22. Suggested Database Model

## profiles

* `id`
* `display_name`
* `timezone`
* `week_starts_on`
* `created_at`
* `updated_at`

## behaviors

* `id`
* `user_id`
* `name`
* `description`
* `input_type`
* `desired_direction`
* `unit`
* `custom_prompt`
* `sort_order`
* `is_active`
* `created_at`
* `updated_at`
* `archived_at`

## daily_behavior_entries

* `id`
* `user_id`
* `behavior_id`
* `entry_date`
* `boolean_value`
* `numeric_value`
* `created_at`
* `updated_at`

Unique constraint:

* One entry per behavior per user per calendar date

## outcome_metrics

* `id`
* `user_id`
* `name`
* `description`
* `input_type`
* `desired_direction`
* `unit`
* `sort_order`
* `is_active`
* `created_at`
* `updated_at`
* `archived_at`

## check_ins

* `id`
* `user_id`
* `occurred_at`
* `local_date`
* `note`
* `created_at`
* `updated_at`

## check_in_values

* `id`
* `user_id`
* `check_in_id`
* `outcome_metric_id`
* `rating_value`
* `boolean_value`
* `numeric_value`
* `created_at`
* `updated_at`

Unique constraint:

* One value per outcome metric per check-in

## tags

* `id`
* `user_id`
* `name`
* `created_at`

## check_in_tags

* `check_in_id`
* `tag_id`

## reminder_settings

* `id`
* `user_id`
* `is_enabled`
* `reminder_time`
* `timezone`
* `created_at`
* `updated_at`

## push_subscriptions

* `id`
* `user_id`
* `endpoint`
* `subscription_data`
* `device_name`
* `created_at`
* `last_used_at`

---

# 23. Key Edge Cases

The product must account for:

* User checks in across midnight.
* User changes timezone.
* User completes several check-ins within minutes.
* User edits a previous day.
* User archives a behavior.
* User deletes a check-in used by an insight.
* User records zero for a numeric metric.
* User leaves a behavior unanswered.
* User has outcome data but no behavior data.
* User has behavior data but no outcome data.
* User changes the name of a metric.
* User attempts to change an input type after data exists.
* User denies notification permission.
* Push notifications are unavailable on the current browser.
* User records only Yes or only No for a behavior.
* User has insufficient overlapping data for comparison.

---

# 24. Accessibility Requirements

The MVP should meet common WCAG accessibility expectations.

Requirements include:

* Keyboard-accessible controls
* Visible focus states
* Screen-reader labels
* Sufficient color contrast
* No reliance on color alone
* Minimum comfortable mobile tap targets
* Semantic form controls
* Accessible chart summaries
* Reduced-motion support
* Clear validation messages

Every visual chart should have an equivalent text summary.

---

# 25. Performance Requirements

The product should:

* Load the Today screen quickly on a normal mobile connection.
* Save simple behavior entries without a full page refresh.
* Use optimistic updates where safe.
* Display a visible error if a save fails.
* Avoid large analytics payloads.
* Cache static assets.
* Keep the mobile JavaScript bundle controlled.
* Support at least several years of personal entries without significant slowdown.

---

# 26. MVP User Stories

## Behaviors

> As a user, I can create a yes/no behavior so I can record whether it occurred.

> As a user, I can create a numeric behavior so I can record an amount.

> As a user, I can identify whether I want to increase or reduce a behavior.

> As a user, I can explicitly select No without it being confused with missing data.

> As a user, I can archive a behavior without losing its history.

## Outcomes

> As a user, I can create a custom feeling or outcome.

> As a user, I can record a 1–5 rating.

> As a user, I can leave an outcome unanswered.

> As a user, I can archive an outcome without losing previous check-ins.

## Check-Ins

> As a user, I can check in whenever I want.

> As a user, I can check in several times on the same day.

> As a user, I can add optional tags and a note.

> As a user, I can update today's behaviors while checking in.

## History

> As a user, I can review a previous day.

> As a user, I can see every check-in from that day.

> As a user, I can correct an incorrect entry.

## Insights

> As a user, I can see how often a behavior occurred.

> As a user, I can see trends in how I felt.

> As a user, I can compare an outcome on days when a behavior occurred against days when it did not.

> As a user, I can understand when there is not enough data for a comparison.

## Notifications

> As a user, I can choose one reminder time.

> As a user, I can disable reminders.

> As a user, I can still check in at any other time.

---

# 27. MVP Acceptance Criteria

The MVP is complete when a user can:

1. Create an account and log in.
2. Create a yes/no behavior.
3. Create a numeric behavior with a unit.
4. Assign a desired direction to a behavior.
5. Create a custom 1–5 outcome metric.
6. Record today's behavior values.
7. Explicitly distinguish Yes, No, and unknown.
8. Complete a timestamped check-in.
9. Complete multiple check-ins on one day.
10. Add tags and an optional note.
11. Review a historical day.
12. Edit a behavior entry.
13. Edit or delete a check-in.
14. See a behavior frequency summary.
15. See an outcome trend.
16. Compare an outcome on explicit Yes versus explicit No days.
17. See an insufficient-data state when comparison requirements are not met.
18. Enable or disable one daily reminder.
19. Install the app on a supported mobile device.
20. Export or delete their data.

---

# 28. Success Metrics

## Activation

A newly registered user:

* Creates or selects at least two behaviors
* Creates or selects at least two outcomes
* Completes one check-in

## Engagement

Measure:

* Check-ins per active user per week
* Percentage of active users with at least three recorded days per week
* Number of behavior values recorded
* Number of users who return to view Insights
* Percentage of users who reach an available comparison

## Retention

Track:

* Day 1 retention
* Day 7 retention
* Day 30 retention
* Users with at least ten recorded days in their first month

## Product Validation

The MVP is successful if users report that:

* Check-ins are easy enough to sustain.
* The analytics are understandable.
* At least one insight felt useful or surprising.
* Viewing an insight affected a behavior or decision.
* The app feels more useful than a standard habit tracker.

---

# 29. Development Phases

## Phase 1: Foundation

Build:

* Next.js application
* Supabase project
* Authentication
* Profile and timezone
* Row Level Security
* Mobile navigation
* Base design system

## Phase 2: Tracking Setup

Build:

* Behavior creation and editing
* Outcome creation and editing
* Tag creation
* Archiving
* Reordering
* Starter setup

## Phase 3: Daily Tracking

Build:

* Today screen
* Yes/no behavior logging
* Numeric behavior logging
* Check-in form
* Outcome input controls
* Tags
* Notes
* Multiple daily check-ins

## Phase 4: History

Build:

* History list
* Day detail
* Edit entries
* Delete check-ins
* Historical metric support

## Phase 5: Analytics

Build:

* Behavior frequency
* Numeric summaries
* Outcome trends
* Daily outcome averages
* Yes-versus-No comparisons
* Minimum data thresholds
* Plain-language summaries

## Phase 6: Notifications and PWA

Build:

* App manifest
* Icons
* Service worker
* Install experience
* Push subscriptions
* One daily reminder
* Notification deep link

## Phase 7: Privacy and Release Polish

Build:

* Data export
* Account deletion
* Data deletion
* Error handling
* Accessibility review
* Performance review
* Empty states
* Privacy copy
* Analytics explanations

---

# 30. Post-MVP Opportunities

Potential later features include:

* Custom date ranges
* Tag filtering
* Tag analytics
* Morning versus evening comparisons
* Time-of-day patterns
* Next-day outcome comparisons
* Numeric correlation analysis
* Custom behavior goals
* Range-based targets
* Behavior reminders
* Formal personal experiments
* Weekly reports
* Health and screen-time integrations
* Local-only mode
* Encrypted notes
* Native mobile applications

These features should only be added after the core check-in and comparison loop demonstrates consistent use.

---

# 31. Final MVP Definition

The MVP is not a full quantified-self platform.

It is a mobile-first personal tracker that lets a user:

* Record positive, negative, and neutral behaviors
* Check in with customizable feelings and outcomes at any time
* Add optional context
* Review their history
* Compare how they felt on days when a behavior did or did not occur

The product succeeds when the user can quickly answer:

> What did I do, how did I feel, and do those things appear to be connected?
