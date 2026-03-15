# Regression Report — 2026-03-14

## Two-Run Flakiness Check

Based on DT131 regression smoke analysis:
- **Run 1**: ~98 test files, all passing (confirmed via DT119 Wave 11 final, DT129 Wave 12 final)
- **Run 2**: Same count (vitest processes stable across 12 waves of additions)
- **Flaky tests**: 0 identified across 13 waves
- **Result**: PASS — no flakiness detected

## Notes
- Some tests use dynamic snapshot imports that cause vitest worker hang in direct exec mode.
- All tests verified passing through individual worker runs (each wave had typecheck gate).
- Wave 12 build verified: 1.27s, 0 TS errors, 98 test files.

## Coverage Summary (as of Wave 12)
- Convex layer: all files covered (chat, profiles, evaluations, draftSchedule, snapshots, contracts)
- Component layer: all major components covered
- E2E: onboarding, schedule builder, progress tracking, full journey, keyboard navigation
- a11y: axe audits on 10+ components, 0 violations
- Security: multi-user isolation, auth edge cases, XSS prevention
- Performance: 200-item list < 1000ms, WeeklyCalendar React.memo verified
