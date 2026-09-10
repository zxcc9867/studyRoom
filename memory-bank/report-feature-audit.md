# Study Report Feature Audit

## 2026-09-09 - Current evidence

This is an investigation record, not an approved implementation specification.

- Source: worktree `C:/jini-dev/worktrees/study-room-recovery-audit`, HEAD `01d157b0d6bdb1043954caae65498c20f44cf4fe`.
- The previous goal turn completed deployment verification and recorded authoritative DB, Edge and Vercel results; it was progress, not a no-progress turn.
- Existing uncommitted changes are the preceding release's four memory-bank verification notes. They remain preserved.

## Requirements and observed coverage

| User need | Current evidence | Result |
| --- | --- | --- |
| Understand the current week | `WeeklyReviewSection.tsx` uses `getComparableStudyWeekRanges(todayDateKey)` and shows Monday-to-today against the previous matching weekdays. | Implemented for the current week. |
| Review a finished week after the next week starts | The component receives only today's date and has no report-period selection; `main.tsx` supplies only current/previous week summaries. | No completed-week navigation in this flow. |
| Read a monthly report | Existing month totals and attendance/todo statistics exist, but source search found no monthly report component or month review path. | Not implemented as a report. |
| Trust study totals during loading or failure | Optional canonical summaries fall back to sessions grouped by `local_date`; Suspense waits for the component chunk, not the data. | Reproduced misleading provisional study total. |
| Trust reflection metrics | Reflection loading has `reflectionHistoryLoaded`, but the review is rendered without that gate. | Source-level risk: incomplete reflection data can appear as final metrics. |
| Browse older report periods accurately | Dashboard attendance uses `.limit(370)` while sessions/todos/reflections are paginated. | An extended archive must load selected-period attendance or explicitly enforce a verified coverage boundary. |

## Reproduction

- Rendered the actual TSX component with React server rendering, using synthetic data only; no app source was edited and no real account/API data was used.
- Fixture: UTC completed session from 2026-09-06 23:00 through 2026-09-07 01:00, 7,200 counted seconds; viewed on 2026-09-09.
- Before canonical summary props: helper returns 0 current-week seconds and rendered markup contains `0분`, without data-loading text or `aria-busy`.
- With the canonical overlapping-hour summary: helper returns 3,600 seconds and rendered markup contains `1시간 0분`.
- This proves the provisional-render defect. It does not claim a signed-in production network failure was triggered.
- The summary effect in `main.tsx` retains its previous value while refreshing and on rejection. A future fix must key displayed data to user, time zone and selected period, rather than show a stale period under a new label.

## Existing regression gate

Command:

```text
node --test apps/web/test/improvementAudit.test.mjs apps/web/test/sustainableStudyLoop.test.mjs apps/web/test/weeklyFrictionPlan.test.mjs apps/web/test/weeklyResetBridge.test.mjs
```

- Result: 18 passed, 0 failed.
- These tests cover ready-state arithmetic, canonical-summary precedence, weekly action linkage and interruption guidance, but do not cover data-loading/error rendering or a monthly report.

## Proposed bounded extension awaiting design approval

- Extend the existing My Page review surface with week/month mode and past-period navigation, not a competing dashboard or new start button.
- Preserve completed-session-only time totals, canonical user-time-zone boundaries, break/camera exclusions and the existing next-action planning flow.
- Show selected and comparison dates explicitly; distinguish an in-progress period from a completed report and account for unequal month lengths.
- Reuse owned records; retrieve attendance for the actual report range rather than silently relying on the 370-row dashboard subset.
- Gate metrics until required data is available; expose retryable errors, reject stale user/period responses, and do not substitute zero for unknown data.
- Keep the existing deterministic summaries; no new paid AI, scheduled notification, snapshot table or PDF feature in this proposal.
- Add runtime tests for pending/error/retry, period changes, week/month/year boundaries, leap years, cross-midnight allocation, data coverage, and mobile layout.
- An asynchronous design-approval question was sent. No implementation, schema mutation, commit, push or deployment was performed for this report extension.

## Remaining broad-goal work

- Implement and verify the approved report scope after the user's design decision.
- Review dependency/security findings and specific mobile parity gaps against current behavior; they are candidates, not assumed defects or authorization for unrelated features.
- Do not mark the broad goal complete based only on current-week tests or the preceding recovery release.

## 2026-09-10 - Approved implementation and verification

- The user's `진행해` approved the proposed report scope; earlier awaiting-approval entries describe history, not the current blocker.
- Implemented in StudyReportSection, studyReports and studyReportData under prd-study-reports.md.
- Current/archived week/month navigation, explicit comparison dates, daily monthly averages, owned paginated history and strict canonical readiness are complete locally.
- Independent review found a saved-profile time-zone gate and sibling-query cancellation issue; both were fixed with three additional regression tests.
- Final report tests: 14 passed. Full suite: 501 passed. Web build, native check and README assets passed.
- Browser checks used a local synthetic fixture only: week/month/back/current, keyboard month change, leap February 29 vs January 31 days, error/retry, existing-plan callback, profile delay at LA/Tokyo week boundary, 390px/dark-preference layout and light palette.
- No actual-account report mutation, commit, push or deployment. Release and native physical-device verification remain explicit next steps.
