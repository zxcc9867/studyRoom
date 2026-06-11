# PRD: My Page Todo History

## 1. Problem

The user can create and complete daily todos, but there is no dedicated place to review personal information and completed todo history over time.

## 2. Target Users

Personal MVP users who want to see what they have completed and use that history as evidence of study progress.

## 3. Goals

- Add a `내 페이지` section to the existing dashboard.
- Show profile-level information without exposing secrets.
- Show completed todo history with pagination.
- Reuse existing `study_todos` data and RLS boundaries.

## 4. Non-goals

- Add a new router or separate `/me` route.
- Add a new Supabase table.
- Add charts, search, or advanced filters in this iteration.

## 5. User Stories

- As a user, I want to open My Page, so that I can see my account and reminder information.
- As a user, I want to review completed todos, so that I can see what I have already finished.
- As a user, I want pagination, so that a long todo history does not make the page too large.

## 6. User Scenarios

### Normal Flow

1. User logs in.
2. User opens `내 페이지` from the sidebar.
3. User sees email, login provider, reminder time, time zone, todo completion counts, and completed todo history.
4. User moves through the completed todo history with previous/next buttons.

### Edge Cases

* If no todos are completed, show an empty state.
* If the current page is out of range after data changes, clamp it to a valid page.

### Error Cases

* If profile fields are missing, show fallback labels instead of crashing.

## 7. Functional Requirements

* [x] Add a `내 페이지` sidebar tab.
* [x] Show profile information.
* [x] Show completed todo count and current-month completed todo count.
* [x] Show completed todos only.
* [x] Sort completed todos by newest date first.
* [x] Paginate completed todo history by 10 items per page.

## 8. Non-functional Requirements

* Performance: Use already loaded dashboard data and pure memoized helpers.
* Security: Do not expose tokens, chat IDs, service role keys, or provider secrets.
* Accessibility: Use readable labels and button states for pagination.
* Maintainability: Keep filtering and pagination in a small helper module.

## 9. Dependencies

* Internal dependencies: `studyTodos` loaded by `loadDashboard()`.
* External dependencies: none.
* Supabase: existing `study_todos` table.
* API: no new API.
* Environment variables: no new variables.

## 10. Success Metrics

* User can find My Page from the sidebar.
* User can see completed todo history without opening each calendar day.
* Long histories remain usable through pagination.

## 11. Rollout Plan

* Development: Implement in the existing web dashboard.
* Testing: Unit-test history helpers and run the full build.
* Deployment: Deploy to Vercel when credentials are available.
* Monitoring: Check user feedback and browser rendering.

## 12. Open Questions

* Whether to add month filtering or search later.
* Whether to show incomplete todos in a separate tab later.
