create table if not exists public.study_recovery_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null,
  week_end_date date not null,
  summary jsonb not null default '{}'::jsonb,
  slack_target_id uuid references public.notification_targets(id) on delete set null,
  slack_message_ts text,
  slack_sent_at timestamptz,
  app_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_recovery_weekly_reports_week_order_check check (week_end_date >= week_start_date),
  constraint study_recovery_weekly_reports_summary_object_check check (jsonb_typeof(summary) = 'object'),
  unique (user_id, week_start_date)
);

create index if not exists study_recovery_weekly_reports_user_week_idx
  on public.study_recovery_weekly_reports (user_id, week_start_date desc);

alter table public.study_recovery_weekly_reports enable row level security;

drop policy if exists "Users can read their recovery weekly reports" on public.study_recovery_weekly_reports;
create policy "Users can read their recovery weekly reports"
  on public.study_recovery_weekly_reports for select
  using ((select auth.uid()) = user_id);

grant select on public.study_recovery_weekly_reports to authenticated;
grant all on public.study_recovery_weekly_reports to service_role;

drop trigger if exists study_recovery_weekly_reports_touch_updated_at on public.study_recovery_weekly_reports;
create trigger study_recovery_weekly_reports_touch_updated_at
  before update on public.study_recovery_weekly_reports
  for each row execute function public.touch_updated_at();
