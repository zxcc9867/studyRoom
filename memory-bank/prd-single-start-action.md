# PRD: Single Adaptive Study Start Action

## 1. Problem

The Today screen can show up to three controls that all start the same study-session flow: the topbar session control, the latest-reflection action, and the five-of-seven habit action. Repeating one primary action increases choice friction and makes the habit guidance feel like competing commands.

## 2. Target Users

Learners who need one obvious next step when they open Today, including users returning from a prior reflection or continuing a flexible weekly habit goal.

## 3. Goals

- Keep exactly one persistent study-start control on Today.
- Adapt that control's label and todo suggestion to the learner's current context.
- Keep reflection and weekly-habit cards informative without turning them into extra start surfaces.
- Preserve every existing recovery, camera, lease, and session-todo gate.

## 4. Non-goals

- Changing the End, Pause, or Resume actions.
- Removing the temporary start action from reminder dialogs.
- Automatically creating a todo or starting a session.
- Changing Supabase, attendance, session, or Expo behavior.

## 5. User Stories

- As a learner, I want one clear start button, so that I do not have to decide which of several equivalent controls is correct.
- As a returning learner, I want the button to carry forward my last next action, so that I can resume with less setup.
- As a learner following the five-of-seven goal, I want the same button to show the relevant ten-minute or daily-goal prompt.

## 6. User Scenarios

### Normal Flow

1. Today derives the latest reflection action, current weekly action label, and first incomplete todo.
2. The topbar renders one context-aware start label.
3. Clicking it enters the existing recovery, camera, and todo-selection flow with the derived suggestion.
4. The daily and weekly cards explain why that is the next action and point to the single button above.

### Edge Cases

- A reflection action has priority over weekly copy and becomes the suggested todo title.
- Without a reflection, weekly copy controls the label while the first incomplete todo remains the suggestion.
- Without weekly copy, the stable `입장하고 시작` label remains and may still suggest the first incomplete todo.
- Active and paused sessions continue to show `잠시 쉬기` and `공부 계속하기` respectively, and start-only guidance is hidden while a session is active or paused.

### Error Cases

- Blank or whitespace-only values are normalized away.
- A stale suggestion is still cleared by existing recovery and camera cancellation paths.

## 7. Functional Requirements

- [x] Add a deterministic helper for label, suggestion, and source priority.
- [x] Use the helper in the topbar's inactive-session action.
- [x] Remove interactive start buttons from the daily next-action and weekly target cards.
- [x] Keep non-interactive context visible only while the topbar is an inactive-session start action, and hide start-only guidance during active or paused sessions.
- [x] Keep exactly one persistent inactive-session start CTA on Today.
- [x] Preserve pause, resume, end, reminder modal, and existing session gates.

## 8. Non-functional Requirements

- Performance: constant-time derivation with no new request or timer.
- Security: no new data access or write path.
- Accessibility: the remaining button has one clear accessible name; supporting cards use readable text rather than disabled controls.
- Maintainability: priority logic stays outside React and is covered by helper tests.

## 9. Dependencies

- Internal: `dailyHabit.mjs`, `weeklyHabit.mjs`, the existing `startTimer()` path, and Today card styles.
- External: none.
- Supabase: no change.
- API: no change.
- Environment variables: no change.

## 10. Success Metrics

- Source and rendered UI expose one persistent start CTA on inactive Today.
- Reflection, weekly-goal, todo-only, and default priorities return deterministic labels and suggestions.
- Desktop and mobile preserve readable context with no horizontal overflow.

## 11. Rollout Plan

- Development: helper-first tests, React wiring, and responsive style update.
- Testing: focused Node tests, full tests, production build, and Chrome at 1440px and 390px.
- Deployment: only after an explicit user request.
- Monitoring: observe whether the adaptive label makes the next study action understandable without duplicate buttons.

## 12. Open Questions

- Whether future usability data should let users choose a permanently fixed label instead of adaptive copy.

## 13. Verification Evidence

- Four helper scenarios cover reflection, weekly-goal, todo-only, and default priority.
- Source contracts require one topbar route, prohibit card-level start buttons, and hide start-only guidance for active or paused sessions.
- All 314 Node tests and the TypeScript/Vite production build pass.
- Actual Chrome at 1440px and 390px verifies one persistent start action, zero card actions, exact suggestion routing, no horizontal overflow, and zero console/page errors.
- No Supabase, environment-variable, timer, localStorage, or Expo change was introduced.
