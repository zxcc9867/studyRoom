create index if not exists study_recovery_requests_consolidated_into_id_idx
  on public.study_recovery_requests (consolidated_into_id)
  where consolidated_into_id is not null;
