# HIIT Timer - Product Requirements Document
> Status: **Current as of May 3, 2026**

## 1. Product Overview
HIIT Timer by NoDoubt Training Co. is a mobile-first PWA for creating and running station-based HIIT sessions.

The app serves two goals:
- Give athletes/coaches a fast, offline-capable interval timer.
- Support NoDoubt Training Co. brand and coaching lead generation.

The app is account-free. Core data is local to the browser (IndexedDB).

## 2. Current Product Scope
Implemented capabilities:
- Timer CRUD using a station/round timing model.
- Timer execution with warmup, work/rest rounds, station transitions, and cooldown.
- Coach mode controls (including optional manual start before each station's first work interval).
- Template system (built-in + user templates) with template-to-timer creation.
- Run history with completion state, metadata edits, and export.
- Timer import/export for backup/transfer of timer definitions.
- Global settings for audio behavior, visual preferences, and interval colors.
- Brand/coach presence via topbar, About page, and Instagram CTAs.
- Lightweight backend endpoints for analytics ingestion and coach content-generation jobs.

## 3. Data Model
### 3.1 Timer
A timer contains:
- `id` (UUID)
- `name` (required, <= 25 chars, unique among timers)
- `stationCount` (integer >= 1)
- `roundsPerStation` (integer >= 1)
- `workMinutes`, `workSeconds`
- `restMinutes`, `restSeconds`
- `stationTransitionMinutes`, `stationTransitionSeconds`
- `startStationWorkManually` (boolean)
- `warmupEnabled`, `warmupMinutes`, `warmupSeconds`
- `cooldownEnabled`, `cooldownMinutes`, `cooldownSeconds`
- `category` (`GENERAL` | `FAT-LOSS` | `PERFORMANCE`)
- Optional `stationWorkoutTypes[]` (free-text labels, max 40 chars in UI)
- `createdAt`, `updatedAt`

### 3.2 Template
Template mirrors timer timing fields and category with:
- `source` (`builtin` | `user`)
- Optional `builtinTemplateId` for user override of built-ins

### 3.3 Timer Run
Run history record includes:
- `timerId`, `timerNameAtRun`, full `timerSnapshot`
- `complete` (completed vs stopped early)
- `ranAt`, `location`, `category`
- Derived totals (`totalPerStationMs`, `totalWorkMs`)
- Optional `stationWorkoutTypes[]`

### 3.4 App Settings
- `coachMode`
- `kobeEverywhere`
- `imagesInAllTimers`
- `bwTimerImages`
- `endIntervalLongBeep`
- `countdownLast5Beeps`
- `intervalColors` for `warmup`, `work`, `rest`, `cooldown` (must be unique)

## 4. Timer Execution Model
Execution order:
1. Optional warmup (once)
2. For each station 1..N:
   - Work for round 1..R
   - Rest after each round except the last round in that station
   - Station transition between stations
3. Optional cooldown (once)

Formal sequence:
`[Warmup] -> (Station1[Rounds] -> Transition -> Station2[Rounds] ... StationN[Rounds]) -> [Cooldown]`

Coach-mode manual-start pause rule:
- If `coachMode = true` and `startStationWorkManually = true`, the timer auto-pauses:
  - After warmup before first work interval
  - After each station transition before next station work interval

## 5. Validation & Business Constraints
- Timer name required, <= 25 chars, unique (case-insensitive) within timer list.
- `stationCount` and `roundsPerStation` normalized to integers >= 1.
- Work duration must be >= 1 second.
- Rest duration must be >= 1 second when rounds per station > 1.
- Station transition must be >= 1 second.
- Warmup/cooldown must be >= 1 second when their toggle is enabled.
- Warmup/cooldown durations are forced to `00:00` when disabled.
- Seconds are normalized to `0..59`; minutes are integers >= 0.
- Interval colors must be unique across warmup/work/rest/cooldown.

## 6. Audio & Wake Lock
- Web Audio API is unlocked on first pointer interaction.
- Optional short countdown beep for last 5 seconds of each active interval.
- Optional long beep at each interval boundary and completion.
- Screen Wake Lock is requested while running and released on pause/stop/completion/unmount.

## 7. Storage & Sync
Primary persistence:
- IndexedDB (`nodoubt-hiit`, schema v3): timers, settings, templates, timerRuns.

Other local persistence:
- `localStorage` tracks analytics session activity and content job status cache.

Import/export:
- Timers can be exported/imported via JSON (`nodoubt-timers-export` v1).
- Import replaces all existing timers in current browser profile.
- Run history is intentionally excluded from timer import/export.

## 8. Screens & Routes
- `/` Timers list (category filter, coach mode toggle, create/clone/delete/template actions)
- `/timer/new` creates a default timer then redirects to detail
- `/timer/:id` Timer detail/editor
- `/timer/:id/run` Active running screen
- `/templates` Templates list
- `/template/:id` Template detail/editor
- `/history` Run history and coach content workflow
- `/about` Coach/brand/about page
- `/settings` Global app settings + import/export actions

Bottom nav (non-running screens): Timers, Templates, History, About, Settings.

## 9. Analytics & Backend Endpoints
Frontend emits events to `/api/analytics-ingest`:
- `app_opened`
- `timer_created`, `timer_cloned`
- `timer_created_from_template`, `template_created_from_timer`
- `timer_run_completed`, `timer_run_incomplete`, `timer_run_coach_mode`
- `timers_exported`, `timers_imported`

Additional backend routes exist for:
- Analytics health/summary/rollup
- Coach content generation job lifecycle (`content-jobs-*`, IG image generation)

## 10. Non-Functional Characteristics
- PWA with service worker caching and offline support.
- Mobile-first interaction patterns and bottom navigation.
- Local-first architecture for core workout flows.
- No authentication for timer usage.

## 11. Explicitly Not Included (Current Build)
- User accounts and multi-device sync
- Real-time collaboration
- Payment/subscription flows
- In-app booking/CRM


