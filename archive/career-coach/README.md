# Archived career coaching

The user retired the career-first experience on 2026-09-12 in favor of the technology feed. Files under this directory mirror their original repository-relative paths. They are NOT part of active web builds, Node test globs or Edge deployment entries.

## Preserved
- Dedicated UI, settings, integrations, scheduling, notification and roadmap logic and their tests.
- Original deployed handlers are snapshots; the active handler paths now return HTTP410 and do not enqueue work.
- Existing Supabase migration history and production data are kept at their original paths. Shared free OpenRouter client, six-call budget and restart coaching stay active.
- Timezone UI/helper functionality was extracted into profileTimeZone modules and the independent authenticated tech-feed timezone action.

## Restore deliberately
1. Review this snapshot against current auth, timezone, quota and todo contracts; do not blindly overwrite newer files.
2. Copy the selected mirrored files back to original paths, reconcile shared imports (including TimeZonePicker/OpenRouter) and restore dedicated test commands.
3. Reintroduce CareerCoach mounts and calendar overlays from Git history only after a revised PRD is approved. Keep feed and profile settings working.
4. Restore the four Edge handlers and signed Slack career-action branch after verifying RLS, pilot/consent gates, API permissions and OAuth token lifecycle.
5. Apply an explicit forward migration to re-enable career data APIs and cron; do not edit or replay historical migrations. Re-enable per-user settings only with user consent.
6. Run original database/domain/integration/UI tests plus current full tests/build/Edge checks. Deploy only on a separate request.

Archived code is a reusable snapshot, not a currently supported or deployable standalone package. No credentials are included. The archived DB test reads migrations from the active root via COACH_MIGRATIONS_DIR when manually restored/executed.
