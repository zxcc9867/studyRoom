revoke all on function public.submit_study_recovery_request(uuid, text, text, text) from anon;
revoke all on function public.submit_study_recovery_request(uuid, text, text, text) from public;
grant execute on function public.submit_study_recovery_request(uuid, text, text, text) to authenticated;
