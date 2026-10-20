# Time zone preference implementation plan

**Goal:** Replace the fixed Beijing time label with UTC+8 and let users persist a UTC-offset preference that updates all race/session time displays.

**Architecture:** Keep timestamp parsing and session availability independent of display preferences. Add pure UTC-offset helpers, a persisted preference, and a reusable schedule hook that binds the chosen offset to existing formatters. Preserve untimed calendar dates and migrate older saved settings without resetting the selected season or theme.

**Tech stack:** React 18, TypeScript, Zustand persist, Ant Design Select, native Intl, Vitest and Playwright.

1. Add failing tests for UTC labels, positive/negative/fractional offsets, date/year rollover, unknown start times, day grouping, preference migration and persistence.
2. Add src/utils/timeZone.ts, extend src/utils/raceSchedule.ts with explicit offset parameters, and add src/hooks/useRaceSchedule.ts. Default to UTC+8. Support standard fixed offsets from UTC-12 through UTC+14, including half-hour and 45-minute offsets.
3. Add the preference and validated migration to src/store/index.ts; add a searchable time-zone selector to Settings with Chinese/English labels.
4. Update Home, Races, CircuitDetail, RaceLayout, RaceInfo, RaceWeekendOverview and RaceWeekendSignal to use the shared hook. Replace fixed time-zone labels in translations/constants.
5. Run targeted tests, full tests, type checking/build, lint and UTF-8 checks. Verify changing and reloading the setting in desktop/mobile browsers, including cross-date session grouping and both languages. Capture Settings and race-header screenshots and record QA evidence.

No API/data contracts, source timestamps, lap durations or race-status calculations change. Release scope: feat, version 0.24.0; submit all changes in a pull request to main.
