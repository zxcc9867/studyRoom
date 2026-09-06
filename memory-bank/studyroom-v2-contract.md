# StudyRoom 2.0 shared contract (implementation owner: main)

All new handlers are Supabase Edge Functions, authenticated Supabase invoke with `{action,...}` JSON. Ordinary responses JSON, errors `{error:string}` with proper HTTP status. Service role only inside handlers after validated getUser. All data snake_case (including UI types). Browser uses existing supabase client. Cron x-cron-secret checked; OAuth callbacks use one-use expiring state bound to authenticated user. No user_id from client trusted.

## career-coach actions
- `state`: returns `{enabled,settings,career,events,recommendations,jobs,integrations,repositories}`. Disabled default false; settings defaults returned. Integration records sanitized, never tokens.
- `settings`: `{settings:{enabled?,time_zone?,summary_time?,quiet_start?,quiet_end?,buffer_minutes?,min_slot_minutes?,availability?:[{weekday:0..6,start:'HH:mm',end:'HH:mm'}],channels?:{slack:boolean,web_push:boolean,email:boolean}}}`; server changes profile.time_zone when supplied, invalidates future pending recommendations/jobs safely. Existing alarm flags do not enable coaching channels.
- `save_career`: `{career:{title,experience,target_date,interests:string[],skills:[{id,title,prerequisites:string[],task,acceptance,status:'todo'|'doing'|'done'}],confirmed:boolean}}`; one active career, retain archived history. Return state-compatible object after save (UI reloads state).
- `save_event`: `{event:{id?,title,start_at?,end_at?,start_date?,end_date?,all_day:boolean,repeat_weekdays:number[],repeat_until?,time_zone}}`; end_date exclusive, repeat wall-clock anchored to event timezone. `delete_event`: `{id}`. Internal only; google cannot mutate.
- `accept`: `{id,start_at?}` -> `{todo_id}`; transactional same-user lock/recheck, idempotent per recommendation. `feedback`: `{id,feedback:'helpful'|'difficult'|'known'|'skip'}`. `snooze`/`mute_today` optional worker actions.
- `refresh` enqueues current-day work (automatic from state if absent/stale; not a manual Generate button).

## DB shared names (backend migration owner)
- `coach_settings`: user_id PK, enabled bool default false, summary_time time default09:00, quiet_start22:00,quiet_end08:00, buffer_minutes10,min_slot_minutes15,availability jsonb default[], channels jsonb default allfalse, muted_until timestamptz, version int, updated_at.
- `coach_careers`: id,user_id,title,experience,target_date date,interests jsonb[],skills jsonb[],confirmed bool,status active|archived,version int,created_at,updated_at. unique active/user.
- `coach_events`: id,user_id,source internal|google,external_id nullable,connection_id nullable,title,start_at/end_at timestamptz nullable,start_date/end_date date nullable,all_day bool,time_zone text,repeat_weekdays jsonb[],repeat_until date,created_at. unique(user_id,source,external_id) where nonnull.
- `coach_recommendations`: id,user_id,career_id,local_date,date status pending|accepted|skipped|expired,title,reason,skill_id,acceptance,duration_minutes,start_at,end_at,source ai|rules|github,evidence jsonb[],feedback nullable,todo_id nullable,payload jsonb,created_at. Payload carries model/configured_model/prompt_version/input_version.
- `coach_jobs`: id,user_id,kind roadmap|recommendations|google_sync|github_analysis,payload jsonb,status pending|running|done|failed,lease uuid,lease_until,attempts,run_after,created_at,error_code. Backend exposes enqueue helper; integration writes compatible jobs.
- `coach_connections`: id,user_id,provider google|github,status connected|error|disconnected,config jsonb,encrypted_credentials text nullable,last_synced_at,last_error,created_at,updated_at. PRIVATE token storage no authenticated SELECT grants; state explicitly selects safe columns via admin.
- `coach_repositories`: id,user_id,connection_id,owner,name,private bool,ai_enabled bool defaultfalse,head_sha,analyzed_sha,analysis jsonb[],last_checked_at,created_at.
- `coach_deliveries`: id,user_id,recommendation_id nullable,local_date,kind summary|opportunity,channel slack|web_push|email,target_id text,status pending|sending|sent|failed|unknown|cancelled,scheduled_at,sent_at,created_at; unique(user_id,local_date,kind,channel,target_id). Backend migration owns table; integrations own sender.

## Integrations owner contract
Implement `coach-integrations/index.ts` and `_shared/coach-integrations.ts` providing `syncGoogle(admin,userId,env?)`, `analyzeRepositories(admin,userId,...)` or clear compatible exports agreed with backend; private credentials encryption uses COACH_ENCRYPTION_KEY, GOOGLE_CLIENT_ID/SECRET, GITHUB_APP_ID/PRIVATE_KEY/SLUG/CLIENT_ID/CLIENT_SECRET, SITE_URL server env. Actions `status`, `connect`{provider},`calendars`,`select_calendars`{calendar_ids},`repositories`,`select_repository`{owner,name,ai_enabled},`disconnect`{provider},`sync`{provider}. connect returns `{url}`, callbacks redirect allowed SITE_URL/#me. Status exposes configured booleans and actionable missing-configuration message (never secret names to ordinary UI unless helps admin).
Notifications handler in integration worktree; backend integrates its dispatch with jobs via written coordination. Notifications strictly read coach_settings.channels AND enabled notification_targets; email requires explicit coach setting and existing profile email flag/target. No automatic fallback. Existing Slack dispatcher main adds adapter hook only after integration provides exact contract.

Frontend owns new CareerCoach.tsx, types/helper/css/timezone picker, main.tsx integration and tests. Integration settings UI uses this contract. Frontend writes no migrations. Main owns docs, screenshots, workflows and existing old coaching quota integration.

## Final integration notes

- state also returns `eligible`; server-only coach_pilot_users is fallback when COACH_PILOT_USER_IDS is absent. Explicit empty env means no pilot.
- Every integration action except status carries provider. GitHub env names are GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET.
- coach-notifications authenticated actions: connect_email, disconnect_email, test {channel}; connecting uses verified auth email, never a client-supplied address. Cron callers use x-cron-secret.
- OAuth config includes authorization_version. coach_complete_connection and coach_select_repository perform connection mutations atomically under the same lock as disconnect.
- Worker processIntegrationJob receives the current job id/lease; Google/repository final RPCs check lease and enabled settings. Foreground Google refresh omits lease but still requires enabled coach and matching connection config.
- User data and tests do not prove live provider delivery or AI quality. These remain release checks in progress.md.
