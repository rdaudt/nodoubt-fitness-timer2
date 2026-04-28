# Major Review Plan

## Source Documents

- `docs/basic-concepts.md`
- `docs/business-rules.md`
- `docs/ux-redesign.md`

## Confirmed Decisions

- Existing saved timers can be reset or ignored. No legacy migration is required for this feature branch.
- Coach Mode is a global app setting only, default ON.
- Coach Mode changes apply immediately everywhere.
- Timer data uses the station terminology internally. When Coach Mode is OFF, only UI labels change:
  - `Number of Stations` becomes `Number of Sets`
  - `Station Transition Time` becomes `Set Transition Time`
- Work time and rest time are single timer-level durations used across the whole HIIT session.
- `Number of Rounds per station` controls how many times work/rest repeats in each station.
- The last round in a station is work only; no rest runs after the last round.
- Rest time is not required when `Number of Rounds per station` is `1`.
- New timer defaults:
  - Number of Stations: `10`
  - Number of Rounds per station: `3`
  - Work Time: `0:30`
  - Rest Time: `0:15`
  - Station Transition Time: `0:30`
  - Warmup: ON, `5:00`
  - Cooldown: ON, `5:00`
  - Start Station Work Manually: OFF
- `Start Station Work Manually` is stored per timer but shown only when Coach Mode is ON.
- When Coach Mode is OFF, runtime must force `Start Station Work Manually` behavior to OFF even if the stored timer value is ON.
- Implementation must happen on a new feature branch.
- `/timer/:id` remains directly editable. No separate edit form workflow is needed.
- Home timer cards keep the first-card feature image treatment.
- Timer name uniqueness is case-insensitive.
- Old incompatible timers found in IndexedDB should be silently deleted.

## Current Implementation Summary

The current app is interval-list based:

- `Timer.sets` controls repeated work/rest blocks.
- `Timer.repeatSetsUntilStopped` is currently used as a timer-level Coach Mode-like toggle.
- Timers contain arbitrary `intervals` with `warmup`, `work`, `rest`, and `cooldown` entries.
- The timer detail page supports quick editing, drag/reorder, quick-add, and swipe delete for intervals.
- The runner builds a timeline from the interval list.
- The run page renders a list of interval cards and highlights the active one.
- Settings only store interval colors.

## Target Model

Replace the interval-list timer model with an attribute-based model:

```ts
interface Timer {
  id: string;
  name: string;
  stationCount: number;
  roundsPerStation: number;
  workMinutes: number;
  workSeconds: number;
  restMinutes: number;
  restSeconds: number;
  stationTransitionMinutes: number;
  stationTransitionSeconds: number;
  startStationWorkManually: boolean;
  warmupEnabled: boolean;
  warmupMinutes: number;
  warmupSeconds: number;
  cooldownEnabled: boolean;
  cooldownMinutes: number;
  cooldownSeconds: number;
  createdAt: string;
  updatedAt: string;
}
```

Extend app settings:

```ts
interface AppSettings {
  coachMode: boolean;
  intervalColors: Record<IntervalType, string>;
}
```

The existing color settings remain unchanged.

## Business Rules

- Timer name is required, max 25 characters, unique among timers using case-insensitive comparison.
- Number of Stations must be at least `1`.
- Number of Rounds per station must be at least `1`.
- Work Time must be at least `1` second.
- Rest Time must be at least `1` second only when rounds per station is greater than `1`.
- Station Transition Time must be at least `1` second.
- Warmup defaults ON.
- If Warmup is OFF, warmup time is set to `0:00` and disabled.
- If Warmup is ON, warmup time must be at least `1` second.
- Cooldown defaults ON.
- If Cooldown is OFF, cooldown time is set to `0:00` and disabled.
- If Cooldown is ON, cooldown time must be at least `1` second.
- Total time is calculated:
  - warmup time
  - plus station workout duration times number of stations
  - plus station transition time times `(stationCount - 1)`
  - plus cooldown time
- Station workout duration:
  - `work * roundsPerStation`
  - plus `rest * (roundsPerStation - 1)`

## Runner Rules

- Warmup runs once at the start when enabled.
- After warmup:
  - If Coach Mode ON and Start Station Work Manually ON, pause before station 1 work.
  - Otherwise start station 1 work automatically.
- Each station runs:
  - Work for each round.
  - Rest after each round except the final round.
- After a station completes:
  - If it is not the last station, run Station Transition Time.
  - After transition, pause only when Coach Mode ON and Start Station Work Manually ON.
  - Otherwise start the next station automatically.
- After the last station:
  - Run cooldown when enabled.
  - Otherwise complete the timer.
- When Coach Mode OFF, manual station start behavior is forced OFF.

## UI/UX Plan

### Home

- Add global Coach Mode toggle at the top of the timer list.
- Toggle default is ON and persisted in settings.
- Toggle applies immediately everywhere.
- Timer cards should use label vocabulary based on Coach Mode:
  - ON: stations, station transition
  - OFF: sets, set transition

### Timer Editor and Detail

- Replace quick-add interval editing with typed timer attributes.
- Remove drag/reorder interval UI.
- Keep timer deletion behavior.
- Keep `/timer/:id` directly editable.
- Show `Start Station Work Manually` only when Coach Mode is ON.
- Use compact minutes/seconds controls for all duration attributes.
- Validate and show inline errors before saving.

### Running Timer

- Redesign around two cards:
  - Large card: current countdown.
  - Smaller card: next countdown summary.
- Use `media/redesign` examples as the visual reference.
- Keep the current app theme.
- Current card should adapt to the active countdown type:
  - Warmup
  - Work
  - Rest
  - Station transition
  - Cooldown
- Next card should describe the next countdown and include station/round context where useful.

## Implementation Phases

### Phase 1: Branch and Core Model

- Create feature branch.
- Update `Timer`, `AppSettings`, defaults, and factory.
- Remove dependency on legacy interval list for new timers.
- Add timer normalization for the new shape.
- Existing incompatible legacy timers should be silently deleted.

### Phase 2: Time and Timeline Engine

- Replace interval-list timeline builder with station/round timeline builder.
- Add explicit timeline entry types for warmup, work, rest, station transition, cooldown, and manual pause targets as needed.
- Update total-time helpers and card summary helpers.
- Add unit tests for total time and timeline sequences.

### Phase 3: Home and Settings

- Add global Coach Mode to settings/context.
- Render Coach Mode toggle on Home above timer cards.
- Update Home card summaries and labels.
- Preserve the first-card feature image treatment.

### Phase 4: Editor and Detail

- Replace quick interval editor with attribute form.
- Add validation for timer attributes.
- Enforce case-insensitive unique timer names.
- Hide/show labels and controls based on Coach Mode.

### Phase 5: Runner Behavior

- Refactor runner to consume new timeline.
- Implement manual station start pause behavior.
- Force manual-start OFF when Coach Mode OFF.
- Add runner tests for warmup, station rounds, transition, cooldown, and manual pauses.

### Phase 6: Run Page Redesign

- Implement large current countdown card and smaller next card.
- Match `media/redesign` layout direction while preserving existing theme.
- Remove old scrolling interval-list runner UI.
- Add focused component tests where feasible.

### Phase 7: Cleanup and Verification

- Remove obsolete interval editor utilities or leave only if still used elsewhere.
- Update affected tests.
- Run focused tests and `npm run build`.
- Do a browser smoke test of:
  - Home Coach Mode toggle
  - Create timer
  - Edit timer
  - Run timer in Coach Mode ON/OFF
  - Manual station start ON/OFF

## Open Questions

- Confirm whether implementation should start now after creating the feature branch.
