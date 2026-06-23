# PRD: Daily Planner Dashboard

## 1. Problem

The user can create dated todos with optional times, but the Today page only shows them as a checklist. This makes it hard to see how the day is distributed across time blocks and to adjust the dashboard layout to match the user's study workflow.

## 2. Target Users

Personal MVP users who want to plan and visualize today's study tasks in either a checklist or a life-planner style circular schedule.

## 3. Goals

- Let the user switch today's tasks between checklist and circular daily planner views.
- Show timed todos as 24-hour SVG wheel segments and untimed todos in a separate list.
- Let the user create a timed todo by clicking an empty planner time area.
- Let the user edit an existing timed todo by clicking a planner segment.
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

## 6. User Scenarios

### Normal Flow

1. The user opens Today.
2. The user switches from checklist to planner.
3. Timed todos appear as colored segments on the 24-hour SVG wheel.
4. The user clicks an empty time area; the existing todo modal opens with a default one-hour time block.
5. The user saves; `study_todos` updates and the planner recalculates.
6. The user clicks `고정`; `profiles.today_task_view` stores the current view.
7. The user opens the section order editor, drags or moves rows, and saves the order to `profiles.today_section_order`.

### Edge Cases

- Todos without `start_time` or `end_time` stay in the untimed list.
- Overnight todos such as `23:00-01:00` wrap across midnight on the wheel.
- Overlapping timed todos show a dashed warning border.
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
- [x] Add dashboard section order editor with drag-and-drop and up/down buttons.

## 8. Non-functional Requirements

- Performance: planner calculation runs client-side over today's loaded todos only.
- Security: preferences are stored on the existing RLS-protected `profiles` row.
- Accessibility: view buttons use `aria-pressed`; planner segments are keyboard-focusable buttons.
- Maintainability: planner math stays in `dailyPlanner.mjs`; layout preference normalization stays in `dashboardLayout.mjs`.

## 9. Dependencies

- Internal: `apps/web/src/main.tsx`, `apps/web/src/dailyPlanner.mjs`, `apps/web/src/dashboardLayout.mjs`, `apps/web/src/todoSchedule.mjs`, `apps/web/src/todoRecurrence.mjs`
- Supabase: `profiles`, `study_todos`
- API: Supabase Data API upsert on `profiles`, select/insert/update/delete on `study_todos`
- Environment: existing Supabase Vite env vars

## 10. Success Metrics

- A user can persist planner view and see it restored after reload/login.
- A user can create/edit timed todos from the planner without leaving Today.
- Section order changes are reflected immediately and persist after saving.

## 11. Rollout Plan

- Development: TDD helpers, migration, UI wiring.
- Test: `npm.cmd test`, `npm.cmd run build`.
- Deploy: Push to GitHub and verify Vercel production.
- Monitor: Check profile preference saves and todo modal edits in production.

## 12. Open Questions

- Whether the circular planner should eventually support drag-to-resize time blocks directly on the wheel.
- Whether section order editing should become a separate personalization page if more widgets are added.
