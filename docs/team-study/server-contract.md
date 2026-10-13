# Team Study server contract

Local implementation: `supabase/migrations/20261012143354_team_study_room.sql`. Production application is controller-owned and not established by this document.

## Access boundary

Only registered `auth.users` with `is_anonymous=false` and the current `auth.uid()` can use the feature. `anon` cannot execute either public RPC. The authenticated role cannot directly read/write private team tables or execute mutation/checkpoint helpers. The single RLS helper only answers membership for the caller, never arbitrary other accounts. Every definer has an empty search path. Existing personal session/todo RLS and lifecycle functions are not changed.

`public.team_study_signals(team_id uuid, revision bigint)` is read-only to authenticated members of an open team. Subscribe to UPDATE events, then refresh the snapshot. It contains no personal data; the row is retained when members leave or a team closes, while their RLS access is revoked immediately. Migration adds the table to `supabase_realtime` if that publication exists. Production publication verification remains required.

## RPC calls

`team_study_action(p_action text, p_payload jsonb = '{}')` returns `{ok:boolean,error?:code,...safe result}`. Success means the team action succeeded, not that a personal study action occurred. Refresh the snapshot after actions. RPC transport/timeout failures still require normal client error handling.

| Action | Payload | Extra result / behavior |
|---|---|---|
| set_tag | `{tag}` | `{tag}`; lowercases/trims, exact full public tag |
| lookup_tag | `{tag}` | `{tag,display_name}` only; no user UUID/email |
| create_team | `{name,time_zone?}` | `{team_id}`; default zone Asia/Tokyo |
| create_invite | `{}` | `{token,invite_id,expires_at}`; owner-only |
| revoke_invite | `{invite_id}` | Owner-only, idempotent revocation |
| preview_invite | `{token}` | `{team:{id,name,member_count},expires_at}`; never joins |
| accept_invite | `{token}` | `{team_id}`; explicit join, repeated same membership succeeds |
| invite_tag | `{tag}` | `{invite_id}`; any member can send, recipient must respond |
| respond_invite | `{invite_id,accept:boolean}` | Accept/decline; same response retry succeeds, accepted invitation cannot rejoin a departed user |
| leave_team | `{successor_id?}` or `{close:true}` | Member departure; owner must select another current member or explicitly close, including a solo owner |
| set_share_title | `{share:boolean}` | Default false; shares only the current todo title |
| propose_round | `{duration_minutes:25\|50}` | One open proposal, expired proposal replaced |
| cancel_round | `{}` | Proposer/owner only; does not stop/pause/disconnect personal study |
| connect | `{session_id}` | Caller-owned active, unpaused, unexpired, actual-tracked session required; repeat is idempotent |
| disconnect | `{}` | Idempotent; closes team contribution only, no personal stop/pause |

Names: trimmed 1–60 characters. Zones must be PostgreSQL recognized names. Public tags trim whitespace and lowercase ASCII, with 2–20 Hangul/ASCII letters/digits/underscore/hyphen characters on each side of `#`; normalized regex is `^[a-z0-9가-힣_-]{2,20}#[a-z0-9가-힣_-]{2,20}$`. Requested example `A스타#지니` normalizes to `a스타#지니`; exact full-tag lookup and recipient-confirmed invitation are supported. Team capacity is 6; one current team/user. No prefix search/email lookup/anonymous accounts/automatic team moves. No browser-supplied user ID, accepted seconds, start/end timestamps, or member state is trusted.

Link token: 64 lowercase hexadecimal characters generated from two random UUIDs (approximately 244 random bits); only its SHA-256 hash is stored. It expires after 7 days and can be revoked. Raw tokens are returned only at issuance, never in snapshots. Owner reload can revoke previous active links using `invite_links` metadata. Failed discovery/invitation/tag attempts persist toward a shared per-user limit of 20 attempts per server minute, including malformed payload casts and tag collisions. Retrying accepted links still counts as an attempt. Counters are written outside the inner error-catching subtransaction.

Safe error codes: `ACCOUNT_REQUIRED`, `INVALID_ACTION`, `INVALID_PAYLOAD`, `INVALID_TAG`, `TAG_NOT_FOUND`, `INVITE_INVALID`, `RATE_LIMITED`, `ALREADY_IN_TEAM`, `TEAM_FULL`, `TEAM_REQUIRED`, `OWNER_REQUIRED`, `OWNER_SUCCESSOR_REQUIRED`, `ROUND_EXISTS`, `SESSION_REQUIRED`, `TRACKING_REQUIRED`, `CONNECTION_EXISTS`, `CONFLICT`, `RETRY`. Invalid/expired/revoked/wrong-recipient invitations deliberately share `INVITE_INVALID`. Constraint collisions return `CONFLICT`; lock/deadlock contention returns `RETRY`. No exception text is returned in JSON.

## Snapshot

`team_study_snapshot()` returns:

```text
{
 tag: string|null,
 team: null|{id,name,owner_id,time_zone,member_count},
 members: [{user_id,display_name,state,title,share_title,started_at,paused_seconds,paused_at}],
 invitations: [{id,team_name,member_count,expires_at}],
 invite_links: [{id,expires_at}],
 round: null|{id,duration_minutes,proposed_by,started_at,ends_at,joined},
 connection: null|{id,session_id},
 forest: {accepted_seconds,pending_sessions,trees,progress_seconds},
 server_now
}
```

`invite_links` is owner-only active link metadata; others receive `[]`. `invitations` contains only caller-received pending targeted invites; a team-less user must poll snapshots within bounded intervals because they cannot access that team's signal. Member display names derive from public tags (fallback `팀원`), never private profile fields. `state` is `ready` when no unexpired active session exists, `resting` when paused, otherwise `studying`. Transport connectivity is separate. Title is null unless explicitly shared, linked to a caller-owned actual current todo, and the personal session is still valid. `share_title` and `paused_at` are safe additional UI fields. No email, recovery routine, original study rows, camera exclusions, total private history or raw tokens/hash are returned. Unauthorized/account-less snapshot returns `{ok:false,error:'ACCOUNT_REQUIRED'}`.

## Authority, contribution and invalidation

Personal start/resume/pause/end continues through existing official callbacks/RPCs. A team action never edits `study_sessions` duration/status/pause/day/lease or attendance. Explicit connect/disconnect/departure uses session→tracking row locks and the existing `actual_study_private.close_segment` function, reopening the current segment only while active/unpaused/unexpired. Connection boundaries are server timestamps. Already-connected retries do not checkpoint again; connection ends automatically on personal session end. Closing a team checkpoints current connections but leaves all personal sessions and records intact.

The first valid connect starts a proposal once; late joiners share its end timestamp. A round expiring/cancelling does not end personal study or team contribution. If already connected, connect can attach that same connection to a new round without another segment split.

Forest uses each finalized accepted todo segment once only when it lies entirely inside a server-checkpointed connection, a finalized personal session, and its lease. Per-session team sum is capped by final personal `duration_seconds`. Active sessions remain pending, including previously disconnected intervals awaiting final settlement. Missing actual tracking is rejected, never estimated. Pause/camera deductions/lease settlement use the existing real close/debit/session-transition policy, and can reduce final contribution. Leaving retains historical contributions for remaining members; subsequent personal study does not accrue to the old team. Every 7200 finalized seconds produces one tree; remainder is `progress_seconds`. No automatic week/month resets or personal ranking.

Integer precision: existing accepted segments floor each interval. Additional explicit team checkpoint can conservatively lose less than one allocation second per split; personal final `study_sessions.duration_seconds` and study-day/attendance policy remain unchanged. Fractional test: personal duration1800, segment allocation1799, connected forest599. This limitation is not corrected by inventing time or modifying personal accepted-study functions.

Signals invalidate on team actions/membership, personal start/pause/end, shared current todo/title, and lease validity crossing. Fresh lease heartbeats do not broadcast. Lease expiry itself is clock-driven, so bounded snapshot polling/server refresh remains necessary. No per-second team writes. Per-account locks protect competing joins, team row locks serialize capacity/ownership/round/connect decisions, and session locks precede team/signal locks where checkpoints are needed. PGlite behavioral tests are not proof of production multi-connection concurrency, Realtime transport, real two-account browser/device synchronization, or deployment.

Close retains the initially prelocked session-ID set (sorted by session ID). After obtaining the team lock it checks that all current open connections belong to that set; a newly committed connection outside it returns `RETRY` before any checkpoint. It never extends the session-lock set while holding the team lock. SQL guard tests and controlled guard-failure tests exercise this invariant and no-mutation retry, but do not prove real multi-connection race scheduling; that remains unverified.

## Verification

`node --test packages/core/test/team-study-db.test.mjs supabase/functions/_shared/actual-study-db.test.mjs`

The fixture executes real migration and real personal start/pause/resume/end, `close_segment`, `debit_segments`, and `session_transition`; only Supabase Auth/time/base schema and unrelated external attendance promotion are fixture scaffolding. Production application must verify actual schema, grants/RLS/RPC, publication/security advisors and signed-in account behavior separately. Rollback the web first; retain new team data, do not drop private tables or rewrite personal records.
