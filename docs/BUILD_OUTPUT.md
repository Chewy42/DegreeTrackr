# Build Output — DegreeTrackr Frontend

## Latest verification — Wave 10 extended

- **Build date:** 2026-03-14
- **Wave:** 10 extended (final)
- **Result:** PASS
- **Build time:** 1.43s
- **TypeScript:** Clean (`tsc --noEmit` — 0 errors)
- **Tests:** 740 passed, 2 skipped (77 test files)
- **Chunks > 500 kB:** None

### Top output files by size

| File | Size | Gzip |
|------|------|------|
| `dist/assets/index-Bloqua3F.js` | 232.03 kB | 68.32 kB |
| `dist/assets/index-BlRvhKWP.css` | 71.08 kB | 11.94 kB |
| `dist/index.html` | 1.83 kB | 0.66 kB |

### Wave 10 extended summary

- DT104: Chat rate limit auth+limit+reset + profiles edge cases create/update/ownership/null
- DT105: Axe regression on WeeklyCalendar, ExploreChat, OnboardingChat + Wave 10 extended final
- DT106: Full onboarding E2E Playwright flow + ProgressPage snapshot regression
- DT107: Schedule conflict add/detect/resolve regression + evaluation program → progress page flow
- DT108: draftSchedule bulk add/clear/re-add/overlap tests
- DT109: Wave 10 extended final build — all 740 tests green, production build clean

---

## Wave 10

- **Build date:** 2026-03-14
- **Wave:** 10 (final)
- **Result:** PASS
- **Build time:** 1.45s
- **TypeScript:** Clean (`tsc --noEmit` — 0 errors)
- **Tests:** 717 passed, 2 skipped (73 test files)
- **Chunks > 500 kB:** None

### Wave 10 summary

- DT96: Chat rate limit tests + ScheduleBuilder loading/empty/error states
- DT97: Degree progress accuracy integration + chat session list/delete/create/select tests
- DT98: Evaluation upload rate limit + loading/null/error/recovery state tests
- DT99: usePageTitle hook tests + onboarding full question flow integration
- DT100: Schedule conflict add/detect/resolve regression + evaluation program flow tests
- DT101: Chat rate limit exploration + ScheduleBuilder error recovery states
- DT102: Axe regression on WeeklyCalendar, ExploreChat, OnboardingChat — 0 violations
- DT103: Final build and health check — all 717 tests green, production build clean

---

## Wave 9

- **Build date:** 2026-03-14
- **Tests:** 646 passed, 2 skipped (64 test files)
- **Build:** Clean, no chunks > 500 kB
- DT92: WeeklyCalendar React.memo performance test — 24-class render-count verification, reference identity behavior documentation
- DT93: Final build and health check — all 646 tests green, production build clean
