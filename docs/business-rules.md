# Business Rules - Current Application Behavior
> Last verified against codebase: **May 3, 2026**

## 1. Timer Identity Rules
- `name` is required.
- `name` max length is 25 characters.
- Timer names must be unique across saved timers (case-insensitive, excluding self during edits).
- Timer IDs are UUIDs.

## 2. Core Timing Rules
- `stationCount` must be an integer >= 1.
- `roundsPerStation` must be an integer >= 1.
- Work duration must be >= 1 second.
- Rest duration must be >= 1 second when `roundsPerStation > 1`.
- Station transition duration must be >= 1 second.
- If warmup is enabled, warmup duration must be >= 1 second.
- If cooldown is enabled, cooldown duration must be >= 1 second.
- Seconds fields are normalized to 0..59.
- Minutes fields are normalized to integers >= 0.

## 3. Warmup/Cooldown Toggle Rules
- `warmupEnabled = false` forces warmup minutes/seconds to zero.
- `cooldownEnabled = false` forces cooldown minutes/seconds to zero.
- Re-enabling warmup/cooldown restores editable duration fields (UI initializes minutes to 5 if needed).

## 4. Timeline Construction Rules
Timeline is generated in this order:
1. Warmup (if duration > 0)
2. For each station from 1 to `stationCount`:
   - Work for each round from 1 to `roundsPerStation`
   - Rest after work if `round < roundsPerStation`
   - Station transition after station if `station < stationCount`
3. Cooldown (if duration > 0)

Consequences:
- Final round in each station has work only (no trailing rest).
- Final station has no station transition.
- Warmup/cooldown appear at most once each.

## 5. Coach Mode Runtime Rules
When `coachMode = true` and `startStationWorkManually = true`:
- Runner pauses after warmup before first station work starts.
- Runner pauses after each station transition before next station work starts.
- Pause reason is `stationStart`; resume button label shows `Start`.

Otherwise, timer advances automatically through timeline.

## 6. Run Lifecycle Rules
- Entering `/timer/:id/run` auto-starts the run once timeline is ready.
- While running, user can pause and stop.
- Stop during active run requires confirmation.
- Completing naturally logs run as `complete = true`.
- Confirmed early stop logs run as `complete = false`.
- Each run record stores timer snapshot + derived totals at run time.

## 7. Settings Rules
- Interval colors (`warmup`, `work`, `rest`, `cooldown`) must be unique.
- Duplicate colors are blocked from persistence until uniqueness is restored.
- Settings are persisted globally and applied immediately when valid.

Audio options:
- `countdownLast5Beeps`: plays short beep on each second in last 5 seconds of active interval.
- `endIntervalLongBeep`: plays long beep at interval boundaries/completion.

## 8. Template Rules
- Templates can be built-in (`source = builtin`) or user (`source = user`).
- Creating from timer always produces a user template.
- Using a template creates a new timer (new UUID/timestamps).
- Editing a built-in template creates a user copy linked by `builtinTemplateId` (override behavior).
- Deleting built-in template stores a deletion marker; deleting user template removes record.

## 9. Import/Export Rules
- Timer export format: `nodoubt-timers-export` version `1`.
- Export includes timer definitions only.
- Import file must match exact payload shape and version.
- Import validates and normalizes all timers; invalid entries fail import.
- Import replaces all existing timers in current browser profile.

## 10. Run History Rules
- Runs are sorted by `ranAt` descending.
- Run metadata (name, datetime, location, category, station workout types) is editable.
- Run deletion is permanent in local storage.
- Run export downloads one run JSON payload with station workout type mapping.

Coach content generation guardrails:
- Available only when coach mode is on.
- Requires run to be complete.
- Requires workout type value for every station.
- Requires password gate in UI before job creation.

## 11. Storage Rules
IndexedDB database `nodoubt-hiit` (v3) stores:
- `timers`
- `settings`
- `templates`
- `timerRuns`

Normalization is applied on read/write; malformed records are dropped where applicable.
