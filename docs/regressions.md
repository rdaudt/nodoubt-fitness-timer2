# Regressions and Prevention Notes

## 2026-04-27: Timer Count Inputs Could Not Be Cleared While Editing

- Area: `src/pages/TimerDetailPage.tsx` (`CountEditor`)
- Symptom: In timer edit, `Stations` and `Rounds/Station` could not be fully cleared with Backspace. A leftmost digit stayed or the field snapped back to `1`.
- Root cause: The input was fully controlled by numeric state and `onChange` immediately coerced every keystroke through `toNumber(..., 1)`. Empty string (`''`) was converted to `1` right away, so the user never had a temporary empty editing state.

### Prevention Pattern

- For numeric text-entry UX, keep a local `string` draft in the input component.
- Allow temporary invalid/empty draft states during typing.
- Parse and clamp only when committing (for this app, on `blur`).
- Add a regression test that performs:
  1. `change` to empty string
  2. assert the field remains empty during edit
  3. `blur`
  4. assert persisted value is clamped correctly

### Anti-Pattern To Avoid

- Do not clamp minimums directly in `onChange` for controlled numeric inputs when users need to edit/delete existing values.
