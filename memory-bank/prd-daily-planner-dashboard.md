# PRD: Daily Planner Dashboard

## 1. Problem

The user can create dated todos with optional times, but the Today page only shows them as a checklist. This makes it hard to see how the day is distributed across time blocks and to adjust the dashboard layout to match the user's study workflow.

## 2. Target Users

Personal MVP users who want to plan and visualize today's study tasks in either a checklist or a life-planner style circular schedule.

## 3. Goals

- Let the user switch dated tasks between checklist and circular daily planner views.
- Let the user inspect and edit yesterday, today, tomorrow, or any selected calendar date from the same Today Tasks card.
- Let the user apply one selected date's plan to multiple calendar dates at once.
- Show timed todos as 24-hour SVG wheel segments and untimed todos in a separate list.
- Explain every time conflict with both todo titles, both schedule ranges, and the exact overlapping time range.
- Let the user create a timed todo by clicking an empty planner time area.
- Let the user edit an existing timed todo by clicking a planner segment.
- Mark planner or untimed todos complete directly when no study session is active.
- Let the user schedule an existing dated todo by applying the current time fields from the todo modal without marking it complete.
- Persist the preferred task view on `profiles.today_task_view`.
- Let the user reorder the Today dashboard sections and persist that order on `profiles.today_section_order`.

## 4. Non-goals

- Weekly or monthly planner visualization.
- A separate recurrence-rule table.
- Server-rendered dashboard pages.
- Reordering the sidebar navigation.

## 5. User Stories

- As a user, I want to see today's timed tasks as a circular life planner, so that I can understand my day at a glance.
- As a user, I want untimed todos to remain visible below the wheel, so that they do not disappear from the plan.
- As a user, I want to pin checklist or planner view, so that the next login opens with my preferred task view.
- As a user, I want to reorder the Today sections, so that the timer, calendar, tasks, and camera appear in the order I prefer.
- As a user, I want to mark a planner task complete when I finish it outside a running study session, so that the Today progress and history update immediately.
- As a user, I want to click a calendar date and see that date's checklist or life planner, so that I can prepare yesterday, tomorrow, or future schedules without leaving the dashboard.
- As a user, I want to copy a finished daily plan to multiple dates, so that repeated study days can be set up quickly without manually recreating each todo.

## 6. User Scenarios

### Normal Flow

1. The user opens Today.
2. The user switches from checklist to planner.
3. Timed todos appear as colored segments on the 24-hour SVG wheel.
4. The user clicks an empty time area; the existing todo modal opens with a default one-hour time block.
5. The user saves or selects an existing untimed todo to apply the configured time range; `study_todos` updates and the planner recalculates.
6. The user clicks `고정`; `profiles.today_task_view` stores the current view.
7. The user opens the section order editor, drags or moves rows, and saves the order to `profiles.today_section_order`.

### Edge Cases

- Todos without `start_time` or `end_time` stay in the untimed list.
- Overnight todos such as `23:00-01:00` wrap across midnight on the wheel.
- Overlapping timed todos show a dashed warning border and readable conflict details.
- Overnight conflicts merge the two midnight-edge fragments into one range such as 23:00 - next day 01:00.
- Unknown stored section IDs are ignored and missing default sections are appended by app normalization.

### Error Cases

- If profile preference save fails, the app leaves the current local view unchanged and shows the Supabase error message.
- If a todo time range is invalid, the existing todo schedule validation blocks save.

## 7. Functional Requirements

- [x] Add `profiles.today_task_view` with `checklist` / `planner` constraint.
- [x] Add `profiles.today_section_order` with allowed Today section IDs.
- [x] Add helper tests for planner angle conversion, overnight segments, unscheduled todos, and overlaps.
- [x] Add helper tests for task view and section order normalization.
- [x] Add Today task view switcher and pin button.
- [x] Add circular SVG daily planner using existing `study_todos`.
- [x] Show the conflicting todo, both schedule ranges, and the exact overlap interval in the selected planner detail.
- [x] Let existing todos be linked into a new timed schedule row from the todo modal without toggling completion or hiding other same-day todos.
- [x] Let planner detail and untimed todo checkboxes toggle completion only when no study session is active.
- [x] Show the selected-date todo list in the planner detail panel with schedule labels and edit/delete row actions.
- [x] Let the Today Tasks card follow a selected local date instead of only the real current date.
- [x] Add previous/today/next/date input controls for planner date navigation; previous and next move relative to the currently selected planner date.
- [x] Add a multi-date apply modal that copies a selected date's plan to chosen calendar dates while skipping duplicates.
- [x] Add dashboard section order editor with drag-and-drop and up/down buttons.

## 8. Non-functional Requirements

- Performance: planner calculation runs client-side over the selected date's loaded todos only.
- Security: preferences are stored on the existing RLS-protected `profiles` row.
- Accessibility: view buttons use `aria-pressed`; planner segments are keyboard-focusable buttons.
- Maintainability: planner math stays in `dailyPlanner.mjs`; layout preference normalization stays in `dashboardLayout.mjs`.

## 9. Dependencies

- Internal: `apps/web/src/main.tsx`, `apps/web/src/dailyPlanner.mjs`, `apps/web/src/dashboardLayout.mjs`, `apps/web/src/todoSchedule.mjs`, `apps/web/src/todoRecurrence.mjs`, `apps/web/src/plannerDate.mjs`
- Supabase: `profiles`, `study_todos`
- API: Supabase Data API upsert on `profiles`, select/insert/update/delete on `study_todos`
- Environment: existing Supabase Vite env vars

## 10. Success Metrics

- A user can persist planner view and see it restored after reload/login.
- A user can create/edit timed todos from the planner without leaving Today.
- A user can select another calendar date and create/edit todos for that date from the planner.
- A user can copy one date's plan to multiple selected dates without creating duplicate title/date/time rows.
- Section order changes are reflected immediately and persist after saving.
- Selecting an overlapping segment identifies which todo conflicts and exactly when the conflict occurs, including overnight ranges.

## 11. Rollout Plan

- Development: TDD helpers, migration, UI wiring.
- Test: `npm.cmd test`, `npm.cmd run build`.
- Deploy: Push to GitHub and verify Vercel production.
- Monitor: Check profile preference saves and todo modal edits in production.

## 12. Open Questions

- Whether the circular planner should eventually support drag-to-resize time blocks directly on the wheel.
- Whether section order editing should become a separate personalization page if more widgets are added.

## 13. 2026-07-19 Update: Full-Surface Time Picker

### Problem

Chrome의 native `input[type="time"]`은 우측 시계 아이콘을 눌렀을 때만 시간 선택기를 여는 경우가 있어, 오전/오후 또는 시간 숫자를 클릭·더블클릭해도 선택기가 나타나지 않았다.

### Functional Requirements

- [x] 시작·종료 시간 입력의 오전/오후, 시, 분, 여백을 포함한 전체 입력 표면 클릭으로 native 시간 선택기를 연다.
- [x] 더블클릭도 동일한 선택기를 열며 첫 클릭만으로도 동작해야 한다.
- [x] Enter와 Space로 키보드 사용자가 선택기를 열 수 있다.
- [x] `showPicker()` 미지원 또는 호출 제한 브라우저에서는 포커스와 기존 직접 입력을 유지한다.
- [x] hover와 focus-visible 상태로 전체 영역이 상호작용 가능함을 표시한다.

### Success Metric

- 사용자는 별도의 시계 아이콘을 정확히 누르지 않아도 시작·종료 시간 값을 선택할 수 있다.
