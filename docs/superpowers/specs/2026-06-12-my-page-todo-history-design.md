# My Page Todo History Design

## Goal

Add a "My Page" section to the existing web dashboard so the user can review profile information and completed todo history.

## Context

The web app currently uses a single Vite React dashboard with sidebar anchor sections. It already loads `profiles`, `attendance_days`, `study_sessions`, and `study_todos` through Supabase. The requested feature does not require a new table because todo completion state already lives in `study_todos.is_completed`.

## Chosen Approach

Use approach 1 from the brainstorming discussion: add a new in-dashboard section instead of adding a router or separate route.

## User Experience

- Add a sidebar tab labeled `내 페이지`.
- The section shows the user's email, auth provider, reminder time, time zone, completed todo count, and current-month completed todo count.
- The todo history area shows completed todos only by default.
- Completed todos are sorted by date descending.
- History uses 10 items per page with previous/next controls and a `current / total` page indicator.
- Empty state shows a simple message when there are no completed todos.

## Data Flow

1. `loadDashboard()` continues loading `study_todos`.
2. A focused helper module filters completed todos, sorts them, calculates stats, and paginates the list.
3. `main.tsx` renders the helper output in the new `me` section.
4. No additional Supabase queries or RLS policies are required.

## Component Boundaries

- `apps/web/src/todoHistory.mjs`: pure data helpers for completed todo history.
- `apps/web/test/todoHistory.test.mjs`: unit tests for filtering, sorting, stats, and pagination.
- `apps/web/src/main.tsx`: UI integration only.
- `apps/web/src/styles.css`: visual styling for the My Page section.

## Error Handling

- If profile fields are missing, show stable fallback text.
- If completed todo history is empty, show an empty state.
- If the current page goes out of range after data changes, clamp it to the nearest valid page.

## Testing

- Unit test completed todo sorting and filtering.
- Unit test page size and clamping.
- Unit test stats for all completed todos and the selected month.
- Run the full app test suite and production build.
