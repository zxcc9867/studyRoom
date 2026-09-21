# Actual study server API

Contract v1, verified by real SQL behavior tests (see Task 1 report before rollout). All RPCs are authenticated owner-only. No client clock or positive study duration is accepted. Existing start/pause/resume/end/complete/expiry signatures remain callable.

## Preview and confirm

`preview_actual_study_action(p_action text, p_todo_ids uuid[], p_current_todo_id uuid, p_session_id uuid default null, p_excluded_seconds integer default 0) → jsonb`

- Actions: `start`, `resume`, `switch`. Start selects owned incomplete todos scheduled today; resume/switch select owned incomplete todos that are already linked (including previous/next dates) OR scheduled today. When a paused session has no incomplete linked todos, the web reuses the existing today selector to choose/create a new focus; active legacy empty-focus recovery may use the same path. Normal resume keeps the existing linked selection. Exactly one current todo must belong to the selection. Single selection can be chosen by the UI automatically.
- Missing selected links are inserted only inside successful confirm, under its existing transaction/locks. Existing links are never removed; cancelling a selection/preview does not change links, session state, or schedules. Creating a todo in the selector is an explicit standalone planner action, not a session link. Legacy unknown allocation and first-start uncertainty remain unknown; only new forward segments are measured.
- Preview is read-only. It returns `{version:1, action, session_id, todo_ids, current_todo_id, excluded_seconds, proposed_at, expires_at, time_zone, remaining_seconds, revision, changes, cascade_complete, blocking_error}`.
- `remaining_seconds` is null for untimed todos; otherwise max(0, immutable target minus known accepted seconds). Reaching zero does not complete/end anything.
- `changes` contains every changed incomplete schedule, including current and cascaded next-day todos: `{todo_id,title,before:{start_at,end_at,local_date,end_date,start_time,end_time},after:{...}}`. Timestamp strings are absolute ISO timestamps; dates/times use the profile timezone. Completed todos and actual past segments never move. A partially studied other todo's remaining future schedule may move. The first nonoverlapping gap stops the cascade. A current-todo-only change is not a collision; show a collision dialog when another todo also changes.
- `blocking_error` is null or a machine-readable string. `cascade_complete:false` is never confirmable. No partial proposal is committed.
- `revision` fingerprints all owned todo schedule/state and relevant session/tracking state, including the set of rows (phantom inserts/deletes invalidate it). `proposed_at` is a server minute and `expires_at` the next minute; an exact-second click delay does not invalidate the preview within that minute. After expiry refresh before confirming.

`confirm_actual_study_action(p_preview jsonb, p_request_id uuid) → jsonb`

Send the complete unmodified preview and a newly generated UUID. Reuse that UUID and identical preview for transport retries. Returns `{request_id,session,preview,tracking}`; `session` is the existing `study_sessions` row shape and `tracking` is described below. Retried successful requests return the saved response exactly. Reusing the UUID for another preview fails. Stale preview fails with `ACTUAL_STUDY_STALE_PREVIEW`; fetch a new preview and obtain renewed user confirmation for changed collisions. Do not silently confirm fresh changes.

Confirmation preserves the existing recovery/attendance/start gates and lease policy. It takes a per-user advisory lock, locks the session, then briefly locks the todo/link tables against concurrent writes while recomputing the complete proposal. This correctness-first implementation serializes other users' todo/link writes during this short transaction; no table lock is taken by preview/read/polling. Lock waits use a 3-second timeout. More than 2,000 actual cascade moves rejects the whole operation; unrelated historical/future rows do not consume the limit. Lock/guard failures roll back everything. The function also declares a 10-second statement timeout; deployment-level request timeouts should remain enabled.

## Camera checkpoint and pause contract

`checkpoint_actual_study_exclusion(p_session_id uuid, p_excluded_seconds integer) → jsonb`

`pause_actual_study_session(p_session_id uuid, p_excluded_seconds integer default 0) → study_sessions`

The camera counter is **session-cumulative camera-absent seconds excluding explicit breaks**, never total paused+camera time. Flush a live/pending camera absence into that counter before previewing a switch, pausing, or ending; do not reset at resume/switch. Send the same total on preview and confirm. A cancelled preview performs no checkpoint or schedule mutation. During study the checkpoint RPC can persist pending exclusions; it is monotonic and idempotent. Server caps/rejects values beyond observed nonpaused elapsed time, never accepts claimed positive study duration. Pause wrapper atomically checkpoints then calls the unchanged legacy pause RPC. End/complete keep using their existing `p_excluded_seconds` total. Do not subtract server checkpoints again locally from a total already net of the same camera counter.

On refresh/device handoff seed the client cumulative counter from `tracking.excluded_seconds` (not zero); add only newly observed absence. Pending, unsubmitted camera absence cannot be known by another device or server expiry. The UI must flush it at boundaries and should checkpoint periodically while active. Legacy calls without checkpoints remain compatible; final accepted duration conservatively caps allocation. Legacy unassigned elapsed time is explicitly unknown and never retrospectively distributed.

## Hydration and report

`get_actual_study_state(p_session_id uuid) → jsonb`

Returns `{session_id,current_todo_id,tracking_started_at,excluded_seconds,unknown_allocation,server_now,todos}`. `todos` are every linked todo (not only today's), with base todo fields plus `original_start_at`, `original_end_at`, `target_seconds`, `first_started_at`, `known_seconds`, `open_started_at`, `remaining_seconds`, `adjustment_count`, `evaluation_eligible`. `known_seconds` includes bounded live nonpaused seconds as of `server_now`; pending unsubmitted camera exclusion must be subtracted once for live display. While paused/ended, `open_started_at` is null. `unknown_allocation` means some session time predates focused tracking or a legacy exclusion cannot be attributed precisely.

`get_actual_study_report(p_start_date date, p_end_date date) → jsonb`

Returns `{scheduled_count,started_count,on_time_count,on_time_ratio,adjustment_count,unstarted_count,plans}`. Ratio is null when no eligible started plans exist, otherwise 0..1. Plans expose `todo_id,title,original_start_at,first_started_at,delay_minutes,adjustment_count,is_unstarted`. Delay is nonnegative whole minutes from the **first** actual start against the immutable original, never latest resume. On-time means actual first-start minute is no later than original start minute. Untimed and dates before tracking rollout are excluded. Unstarted means an eligible original scheduled start has passed but no known first start exists; future plans are not failures. No study score, attendance or reward changes.

## Storage / integration

- `study_todo_plans`: immutable original instants/target and rollout eligibility. Existing rows are snapshotted at migration; no historical study seconds are invented. An untimed todo captures its FIRST manually supplied timed schedule once; later manual/automatic moves never overwrite it.
- `study_todo_segments`: server-owned focused intervals, at most one open interval per user; owner SELECT only.
- `study_actual_sessions`: current focus/camera checkpoint/unknown state; owner SELECT only.
- `study_schedule_adjustments`: immutable before/after audit rows per request/todo; owner SELECT only.
- Existing `study_todos.local_date/start_time/end_time` remain the planner projection; cross-midnight end date is represented in API instants (end clock <= start clock means following day). Recurrence metadata/identity is never modified.

After confirm replace session/tracking from the response and perform a bounded todos/links refresh. Never apply a stale local shift on top of the committed server result. Prepare camera only after user intent; cancelling a collision dialog stops any camera started solely for that pending start and leaves the server unchanged.

## Precision, unknown history, and compatibility details

- Preview remaining calculations use the captured server minute, including live time for a previous focus in the cascade, so seconds spent reading a modal do not make confirmation stale. Actual segments begin at exact server confirmation time; schedule display precision is one minute.
- With unknown allocation, remaining is a known-time-only upper bound, not a claim about historical study. Zero remaining neither ends the session nor creates a zero-length planner interval.
- Each hydration todo additionally contains `first_tracked_at` and `unknown_allocation`. For unknown historical allocation, `first_started_at` is null and `evaluation_eligible` false. `first_tracked_at` denotes only the first known forward interval; never label it as the historical first study start. This flag follows legacy links across sessions.
- Planning reports exclude legacy-unknown first starts as well as untimed/pretracking dates. Date ranges are inclusive and at most 371 dates.
- Preview blocking errors: `INVALID_ACTION`, `CURRENT_TODO_REQUIRED`, `INVALID_CURRENT_TODO`, `ACTIVE_SESSION_EXISTS`, `ACTIVE_SESSION_NOT_FOUND`, `LEASE_EXPIRED`, `SESSION_NOT_PAUSED`, `SESSION_PAUSED`, `ALREADY_CURRENT_TODO`, `RECOVERY_REQUIRED`, `INVALID_SELECTION`, `INVALID_EXCLUSION`, `CASCADE_LIMIT`, `UNREPRESENTABLE_SCHEDULE`.
- Checkpoint rejection uses `ACTUAL_STUDY_INVALID_EXCLUSION`. UUID reuse for a different preview uses `ACTUAL_STUDY_REQUEST_REUSED`. Permission, malformed-input and lock-timeout errors must surface normally; never fallback to nontransactional shifting.
- `complete_study_session` keeps its exact existing signature. Its completion selection accepts an owned incomplete todo on the original session date OR linked to this session, allowing linked schedules shifted across midnight to finish. Reflection fields and end/attendance processing stay intact.
- Legacy start with no designated focus remains unknown until a focus is chosen. Legacy pause/resume/end/expiry maintain any existing tracked focus through a session transition trigger; they never assign untracked past time.
- Legacy late camera exclusions are conservatively debited newest-first from closed known segments and capped by final accepted session duration. They never create study time. Flush checkpoints before switches to retain precise per-todo attribution.
- Polling should call `get_actual_study_state` with the existing active-session sync cadence, not add another timer. A successful confirm response has all linked todo base fields, so next-day tasks need not disappear while the bounded planner reload completes.
- Real multi-connection lock contention and production rollout are separate integration gates; the local PGlite suite verifies SQL behavior, constraints, RLS, and rollback but is a single-connection engine.
- Every proposed interval must round-trip losslessly through the existing planner's start date and two clock fields in the profile timezone. DST/long intervals that lose a date or map to a different absolute instant return `UNREPRESENTABLE_SCHEDULE`, `cascade_complete:false`, and `changes:[]`. The whole operation is blocked; never apply a representable prefix or bypass confirmation with legacy shifting.
- If the profile is missing during account recovery, original snapshots (including migration backfill) and previews use `Asia/Tokyo`, matching the profile created by legacy `start_study_session`. Local-day selection and stored clocks therefore remain consistent across the UTC date boundary.
- For the outgoing focus in a cascade, remaining is `max(0, target - max(0, known - pending_camera_exclusion))`. An already-over-target todo does not acquire phantom remaining time merely because a pending exclusion is submitted.
